"use server";

import fs from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dataRoot, ensureDataDirs } from "@/lib/files";
import { hashPin, isFourDigitPin, verifyPin } from "@/lib/pin";
import { verifyPassword } from "@/lib/password";
import { id } from "@/lib/ids";
import { prisma, systemPrisma } from "@/lib/prisma";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/session";
import type { SessionUser } from "@/lib/session-token";
import { actor } from "./actor";
import {
  backupDatabase,
  removeDemoData,
  saveMedication,
  savePrinter,
  saveProduct,
  saveService,
  saveSettings,
  saveSupplier,
  saveUser,
} from "./admin";
import { writeAudit } from "./audit";
import {
  addDiagnosis,
  addVisitMedication,
  buildDirectSaleLines,
  confirmVaccination,
  createOwner,
  createPatient,
  createPrescription,
  openVisit,
  payVisit,
  recordExternalVaccination,
  removeVisitMedication,
  savePatientPhoto,
  saveVisit,
  setVisitServices,
  updateOwner,
  updatePatient,
} from "./clinical";
import { commitSale, refundSale } from "./commerce";
import { adjustStock, receiveMedication, receiveProduct } from "./inventory";
import { processSyncQueue } from "./sync";
import { appUrl } from "@/lib/app-url";
import { getPaynow } from "@/lib/paynow";
import { removeClinicLogo, uploadClinicLogo } from "@/lib/supabase-storage";

const attempts = new Map<string, { count: number; until: number }>();

function bubble(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest ?? "").startsWith("NEXT_")
  ) {
    throw error;
  }
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function num(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loginWithPin(pin: string, practiceCode: string) {
  const attemptKey = `pin-login:${practiceCode}`;
  const locked = attempts.get(attemptKey);
  if (locked && locked.until > Date.now()) {
    return { ok: false as const, error: "Too many attempts. Wait 30 seconds." };
  }
  const organization = await systemPrisma.organization.findUnique({ where: { slug: practiceCode } });
  if (!organization || organization.status !== "ACTIVE") return { ok: false as const, error: "Incorrect PIN." };
  const users = await systemPrisma.user.findMany({
    where: { organizationId: organization.id, active: true },
    select: { id: true, name: true, role: true, organizationId: true, branchId: true, pinHash: true },
  });
  const matchingUsers = users.filter((user) => verifyPin(pin, user.pinHash));
  if (matchingUsers.length !== 1) {
    const count = (locked && locked.until > Date.now() ? locked.count : locked?.count ?? 0) + 1;
    attempts.set(attemptKey, { count, until: count >= 5 ? Date.now() + 30_000 : 0 });
    return { ok: false as const, error: "Incorrect PIN." };
  }
  const user = matchingUsers[0];
  attempts.delete(attemptKey);
  await setSessionCookie({
    id: user.id,
    name: user.name,
    role: user.role as SessionUser["role"],
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });
  await writeAudit(prisma, {
    organizationId: user.organizationId,
    branchId: user.branchId,
    userId: user.id,
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
  });
  redirect(user.role === "PLATFORM_ADMIN" ? "/platform" : user.role === "SUPER_ADMIN" ? "/admin" : "/home");
}

export async function loginPlatformAdmin(formData: FormData) {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const attemptKey = `platform-login:${email}`;
  const locked = attempts.get(attemptKey);
  if (locked && locked.until > Date.now()) redirect("/platform/login?error=locked");

  const user = await systemPrisma.user.findFirst({
    where: { email, role: "PLATFORM_ADMIN", active: true },
    select: { id: true, name: true, organizationId: true, branchId: true, passwordHash: true },
  });
  if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
    const count = (locked?.count ?? 0) + 1;
    attempts.set(attemptKey, { count, until: count >= 5 ? Date.now() + 30_000 : 0 });
    redirect("/platform/login?error=invalid");
  }

  attempts.delete(attemptKey);
  const organization = await systemPrisma.organization.findUnique({ where: { id: user.organizationId } });
  if (!organization || organization.status !== "ACTIVE") redirect("/platform/login?error=inactive");
  await setSessionCookie({
    id: user.id,
    name: user.name,
    role: "PLATFORM_ADMIN",
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });
  await writeAudit(systemPrisma, {
    organizationId: user.organizationId,
    branchId: user.branchId,
    userId: user.id,
    action: "LOGIN",
    entity: "User",
    entityId: user.id,
  });
  redirect("/platform");
}

export async function unlockPosAdminAccess(pin: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Sign in again to continue." };
  const attemptKey = `pos-admin-pin:${session.organizationId}:${session.id}`;
  const locked = attempts.get(attemptKey);
  if (locked && locked.until > Date.now()) {
    return { ok: false as const, error: "Too many attempts. Wait 30 seconds." };
  }
  if (!isFourDigitPin(pin)) return { ok: false as const, error: "Enter a 4-digit admin PIN." };

  const organization = await prisma.organization.findUnique({ where: { id: session.organizationId } });
  if (!organization || organization.status !== "ACTIVE") {
    return { ok: false as const, error: "This practice is unavailable." };
  }
  const admins = await prisma.user.findMany({
    where: { organizationId: organization.id, active: true, role: "SUPER_ADMIN" },
    select: { id: true, name: true, role: true, organizationId: true, branchId: true, pinHash: true },
  });
  const matchingAdmins = admins.filter((user) => verifyPin(pin, user.pinHash));
  if (matchingAdmins.length !== 1) {
    const count = (locked?.count ?? 0) + 1;
    attempts.set(attemptKey, { count, until: count >= 5 ? Date.now() + 30_000 : 0 });
    return { ok: false as const, error: "Incorrect admin PIN." };
  }

  const admin = matchingAdmins[0];
  attempts.delete(attemptKey);
  await setSessionCookie({
    id: admin.id,
    name: admin.name,
    role: admin.role as SessionUser["role"],
    organizationId: organization.id,
    organizationSlug: organization.slug,
  });
  await writeAudit(prisma, {
    organizationId: admin.organizationId,
    branchId: admin.branchId,
    userId: admin.id,
    action: "ADMIN_ACCESS",
    entity: "User",
    entityId: admin.id,
  });
  return { ok: true as const, name: admin.name };
}

export async function registerPracticeAction(formData: FormData) {
  if (await getSession()) redirect("/home");
  const name = text(formData, "practiceName");
  const adminName = text(formData, "adminName");
  const pin = text(formData, "pin");
  const email = text(formData, "email");
  const phone = text(formData, "phone");
  const address = text(formData, "address");
  const logo = formData.get("clinicLogo");
  if (
    name.length < 2 || adminName.length < 2 || !/^\S+@\S+\.\S+$/.test(email) ||
    phone.length < 5 || address.length < 5 || !isFourDigitPin(pin) ||
    !(logo instanceof File) || logo.size === 0 || logo.size > 5_000_000 ||
    !["image/png", "image/jpeg", "image/webp"].includes(logo.type)
  ) {
    redirect("/register?error=Check%20the%20practice%20details%2C%20logo%2C%20email%2C%20and%204-digit%20PIN.");
  }

  if (!process.env.PAYNOW_INTEGRATION_ID || !process.env.PAYNOW_INTEGRATION_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/register?error=Online%20registration%20is%20not%20configured%20yet.");
  }

  const slugBase = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45).replace(/-$/g, "");
  if (!slugBase) redirect("/register?error=Enter%20a%20valid%20practice%20name.");
  let slug = slugBase;
  for (let suffix = 2; await systemPrisma.organization.findUnique({ where: { slug } }) || await systemPrisma.registrationIntent.findUnique({ where: { slug } }); suffix += 1) {
    slug = `${slugBase}-${suffix}`;
    if (suffix > 100) redirect("/register?error=Could%20not%20reserve%20a%20practice%20URL.");
  }

  const intentId = id();
  const logoPath = `${slug}/clinic-logo`;
  let logoUrl = "";
  try {
    logoUrl = await uploadClinicLogo(logoPath, logo);
    await systemPrisma.registrationIntent.create({
      data: {
        id: intentId,
        slug,
        practiceName: name,
        adminName,
        email,
        phone,
        address,
        pinHash: hashPin(pin),
        logoUrl,
      },
    });
    const paynow = getPaynow(`${appUrl()}/register/success?reference=${encodeURIComponent(intentId)}`);
    const payment = paynow.createPayment(intentId, email);
    payment.add("VetKonnect P.O.S & Management monthly subscription", 5);
    const response = await paynow.send(payment);
    if (!response?.success || !response.redirectUrl || !response.pollUrl) {
      throw new Error(String(response?.error || "Paynow did not return a payment link."));
    }
    await systemPrisma.registrationIntent.update({ where: { id: intentId }, data: { paynowPollUrl: String(response.pollUrl) } });
    redirect(String(response.redirectUrl));
  } catch (error) {
    bubble(error);
    await systemPrisma.registrationIntent.deleteMany({ where: { id: intentId } });
    if (logoUrl) await removeClinicLogo(logoPath).catch(() => undefined);
    redirect("/register?error=Could%20not%20start%20secure%20checkout.%20Please%20try%20again.");
  }
}

export async function setOrganizationStatusAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") throw new Error("Platform admin access required.");
  const platformAdmin = await prisma.user.findUnique({ where: { id: session.id } });
  if (!platformAdmin?.active || platformAdmin.role !== "PLATFORM_ADMIN") throw new Error("Platform admin access required.");
  const organizationId = text(formData, "organizationId");
  const status = text(formData, "status");
  if (!organizationId || !["ACTIVE", "SUSPENDED"].includes(status)) throw new Error("Invalid account update.");
  const target = await systemPrisma.organization.findUnique({ where: { id: organizationId } });
  if (!target || target.slug === "0000000") throw new Error("The platform account cannot be changed here.");
  const organization = await systemPrisma.organization.update({ where: { id: organizationId }, data: { status } });
  await writeAudit(systemPrisma, {
    organizationId: platformAdmin.organizationId,
    branchId: platformAdmin.branchId,
    userId: platformAdmin.id,
    action: "ACCOUNT_STATUS_CHANGED",
    entity: "Organization",
    entityId: organization.id,
    details: { slug: organization.slug, status },
  });
  revalidatePath("/platform");
}

export async function unlockWithPin(pin: string) {
  const user = await actor();
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !verifyPin(pin, row.pinHash)) return { ok: false as const, error: "Incorrect PIN." };
  return { ok: true as const };
}

export async function openNotification(id: string) {
  const user = await actor();
  const note = await prisma.notification.findFirst({ where: { id, userId: user.id } });
  if (!note) redirect("/home");
  if (!note.readAt) {
    await prisma.notification.update({ where: { id: note.id }, data: { readAt: new Date() } });
  }
  revalidatePath("/", "layout");
  redirect(note.href || "/home");
}

export async function signOut() {
  const session = await getSession();
  if (session?.role === "PLATFORM_ADMIN") {
    const user = await prisma.user.findUnique({ where: { id: session.id } });
    await clearSessionCookie();
    if (user) {
      await writeAudit(prisma, {
        organizationId: user.organizationId,
        branchId: user.branchId,
        userId: user.id,
        action: "LOGOUT",
        entity: "User",
        entityId: user.id,
      });
    }
    redirect("/register");
  }
  const user = await actor();
  await clearSessionCookie();
  await writeAudit(prisma, {
    organizationId: user.organizationId,
    branchId: user.branchId,
    userId: user.id,
    action: "LOGOUT",
    entity: "User",
    entityId: user.id,
  });
  redirect("/register");
}

export async function createOwnerAction(formData: FormData) {
  const user = await actor();
  try {
    const owner = await createOwner(user, {
      fullName: text(formData, "fullName"),
      mobile: text(formData, "mobile"),
      altMobile: text(formData, "altMobile"),
      email: text(formData, "email"),
      address: text(formData, "address"),
      notes: text(formData, "notes"),
    });
    redirect(`/owners/${owner.id}`);
  } catch (error) {
    bubble(error);
    redirect(`/owners/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function updateOwnerAction(formData: FormData) {
  const user = await actor();
  const ownerId = text(formData, "ownerId");
  try {
    await updateOwner(user, ownerId, {
      fullName: text(formData, "fullName"),
      mobile: text(formData, "mobile"),
      altMobile: text(formData, "altMobile"),
      email: text(formData, "email"),
      address: text(formData, "address"),
      notes: text(formData, "notes"),
    });
    redirect(`/owners/${ownerId}`);
  } catch (error) {
    bubble(error);
    redirect(`/owners/${ownerId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function createPatientAction(formData: FormData) {
  const user = await actor();
  const ownerId = text(formData, "ownerId");
  try {
    const patient = await createPatient(user, {
      ownerId: ownerId || undefined,
      owner: ownerId
        ? undefined
        : {
            fullName: text(formData, "ownerName"),
            mobile: text(formData, "ownerMobile"),
            altMobile: text(formData, "ownerAlt"),
            email: text(formData, "ownerEmail"),
            address: text(formData, "ownerAddress"),
          },
      name: text(formData, "name"),
      species: text(formData, "species") || "Dog",
      breed: text(formData, "breed"),
      sex: text(formData, "sex") || "Unknown",
      dob: text(formData, "dob"),
      estimatedAge: text(formData, "estimatedAge"),
      colour: text(formData, "colour"),
      weight: num(formData, "weight"),
      microchip: text(formData, "microchip"),
      spayedNeutered: text(formData, "spayedNeutered"),
      identifyingMarks: text(formData, "identifyingMarks"),
      allergies: text(formData, "allergies"),
      clinicalAlerts: text(formData, "clinicalAlerts"),
      notes: text(formData, "notes"),
    });
    redirect(`/patients/${patient.id}`);
  } catch (error) {
    bubble(error);
    redirect(`/patients/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function updatePatientAction(formData: FormData) {
  const user = await actor();
  const patientId = text(formData, "patientId");
  try {
    await updatePatient(user, patientId, {
      name: text(formData, "name"),
      species: text(formData, "species"),
      breed: text(formData, "breed"),
      sex: text(formData, "sex"),
      dob: text(formData, "dob"),
      estimatedAge: text(formData, "estimatedAge"),
      colour: text(formData, "colour"),
      weight: num(formData, "weight"),
      microchip: text(formData, "microchip"),
      spayedNeutered: text(formData, "spayedNeutered"),
      identifyingMarks: text(formData, "identifyingMarks"),
      allergies: text(formData, "allergies"),
      clinicalAlerts: text(formData, "clinicalAlerts"),
      notes: text(formData, "notes"),
      status: text(formData, "status") || "ACTIVE",
    });
    redirect(`/patients/${patientId}`);
  } catch (error) {
    bubble(error);
    redirect(
      `/patients/${patientId}/edit?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`,
    );
  }
}

export async function uploadPhotoAction(formData: FormData) {
  const user = await actor();
  const patientId = text(formData, "patientId");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "Choose a photo." };
  if (file.size > 4_000_000) return { ok: false as const, error: "Use a photo under 4 MB." };
  const ext = file.type.includes("png") ? "png" : file.type.includes("webp") ? "webp" : "jpg";
  ensureDataDirs();
  const relative = `images/patients/${patientId}.${ext}`;
  fs.writeFileSync(path.join(dataRoot, relative), Buffer.from(await file.arrayBuffer()));
  await savePatientPhoto(user, patientId, relative);
  revalidatePath(`/patients/${patientId}`);
  return { ok: true as const };
}

export async function startVisitAction(patientId: string) {
  const user = await actor();
  try {
    const visit = await openVisit(user, patientId);
    redirect(`/visit/${visit.id}`);
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not start the visit." };
  }
}

export async function saveVisitAction(input: {
  visitId: string;
  step?: string;
  veterinarianId?: string | null;
  presentingComplaint?: string;
  history?: string;
  weight?: number | null;
  temperature?: number | null;
  examination?: string;
  treatmentNotes?: string;
  clinicalNotes?: string;
  followUpDate?: string | null;
}) {
  const user = await actor();
  try {
    await saveVisit(user, input);
    return { ok: true as const };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not save." };
  }
}

export async function setServicesAction(visitId: string, serviceIds: string[]) {
  const user = await actor();
  try {
    await setVisitServices(user, visitId, serviceIds);
    revalidatePath(`/visit/${visitId}`);
    return { ok: true as const };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not update services." };
  }
}

export async function addMedicationAction(input: {
  visitId: string;
  medicationId: string;
  batchId: string;
  quantity: number;
  dose?: string;
}) {
  const user = await actor();
  try {
    await addVisitMedication(user, input);
    revalidatePath(`/visit/${input.visitId}`);
    return { ok: true as const };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not add medicine." };
  }
}

export async function removeMedicationAction(visitId: string, lineId: string) {
  const user = await actor();
  try {
    await removeVisitMedication(user, lineId);
    revalidatePath(`/visit/${visitId}`);
    return { ok: true as const };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not remove medicine." };
  }
}

export async function addDiagnosisAction(visitId: string, label: string) {
  const user = await actor();
  try {
    await addDiagnosis(user, visitId, label);
    revalidatePath(`/visit/${visitId}`);
    return { ok: true as const };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not add diagnosis." };
  }
}

export async function confirmVaccinationAction(input: {
  visitId: string;
  lineId: string;
  disease?: string;
  dose?: string;
  nextDue?: string;
}) {
  const user = await actor();
  try {
    await confirmVaccination(user, input);
    revalidatePath(`/visit/${input.visitId}`);
    return { ok: true as const };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not confirm vaccination." };
  }
}

export async function payVisitAction(input: {
  visitId: string;
  method: string;
  received?: number | null;
  reference?: string | null;
}) {
  const user = await actor();
  try {
    const sale = await payVisit(user, input);
    redirect(`/receipts/${sale.id}?auto=1`);
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Payment was not completed." };
  }
}

export async function checkoutAction(input: {
  patientId?: string;
  lines: {
    itemType: "SERVICE" | "MEDICATION" | "PRODUCT" | "CUSTOM";
    itemId?: string;
    batchId?: string | null;
    quantity: number;
    name?: string;
    unitPrice?: number;
  }[];
  method: string;
  received?: number | null;
  reference?: string | null;
}) {
  const user = await actor();
  try {
    const custom = input.lines.filter((line) => line.itemType === "CUSTOM");
    if (custom.length && user.role !== "VET" && user.role !== "SUPER_ADMIN") {
      return { ok: false as const, error: "Only a veterinarian can add a custom consult." };
    }
    for (const line of custom) {
      if (!line.name?.trim()) return { ok: false as const, error: "Name the custom consult." };
      if (line.unitPrice == null || line.unitPrice < 0) return { ok: false as const, error: "Enter the consult fee." };
    }
    const catalog = await buildDirectSaleLines(
      input.lines
        .filter((line) => line.itemType !== "CUSTOM")
        .map((line) => ({
          itemType: line.itemType as "SERVICE" | "MEDICATION" | "PRODUCT",
          itemId: line.itemId || "",
          batchId: line.batchId,
          quantity: line.quantity,
        })),
    );
    const lines = [
      ...catalog,
      ...custom.map((line) => ({
        itemType: "CUSTOM" as const,
        itemId: "",
        name: line.name!.trim(),
        quantity: line.quantity,
        unitPrice: line.unitPrice!,
      })),
    ];
    const patient = input.patientId
      ? await prisma.patient.findUnique({ where: { id: input.patientId } })
      : null;
    const sale = await commitSale(user, {
      lines,
      method: input.method,
      received: input.received,
      reference: input.reference,
      patientId: patient?.id,
      ownerId: patient?.ownerId,
      veterinarianId: user.role === "VET" || user.role === "SUPER_ADMIN" ? user.id : null,
    });
    redirect(`/receipts/${sale.id}?auto=1`);
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Payment was not completed." };
  }
}

export async function refundAction(formData: FormData) {
  const user = await actor();
  const saleId = text(formData, "saleId");
  try {
    await refundSale(user, saleId, text(formData, "reason"));
    redirect(`/sales/${saleId}`);
  } catch (error) {
    bubble(error);
    redirect(`/sales/${saleId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Refund failed")}`);
  }
}

export async function externalVaccineAction(formData: FormData) {
  const user = await actor();
  const patientId = text(formData, "patientId");
  try {
    await recordExternalVaccination(user, {
      patientId,
      vaccineName: text(formData, "vaccineName"),
      disease: text(formData, "disease"),
      batchNumber: text(formData, "batchNumber"),
      clinic: text(formData, "clinic"),
      veterinarian: text(formData, "veterinarian"),
      administeredAt: text(formData, "administeredAt"),
      nextDue: text(formData, "nextDue"),
    });
    redirect(`/patients/${patientId}?tab=vaccines`);
  } catch (error) {
    bubble(error);
    redirect(
      `/patients/${patientId}?tab=vaccines&error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`,
    );
  }
}

export async function prescriptionAction(input: {
  patientId: string;
  visitId?: string;
  notes?: string;
  items: {
    medicationName: string;
    strength?: string;
    dose?: string;
    route?: string;
    frequency?: string;
    duration?: string;
    quantity?: string;
    instructions?: string;
    repeats?: number;
  }[];
}) {
  const user = await actor();
  try {
    const prescription = await createPrescription(user, input);
    redirect(`/prescriptions/${prescription.id}?auto=1`);
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not save the prescription." };
  }
}

export async function receiveAction(formData: FormData) {
  const user = await actor();
  const kind = text(formData, "kind");
  try {
    if (kind === "PRODUCT") {
      await receiveProduct(user, {
        productId: text(formData, "productId"),
        quantity: num(formData, "quantity") ?? 0,
        supplierId: text(formData, "supplierId"),
        costPrice: num(formData, "costPrice"),
        reason: text(formData, "reason"),
      });
    } else {
      await receiveMedication(user, {
        medicationId: text(formData, "medicationId"),
        batchNumber: text(formData, "batchNumber"),
        expiryDate: text(formData, "expiryDate"),
        quantity: num(formData, "quantity") ?? 0,
        supplierId: text(formData, "supplierId"),
        costPrice: num(formData, "costPrice"),
        reason: text(formData, "reason"),
      });
    }
    redirect("/inventory");
  } catch (error) {
    bubble(error);
    redirect(`/inventory/receive?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not receive stock")}`);
  }
}

export async function stockTakeAction(input: {
  itemType: "MEDICATION" | "PRODUCT";
  itemId: string;
  batchId?: string | null;
  actual: number;
  reason: string;
}) {
  const user = await actor();
  try {
    const result = await adjustStock(user, input);
    revalidatePath("/stock-take");
    revalidatePath("/inventory");
    return { ok: true as const, ...result };
  } catch (error) {
    bubble(error);
    return { ok: false as const, error: error instanceof Error ? error.message : "Could not adjust stock." };
  }
}

export async function syncNowAction() {
  await actor();
  const result = await processSyncQueue();
  revalidatePath("/sync");
  revalidatePath("/admin/sync");
  return result;
}

export async function saveUserAction(formData: FormData) {
  const user = await actor();
  try {
    await saveUser(user, {
      userId: text(formData, "userId") || undefined,
      name: text(formData, "name"),
      role: text(formData, "role"),
      pin: text(formData, "pin") || undefined,
      registrationNumber: text(formData, "registrationNumber"),
      active: formData.get("active") === "on",
    });
    redirect("/admin/staff");
  } catch (error) {
    bubble(error);
    redirect(`/admin/staff?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save staff")}`);
  }
}

export async function saveSettingsAction(formData: FormData) {
  const user = await actor();
  try {
    await saveSettings(user, {
      clinicName: text(formData, "clinicName"),
      tagline: text(formData, "tagline"),
      address: text(formData, "address"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      currencySymbol: text(formData, "currencySymbol") || "$",
      lockTimeoutMinutes: num(formData, "lockTimeoutMinutes") ?? 5,
      receiptFooter: text(formData, "receiptFooter"),
      supabaseUrl: text(formData, "supabaseUrl"),
      supabaseKey: text(formData, "supabaseKey"),
      syncEnabled: formData.get("syncEnabled") === "on",
    });
    redirect("/admin/settings?saved=1");
  } catch (error) {
    bubble(error);
    redirect(`/admin/settings?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function savePrinterAction(formData: FormData) {
  const user = await actor();
  try {
    await savePrinter(user, {
      documentType: text(formData, "documentType"),
      name: text(formData, "name"),
      adapter: text(formData, "adapter"),
      target: text(formData, "target"),
    });
    redirect("/admin/printers?saved=1");
  } catch (error) {
    bubble(error);
    redirect(`/admin/printers?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function backupAction() {
  const user = await actor();
  try {
    const file = await backupDatabase(user);
    redirect(`/admin/backups?saved=${encodeURIComponent(file)}`);
  } catch (error) {
    bubble(error);
    redirect(`/admin/backups?error=${encodeURIComponent(error instanceof Error ? error.message : "Backup failed")}`);
  }
}

export async function removeDemoAction() {
  const user = await actor();
  await removeDemoData(user);
  redirect("/admin/settings?cleared=1");
}

export async function saveServiceAction(formData: FormData) {
  const user = await actor();
  try {
    await saveService(user, {
      id: text(formData, "id") || undefined,
      name: text(formData, "name"),
      category: text(formData, "category"),
      price: num(formData, "price") ?? 0,
      taxable: formData.get("taxable") === "on",
      active: formData.get("active") === "on",
      durationMinutes: num(formData, "durationMinutes"),
      notes: text(formData, "notes"),
      medicationId: text(formData, "medicationId") || undefined,
    });
    redirect("/admin/services");
  } catch (error) {
    bubble(error);
    redirect(`/admin/services?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function saveProductAction(formData: FormData) {
  const user = await actor();
  try {
    await saveProduct(user, {
      id: text(formData, "id") || undefined,
      sku: text(formData, "sku"),
      barcode: text(formData, "barcode"),
      name: text(formData, "name"),
      brand: text(formData, "brand"),
      category: text(formData, "category"),
      costPrice: num(formData, "costPrice") ?? 0,
      sellingPrice: num(formData, "sellingPrice") ?? 0,
      reorderLevel: num(formData, "reorderLevel") ?? 0,
      supplierId: text(formData, "supplierId"),
      active: formData.get("active") === "on",
    });
    redirect("/admin/products");
  } catch (error) {
    bubble(error);
    redirect(`/admin/products?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function saveMedicationAction(formData: FormData) {
  const user = await actor();
  try {
    await saveMedication(user, {
      name: text(formData, "name"),
      genericName: text(formData, "genericName"),
      category: text(formData, "category"),
      manufacturer: text(formData, "manufacturer"),
      formulation: text(formData, "formulation"),
      strength: text(formData, "strength"),
      unit: text(formData, "unit") || "dose",
      packSize: text(formData, "packSize"),
      costPrice: num(formData, "costPrice") ?? 0,
      sellingPrice: num(formData, "sellingPrice") ?? 0,
      reorderLevel: num(formData, "reorderLevel") ?? 0,
      supplierId: text(formData, "supplierId"),
      prescriptionRequired: formData.get("prescriptionRequired") === "on",
      active: formData.get("active") === "on",
    });
    redirect("/admin/pharmacy");
  } catch (error) {
    bubble(error);
    redirect(`/admin/pharmacy?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}

export async function saveSupplierAction(formData: FormData) {
  const user = await actor();
  try {
    await saveSupplier(user, {
      name: text(formData, "name"),
      contact: text(formData, "contact"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      address: text(formData, "address"),
      notes: text(formData, "notes"),
    });
    redirect("/admin/suppliers");
  } catch (error) {
    bubble(error);
    redirect(`/admin/suppliers?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save")}`);
  }
}
