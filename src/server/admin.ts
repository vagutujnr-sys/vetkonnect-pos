import { id } from "@/lib/ids";
import { hashPin, isFourDigitPin, verifyPin } from "@/lib/pin";
import { supabaseAdmin, throwDatabaseError, fromDatabase, toDatabase } from "@/lib/supabase-admin";
import { writeAudit } from "./audit";
import type { Actor } from "./commerce";

function org(actor: Actor) {
  return { organizationId: actor.organizationId, branchId: actor.branchId };
}

export async function saveUser(
  actor: Actor,
  input: {
    userId?: string;
    name: string;
    role: string;
    pin?: string;
    registrationNumber?: string;
    active: boolean;
  },
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can manage staff.");
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Enter the staff member's name.");
  if (!["ADMIN", "VET", "SUPER_ADMIN"].includes(input.role)) throw new Error("Choose a role.");
  const client = supabaseAdmin();
  const { data: rawUserRows, error: usersError } = await client.from("users")
    .select("id,pin_hash").eq("organization_id", actor.organizationId);
  throwDatabaseError(usersError);
  const userRows = fromDatabase<{ id: string; pinHash: string }[]>(rawUserRows ?? []);
  if (input.pin) {
    if (!isFourDigitPin(input.pin)) throw new Error("PIN must be 4 digits.");
    if (userRows.some((user) => user.id !== input.userId && verifyPin(input.pin!, user.pinHash))) {
      throw new Error("That PIN is already assigned in this practice.");
    }
  }
  if (input.userId === actor.id && !input.active) throw new Error("You cannot deactivate your own account.");
  const values = {
    name,
    role: input.role,
    active: input.active,
    registrationNumber: input.registrationNumber?.trim() || null,
    ...(input.pin ? { pinHash: hashPin(input.pin) } : {}),
  };
  let result;
  if (input.userId) {
    const { data, error } = await client.from("users").update(toDatabase(values) as never)
      .eq("organization_id", actor.organizationId).eq("id", input.userId).select("*").single();
    throwDatabaseError(error);
    result = data;
  } else {
    if (!input.pin || !isFourDigitPin(input.pin)) throw new Error("PIN must be 4 digits.");
    const { data, error } = await client.from("users").insert(toDatabase({
      id: id(), ...org(actor), ...values, pinHash: hashPin(input.pin),
    }) as never).select("*").single();
    throwDatabaseError(error);
    result = data;
  }
  const user = fromDatabase<{ id: string; name: string; role: string; active: boolean }>(result);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "SETTINGS_CHANGE", entity: "User", entityId: user.id,
    details: { name, role: input.role, active: input.active, pinChanged: Boolean(input.pin) },
  });
  return user;
}

export async function saveSettings(
  actor: Actor,
  input: {
    clinicName: string;
    tagline: string;
    address: string;
    phone: string;
    email: string;
    currencySymbol: string;
    lockTimeoutMinutes: number;
    receiptFooter?: string;
  },
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can change clinic settings.");
  const values = {
    clinicName: input.clinicName.trim(),
    tagline: input.tagline.trim(),
    address: input.address.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    currencySymbol: input.currencySymbol.trim() || "$",
    lockTimeoutMinutes: Math.min(60, Math.max(1, input.lockTimeoutMinutes || 5)),
    receiptFooter: input.receiptFooter?.trim() || null,
  };
  const { data, error } = await supabaseAdmin().from("clinic_settings").update(toDatabase(values) as never)
    .eq("organization_id", actor.organizationId).select("*").single();
  throwDatabaseError(error);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "SETTINGS_CHANGE", entity: "ClinicSettings", entityId: "clinic",
  });
  return fromDatabase(data);
}

export async function savePrinter(
  actor: Actor,
  input: { documentType: string; name: string; adapter: string; target?: string },
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can configure printers.");
  const { data, error } = await supabaseAdmin().from("printer_configs").upsert(toDatabase({
    id: id(), ...org(actor), documentType: input.documentType, name: input.name.trim(),
    adapter: input.adapter, target: input.target?.trim() || null, isDefault: true,
  }) as never, { onConflict: "branch_id,document_type" }).select("*").single();
  throwDatabaseError(error);
  const printer = fromDatabase<{ id: string }>(data);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "SETTINGS_CHANGE", entity: "PrinterConfig",
    entityId: printer.id, details: { documentType: input.documentType, adapter: input.adapter },
  });
  return printer;
}

export async function backupDatabase(actor: Actor): Promise<never> {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can create backups.");
  throw new Error("Database backups are managed in the Supabase Dashboard.");
}

export async function listBackups() {
  return [];
}

export async function removeDemoData(actor: Actor) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can remove training data.");
  const { error } = await supabaseAdmin().rpc("remove_demo_data", {
    p_organization_id: actor.organizationId,
    p_branch_id: actor.branchId,
  });
  throwDatabaseError(error);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "SETTINGS_CHANGE", entity: "DemoData", details: { removed: true },
  });
}

export async function saveService(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    category: string;
    price: number;
    taxable: boolean;
    active: boolean;
    durationMinutes?: number | null;
    notes?: string;
    medicationId?: string;
  },
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can edit services.");
  const name = input.name.trim();
  if (!name) throw new Error("Enter a service name.");
  const values = {
    ...(input.id ? {} : { id: id(), ...org(actor) }),
    name,
    category: input.category.trim() || "General",
    price: input.price,
    taxable: input.taxable,
    active: input.active,
    durationMinutes: input.durationMinutes ?? null,
    notes: input.notes?.trim() || null,
  };
  const { data, error } = await supabaseAdmin().from("services").upsert(toDatabase(values) as never).select("*").single();
  throwDatabaseError(error);
  const service = fromDatabase<{ id: string }>(data);
  if (input.medicationId) {
    const { error: suggestionError } = await supabaseAdmin().from("service_suggestions").upsert(toDatabase({
      id: id(), organizationId: actor.organizationId, serviceId: service.id, medicationId: input.medicationId,
    }) as never, { onConflict: "service_id,medication_id" });
    throwDatabaseError(suggestionError);
  }
  await writeAudit({ ...org(actor), userId: actor.id, action: "SETTINGS_CHANGE", entity: "Service", entityId: service.id });
  return service;
}

export async function saveProduct(
  actor: Actor,
  input: {
    id?: string; sku: string; barcode?: string; name: string; brand?: string; category: string;
    costPrice: number; sellingPrice: number; reorderLevel: number; supplierId?: string; active: boolean;
  },
) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "ADMIN") throw new Error("You cannot edit products.");
  const values = {
    ...(input.id ? {} : { id: id(), ...org(actor) }),
    sku: input.sku.trim(), barcode: input.barcode?.trim() || null, name: input.name.trim(),
    brand: input.brand?.trim() || null, category: input.category, costPrice: input.costPrice,
    sellingPrice: input.sellingPrice, reorderLevel: input.reorderLevel, supplierId: input.supplierId || null,
    active: input.active,
  };
  const { data, error } = await supabaseAdmin().from("products").upsert(toDatabase(values) as never).select("*").single();
  throwDatabaseError(error);
  const product = fromDatabase<{ id: string }>(data);
  return product;
}

export async function saveMedication(
  actor: Actor,
  input: {
    id?: string; name: string; genericName?: string; category: string; manufacturer?: string; formulation?: string;
    strength?: string; unit: string; packSize?: string; costPrice: number; sellingPrice: number; reorderLevel: number;
    supplierId?: string; prescriptionRequired: boolean; active: boolean;
  },
) {
  if (actor.role !== "SUPER_ADMIN" && actor.role !== "VET") throw new Error("You cannot edit medicines.");
  const values = {
    ...(input.id ? {} : { id: id(), ...org(actor) }),
    name: input.name.trim(), genericName: input.genericName?.trim() || null,
    category: input.category.trim() || "Medicine", manufacturer: input.manufacturer?.trim() || null,
    formulation: input.formulation?.trim() || null, strength: input.strength?.trim() || null,
    unit: input.unit.trim() || "dose", packSize: input.packSize?.trim() || null, costPrice: input.costPrice,
    sellingPrice: input.sellingPrice, reorderLevel: input.reorderLevel, supplierId: input.supplierId || null,
    prescriptionRequired: input.prescriptionRequired, active: input.active,
  };
  const { data, error } = await supabaseAdmin().from("medications").upsert(toDatabase(values) as never).select("*").single();
  throwDatabaseError(error);
  const medication = fromDatabase<{ id: string }>(data);
  return medication;
}

export async function saveSupplier(
  actor: Actor,
  input: { id?: string; name: string; contact?: string; phone?: string; email?: string; address?: string; notes?: string },
) {
  if (actor.role !== "SUPER_ADMIN") throw new Error("Only Super Admin can edit suppliers.");
  const name = input.name.trim();
  if (!name) throw new Error("Enter the supplier name.");
  const values = {
    ...(input.id ? {} : { id: id(), ...org(actor) }),
    name, contact: input.contact?.trim() || null, phone: input.phone?.trim() || null,
    email: input.email?.trim() || null, address: input.address?.trim() || null, notes: input.notes?.trim() || null,
  };
  const { data, error } = await supabaseAdmin().from("suppliers").upsert(toDatabase(values) as never).select("*").single();
  throwDatabaseError(error);
  const supplier = fromDatabase<{ id: string }>(data);
  return supplier;
}
