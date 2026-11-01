import { isExpired } from "@/lib/dates";
import { id } from "@/lib/ids";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError, toDatabase } from "@/lib/supabase-admin";
import { writeAudit } from "./audit";
import { commitSale, type Actor, type SaleLine } from "./commerce";
import { nextSequence, patientNumber, prescriptionNumber } from "./numbers";
import { quantityOnHand } from "./stock";

type Owner = {
  id: string;
  fullName: string;
  mobile: string;
  ownerId?: string;
};

function org(actor: Actor) {
  return { organizationId: actor.organizationId, branchId: actor.branchId };
}

async function findRow<T>(table: string, organizationId: string, rowId: string) {
  const { data, error } = await supabaseAdmin().from(table).select("*")
    .eq("organization_id", organizationId).eq("id", rowId).maybeSingle();
  throwDatabaseError(error);
  return data ? fromDatabase<T>(data) : null;
}

async function insertRow<T>(table: string, row: unknown) {
  const { data, error } = await supabaseAdmin().from(table).insert(toDatabase(row) as never).select("*").single();
  throwDatabaseError(error);
  return fromDatabase<T>(data);
}

async function notifyVetsOfClient(
  actor: Actor,
  input: { ownerName: string; mobile: string; href: string; patientName?: string },
) {
  if (actor.role === "VET") return;
  const client = supabaseAdmin();
  const { data, error } = await client.from("users").select("id")
    .eq("organization_id", actor.organizationId).eq("branch_id", actor.branchId)
    .eq("role", "VET").eq("active", true);
  throwDatabaseError(error);
  const vets = fromDatabase<{ id: string }[]>(data ?? []);
  if (!vets.length) return;
  const detail = input.patientName
    ? `${actor.name} registered ${input.ownerName} with ${input.patientName}. ${input.mobile}`
    : `${actor.name} registered ${input.ownerName}. ${input.mobile}`;
  const { error: insertError } = await client.from("notifications").insert(toDatabase(vets.map((vet) => ({
    id: id(), ...org(actor), userId: vet.id, title: "New client", body: detail, href: input.href,
  }))) as never);
  throwDatabaseError(insertError);
}

async function repriceLinkedMeds(actor: Actor, visitId: string) {
  const client = supabaseAdmin();
  const [servicesResult, linesResult, suggestionsResult] = await Promise.all([
    client.from("visit_services").select("service_id").eq("organization_id", actor.organizationId).eq("visit_id", visitId),
    client.from("visit_medications").select("id,medication_id,unit_price").eq("organization_id", actor.organizationId).eq("visit_id", visitId),
    client.from("service_suggestions").select("service_id,medication_id").eq("organization_id", actor.organizationId),
  ]);
  for (const result of [servicesResult, linesResult, suggestionsResult]) throwDatabaseError(result.error);
  const services = fromDatabase<{ serviceId: string }[]>(servicesResult.data ?? []);
  const lines = fromDatabase<{ id: string; medicationId: string; unitPrice: number }[]>(linesResult.data ?? []);
  const suggestions = fromDatabase<{ serviceId: string; medicationId: string }[]>(suggestionsResult.data ?? []);
  for (const line of lines) {
    const included = suggestions.some((suggestion) =>
      suggestion.medicationId === line.medicationId && services.some((service) => service.serviceId === suggestion.serviceId),
    );
    if (included && line.unitPrice !== 0) {
      const { error } = await client.from("visit_medications").update({ unit_price: 0 }).eq("organization_id", actor.organizationId).eq("id", line.id);
      throwDatabaseError(error);
    } else if (!included && line.unitPrice === 0) {
      const medication = await findRow<{ sellingPrice: number }>("medications", actor.organizationId, line.medicationId);
      if (medication) {
        const { error } = await client.from("visit_medications").update({ unit_price: medication.sellingPrice })
          .eq("organization_id", actor.organizationId).eq("id", line.id);
        throwDatabaseError(error);
      }
    }
  }
}

export async function createOwner(actor: Actor, input: {
  fullName: string; mobile: string; altMobile?: string; email?: string; address?: string; notes?: string;
}) {
  const fullName = input.fullName.trim();
  const mobile = input.mobile.trim();
  if (fullName.length < 2) throw new Error("Enter the owner's name.");
  if (mobile.length < 7) throw new Error("Enter a mobile number.");
  const owner = await insertRow<Owner>("owners", {
    id: id(), ...org(actor), fullName, mobile, altMobile: input.altMobile?.trim() || null,
    email: input.email?.trim() || null, address: input.address?.trim() || null, notes: input.notes?.trim() || null,
  });
  await writeAudit({ ...org(actor), userId: actor.id, action: "OWNER_CREATED", entity: "Owner", entityId: owner.id, details: { fullName } });
  await notifyVetsOfClient(actor, { ownerName: fullName, mobile, href: `/owners/${owner.id}` });
  return owner;
}

export async function updateOwner(actor: Actor, ownerId: string, input: {
  fullName: string; mobile: string; altMobile?: string; email?: string; address?: string; notes?: string;
}) {
  const { data, error } = await supabaseAdmin().from("owners").update(toDatabase({
    fullName: input.fullName.trim(), mobile: input.mobile.trim(), altMobile: input.altMobile?.trim() || null,
    email: input.email?.trim() || null, address: input.address?.trim() || null, notes: input.notes?.trim() || null,
  }) as never).eq("organization_id", actor.organizationId).eq("id", ownerId).select("*").single();
  throwDatabaseError(error);
  const owner = fromDatabase<Owner>(data);
  await writeAudit({ ...org(actor), userId: actor.id, action: "OWNER_EDITED", entity: "Owner", entityId: owner.id });
  return owner;
}

export async function createPatient(actor: Actor, input: {
  ownerId?: string;
  owner?: { fullName: string; mobile: string; altMobile?: string; email?: string; address?: string };
  name: string; species: string; breed?: string; sex: string; dob?: string; estimatedAge?: string;
  colour?: string; weight?: number | null; microchip?: string; spayedNeutered?: string;
  identifyingMarks?: string; allergies?: string; clinicalAlerts?: string; notes?: string;
}) {
  let ownerId = input.ownerId;
  let newOwner: { fullName: string; mobile: string } | null = null;
  if (!ownerId) {
    if (!input.owner) throw new Error("Choose or create an owner.");
    const fullName = input.owner.fullName.trim();
    const mobile = input.owner.mobile.trim();
    if (fullName.length < 2 || mobile.length < 7) throw new Error("Owner name and mobile are required.");
    const owner = await insertRow<Owner>("owners", {
      id: id(), ...org(actor), fullName, mobile, altMobile: input.owner.altMobile?.trim() || null,
      email: input.owner.email?.trim() || null, address: input.owner.address?.trim() || null,
    });
    ownerId = owner.id;
    newOwner = { fullName, mobile };
  }
  const name = input.name.trim();
  if (!name) throw new Error("Enter the patient's name.");
  const number = patientNumber(await nextSequence(actor.organizationId, "PATIENT"));
  const patient = await insertRow<{ id: string; patientNumber: string }>("patients", {
    id: id(), ...org(actor), patientNumber: number, ownerId, name, species: input.species,
    breed: input.breed?.trim() || null, sex: input.sex, dob: input.dob ? new Date(input.dob) : null,
    estimatedAge: input.estimatedAge?.trim() || null, colour: input.colour?.trim() || null,
    weight: input.weight ?? null, microchip: input.microchip?.trim() || null,
    spayedNeutered: input.spayedNeutered || null, identifyingMarks: input.identifyingMarks?.trim() || null,
    allergies: input.allergies?.trim() || null, clinicalAlerts: input.clinicalAlerts?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  await writeAudit({
    ...org(actor), userId: actor.id, action: "PATIENT_CREATED", entity: "Patient",
    entityId: patient.id, details: { name, patientNumber: number },
  });
  if (newOwner) {
    await notifyVetsOfClient(actor, {
      ownerName: newOwner.fullName, mobile: newOwner.mobile, patientName: name, href: `/patients/${patient.id}`,
    });
  }
  return patient;
}

export async function updatePatient(actor: Actor, patientId: string, input: {
  name: string; species: string; breed?: string; sex: string; dob?: string; estimatedAge?: string;
  colour?: string; weight?: number | null; microchip?: string; spayedNeutered?: string;
  identifyingMarks?: string; allergies?: string; clinicalAlerts?: string; notes?: string; status: string;
}) {
  const { data, error } = await supabaseAdmin().from("patients").update(toDatabase({
    name: input.name.trim(), species: input.species, breed: input.breed?.trim() || null, sex: input.sex,
    dob: input.dob ? new Date(input.dob) : null, estimatedAge: input.estimatedAge?.trim() || null,
    colour: input.colour?.trim() || null, weight: input.weight ?? null, microchip: input.microchip?.trim() || null,
    spayedNeutered: input.spayedNeutered || null, identifyingMarks: input.identifyingMarks?.trim() || null,
    allergies: input.allergies?.trim() || null, clinicalAlerts: input.clinicalAlerts?.trim() || null,
    notes: input.notes?.trim() || null, status: input.status,
  }) as never).eq("organization_id", actor.organizationId).eq("id", patientId).select("*").single();
  throwDatabaseError(error);
  const patient = fromDatabase<{ id: string }>(data);
  await writeAudit({ ...org(actor), userId: actor.id, action: "PATIENT_EDITED", entity: "Patient", entityId: patient.id });
  return patient;
}

export async function savePatientPhoto(actor: Actor, patientId: string, relativePath: string) {
  const { data, error } = await supabaseAdmin().from("patients").update({ photo_path: relativePath })
    .eq("organization_id", actor.organizationId).eq("id", patientId).select("id").maybeSingle();
  throwDatabaseError(error);
  if (!data) throw new Error("Patient not found.");
  await writeAudit({
    ...org(actor), userId: actor.id, action: "PATIENT_EDITED", entity: "Patient", entityId: patientId, details: { photo: true },
  });
}

export async function openVisit(actor: Actor, patientId: string) {
  const patient = await findRow<{ id: string; status: string; ownerId: string; weight: number | null }>("patients", actor.organizationId, patientId);
  if (!patient) throw new Error("Patient not found.");
  if (patient.status === "DECEASED") throw new Error("This patient is marked deceased.");
  const { data: existingData, error: existingError } = await supabaseAdmin().from("visits").select("*")
    .eq("organization_id", actor.organizationId).eq("patient_id", patientId).eq("status", "DRAFT")
    .order("updated_at", { ascending: false }).limit(1);
  throwDatabaseError(existingError);
  if (existingData?.length) return fromDatabase<{ id: string }>(existingData[0]);
  const visit = await insertRow<{ id: string }>("visits", {
    id: id(), ...org(actor), patientId, ownerId: patient.ownerId,
    veterinarianId: actor.role === "VET" || actor.role === "SUPER_ADMIN" ? actor.id : null,
    createdById: actor.id, status: "DRAFT", step: "Service", weight: patient.weight,
  });
  await writeAudit({
    ...org(actor), userId: actor.id, action: "CONSULTATION", entity: "Visit", entityId: visit.id,
    details: { patientId, draft: true },
  });
  return visit;
}

export async function saveVisit(actor: Actor, input: {
  visitId: string; step?: string; veterinarianId?: string | null; presentingComplaint?: string; history?: string;
  weight?: number | null; temperature?: number | null; examination?: string; treatmentNotes?: string;
  clinicalNotes?: string; followUpDate?: string | null;
}) {
  const visit = await findRow<{ id: string; status: string; patientId: string }>("visits", actor.organizationId, input.visitId);
  if (!visit) throw new Error("Visit not found.");
  if (visit.status !== "DRAFT") throw new Error("This visit is already complete.");
  const values: Record<string, unknown> = {};
  if (input.step) values.step = input.step;
  if (input.veterinarianId !== undefined) values.veterinarianId = input.veterinarianId || null;
  if (input.presentingComplaint !== undefined) values.presentingComplaint = input.presentingComplaint.trim() || null;
  if (input.history !== undefined) values.history = input.history.trim() || null;
  if (input.weight !== undefined) values.weight = input.weight;
  if (input.temperature !== undefined) values.temperature = input.temperature;
  if (input.examination !== undefined) values.examination = input.examination.trim() || null;
  if (input.treatmentNotes !== undefined) values.treatmentNotes = input.treatmentNotes.trim() || null;
  if (input.clinicalNotes !== undefined) values.clinicalNotes = input.clinicalNotes.trim() || null;
  if (input.followUpDate !== undefined) values.followUpDate = input.followUpDate ? new Date(input.followUpDate) : null;
  const { data, error } = await supabaseAdmin().from("visits").update(toDatabase(values) as never)
    .eq("organization_id", actor.organizationId).eq("id", visit.id).eq("status", "DRAFT").select("*").single();
  throwDatabaseError(error);
  if (input.weight) {
    const { error: patientError } = await supabaseAdmin().from("patients").update({ weight: input.weight })
      .eq("organization_id", actor.organizationId).eq("id", visit.patientId);
    throwDatabaseError(patientError);
  }
  return fromDatabase(data);
}

export async function setVisitServices(actor: Actor, visitId: string, serviceIds: string[]) {
  const visit = await findRow<{ id: string; status: string }>("visits", actor.organizationId, visitId);
  if (!visit || visit.status !== "DRAFT") throw new Error("This visit cannot be changed.");
  const unique = [...new Set(serviceIds)];
  const client = supabaseAdmin();
  const { error: deleteError } = await client.from("visit_services").delete()
    .eq("organization_id", actor.organizationId).eq("visit_id", visitId);
  throwDatabaseError(deleteError);
  if (!unique.length) return [];
  const { data: serviceRows, error: servicesError } = await client.from("services").select("id,name,price")
    .eq("organization_id", actor.organizationId).eq("active", true).in("id", unique);
  throwDatabaseError(servicesError);
  const services = fromDatabase<{ id: string; name: string; price: number }[]>(serviceRows ?? []);
  if (!services.length) return [];
  const { data, error } = await client.from("visit_services").insert(toDatabase(services.map((service) => ({
    id: id(), organizationId: actor.organizationId, visitId, serviceId: service.id, name: service.name, price: service.price, quantity: 1,
  }))) as never).select("*");
  throwDatabaseError(error);
  await repriceLinkedMeds(actor, visitId);
  return fromDatabase(data ?? []);
}

export async function addVisitMedication(actor: Actor, input: {
  visitId: string; medicationId: string; batchId: string; quantity: number; dose?: string; instructions?: string;
}) {
  const visit = await findRow<{ id: string; status: string }>("visits", actor.organizationId, input.visitId);
  if (!visit || visit.status !== "DRAFT") throw new Error("This visit cannot be changed.");
  const [medication, batch] = await Promise.all([
    findRow<{ id: string; name: string; sellingPrice: number }>("medications", actor.organizationId, input.medicationId),
    findRow<{ id: string; medicationId: string; batchNumber: string; expiryDate: Date }>("medication_batches", actor.organizationId, input.batchId),
  ]);
  if (!medication || !batch || batch.medicationId !== medication.id) throw new Error("Choose a medicine and batch.");
  if (isExpired(batch.expiryDate)) throw new Error(`${medication.name} batch ${batch.batchNumber} is expired and cannot be dispensed.`);
  const onHand = await quantityOnHand("MEDICATION", medication.id, batch.id);
  if (onHand < input.quantity) throw new Error(`Only ${onHand} remaining in batch ${batch.batchNumber}.`);
  const { data: serviceRows, error: serviceError } = await supabaseAdmin().from("visit_services").select("service_id")
    .eq("organization_id", actor.organizationId).eq("visit_id", visit.id);
  throwDatabaseError(serviceError);
  const serviceIds = fromDatabase<{ serviceId: string }[]>(serviceRows ?? []).map((row) => row.serviceId);
  let included = false;
  if (serviceIds.length) {
    const { data, error } = await supabaseAdmin().from("service_suggestions").select("service_id")
      .eq("organization_id", actor.organizationId).eq("medication_id", medication.id).in("service_id", serviceIds).limit(1);
    throwDatabaseError(error);
    included = Boolean(data?.length);
  }
  return insertRow("visit_medications", {
    id: id(), organizationId: actor.organizationId, visitId: visit.id, medicationId: medication.id, batchId: batch.id,
    name: `${medication.name} · ${batch.batchNumber}`, quantity: input.quantity, unitPrice: included ? 0 : medication.sellingPrice,
    dose: input.dose?.trim() || null, instructions: input.instructions?.trim() || null,
  });
}

export async function removeVisitMedication(actor: Actor, lineId: string) {
  const line = await findRow<{ id: string; dispensed: boolean }>("visit_medications", actor.organizationId, lineId);
  if (!line) return;
  if (line.dispensed) throw new Error("This dose is already confirmed.");
  const { error } = await supabaseAdmin().from("visit_medications").delete()
    .eq("organization_id", actor.organizationId).eq("id", lineId);
  throwDatabaseError(error);
}

export async function addDiagnosis(actor: Actor, visitId: string, label: string) {
  const name = label.trim();
  if (!name) throw new Error("Enter a diagnosis.");
  const visit = await findRow<{ id: string; patientId: string; status: string; veterinarianId: string | null }>("visits", actor.organizationId, visitId);
  if (!visit || visit.status !== "DRAFT") throw new Error("This visit cannot be changed.");
  const vetId = visit.veterinarianId || (actor.role === "VET" ? actor.id : null);
  if (!vetId) throw new Error("Choose the veterinarian first.");
  const row = await insertRow<{ id: string }>("diagnoses", {
    id: id(), ...org(actor), visitId, patientId: visit.patientId, label: name, veterinarianId: vetId,
  });
  const { error } = await supabaseAdmin().from("timeline_events").insert(toDatabase({
    id: id(), organizationId: actor.organizationId, patientId: visit.patientId, visitId,
    eventType: "DIAGNOSIS", title: name, summary: "Diagnosis", occurredAt: new Date(),
    veterinarianId: vetId, relatedType: "Diagnosis", relatedId: row.id,
  }) as never);
  throwDatabaseError(error);
  return row;
}

export async function confirmVaccination(actor: Actor, input: {
  visitId: string; lineId: string; disease?: string; dose?: string; nextDue?: string; administeredAt?: string;
}) {
  const visit = await findRow<{ id: string; patientId: string; status: string; veterinarianId: string | null }>("visits", actor.organizationId, input.visitId);
  if (!visit || visit.status === "CANCELLED") throw new Error("Visit not found.");
  const line = await findRow<{ id: string; visitId: string; dispensed: boolean; batchId: string | null; medicationId: string; quantity: number; dose: string | null }>("visit_medications", actor.organizationId, input.lineId);
  if (!line || line.visitId !== visit.id) throw new Error("Medication line not found.");
  if (line.dispensed) throw new Error("This vaccination is already confirmed.");
  if (!line.batchId) throw new Error("Select the vaccine batch.");
  const vetId = visit.veterinarianId || (actor.role === "VET" || actor.role === "SUPER_ADMIN" ? actor.id : null);
  if (!vetId) throw new Error("Choose the veterinarian before confirming the vaccination.");
  const [batch, medication] = await Promise.all([
    findRow<{ id: string; medicationId: string; batchNumber: string; expiryDate: Date }>("medication_batches", actor.organizationId, line.batchId),
    findRow<{ id: string; name: string }>("medications", actor.organizationId, line.medicationId),
  ]);
  if (!batch || !medication || batch.medicationId !== medication.id) throw new Error("Batch not found.");
  if (isExpired(batch.expiryDate)) throw new Error(`Batch ${batch.batchNumber} is expired and cannot be dispensed.`);
  const onHand = await quantityOnHand("MEDICATION", line.medicationId, batch.id);
  if (onHand < line.quantity) throw new Error(`Only ${onHand} remaining in batch ${batch.batchNumber}.`);
  const when = input.administeredAt ? new Date(input.administeredAt) : new Date();
  const vaccination = await insertRow<{ id: string }>("vaccinations", {
    id: id(), ...org(actor), patientId: visit.patientId, visitId: visit.id, vaccineName: medication.name,
    disease: input.disease?.trim() || medication.name, medicationId: line.medicationId, batchId: batch.id,
    batchNumber: batch.batchNumber, expiryDate: batch.expiryDate, dose: input.dose?.trim() || line.dose || `${line.quantity}`,
    administeredAt: when, nextDue: input.nextDue ? new Date(input.nextDue) : null, veterinarianId: vetId,
  });
  const movementId = id();
  const { error: movementError } = await supabaseAdmin().from("stock_movements").insert(toDatabase({
    id: movementId, ...org(actor), itemType: "MEDICATION", itemId: line.medicationId, batchId: batch.id,
    quantity: -line.quantity, movementType: "DISPENSED", relatedType: "VACCINATION", relatedId: vaccination.id,
    userId: actor.id, reason: `Vaccination ${batch.batchNumber}`,
  }) as never);
  throwDatabaseError(movementError);
  const { error: lineError } = await supabaseAdmin().from("visit_medications").update(toDatabase({
    dispensed: true, vaccinationId: vaccination.id, dose: input.dose?.trim() || line.dose,
  }) as never).eq("organization_id", actor.organizationId).eq("id", line.id);
  throwDatabaseError(lineError);
  if (!visit.veterinarianId) {
    const { error } = await supabaseAdmin().from("visits").update({ veterinarian_id: vetId })
      .eq("organization_id", actor.organizationId).eq("id", visit.id);
    throwDatabaseError(error);
  }
  const { error: timelineError } = await supabaseAdmin().from("timeline_events").insert(toDatabase({
    id: id(), organizationId: actor.organizationId, patientId: visit.patientId, visitId: visit.id,
    eventType: "VACCINATION", title: medication.name, summary: `Batch ${batch.batchNumber}`, occurredAt: when,
    veterinarianId: vetId, relatedType: "Vaccination", relatedId: vaccination.id,
  }) as never);
  throwDatabaseError(timelineError);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "VACCINATION", entity: "Vaccination", entityId: vaccination.id,
    details: { batch: batch.batchNumber, quantity: line.quantity, veterinarianId: vetId },
  });
  return vaccination;
}

export async function recordExternalVaccination(actor: Actor, input: {
  patientId: string; vaccineName: string; disease?: string; batchNumber?: string; clinic: string;
  veterinarian: string; administeredAt: string; nextDue?: string;
}) {
  if (!input.vaccineName.trim() || !input.clinic.trim() || !input.veterinarian.trim() || !input.administeredAt) {
    throw new Error("Clinic, veterinarian, vaccine and date are required.");
  }
  const patient = await findRow<{ id: string }>("patients", actor.organizationId, input.patientId);
  if (!patient) throw new Error("Patient not found.");
  const vaccination = await insertRow<{ id: string }>("vaccinations", {
    id: id(), ...org(actor), patientId: patient.id, vaccineName: input.vaccineName.trim(),
    disease: input.disease?.trim() || null, batchNumber: input.batchNumber?.trim() || null,
    administeredAt: new Date(input.administeredAt), nextDue: input.nextDue ? new Date(input.nextDue) : null,
    administeredElsewhere: true, externalClinic: input.clinic.trim(), externalVeterinarian: input.veterinarian.trim(),
  });
  const { error } = await supabaseAdmin().from("timeline_events").insert(toDatabase({
    id: id(), organizationId: actor.organizationId, patientId: patient.id, eventType: "VACCINATION",
    title: `${input.vaccineName.trim()} (elsewhere)`, summary: input.clinic.trim(),
    occurredAt: new Date(input.administeredAt), relatedType: "Vaccination", relatedId: vaccination.id,
  }) as never);
  throwDatabaseError(error);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "VACCINATION", entity: "Vaccination", entityId: vaccination.id,
    details: { external: true },
  });
  return vaccination;
}

export async function payVisit(actor: Actor, input: {
  visitId: string; method: string; received?: number | null; reference?: string | null;
}) {
  const visit = await findRow<{
    id: string; status: string; patientId: string; ownerId: string; veterinarianId: string | null;
    presentingComplaint: string | null; treatmentNotes: string | null; weight: number | null;
  }>("visits", actor.organizationId, input.visitId);
  if (!visit) throw new Error("Visit not found.");
  if (visit.status === "COMPLETED") throw new Error("This visit is already paid.");
  const client = supabaseAdmin();
  const [serviceResult, medicationResult, diagnosisResult] = await Promise.all([
    client.from("visit_services").select("*").eq("organization_id", actor.organizationId).eq("visit_id", visit.id),
    client.from("visit_medications").select("*").eq("organization_id", actor.organizationId).eq("visit_id", visit.id),
    client.from("diagnoses").select("label").eq("organization_id", actor.organizationId).eq("visit_id", visit.id).order("created_at").limit(1),
  ]);
  for (const result of [serviceResult, medicationResult, diagnosisResult]) throwDatabaseError(result.error);
  const services = fromDatabase<{ serviceId: string; name: string; quantity: number; price: number }[]>(serviceResult.data ?? []);
  const medications = fromDatabase<{
    medicationId: string; batchId: string | null; name: string; quantity: number; unitPrice: number; dispensed: boolean;
  }[]>(medicationResult.data ?? []);
  const diagnoses = fromDatabase<{ label: string }[]>(diagnosisResult.data ?? []);
  const lines: SaleLine[] = [
    ...services.map((service) => ({
      itemType: "SERVICE" as const, itemId: service.serviceId, name: service.name, quantity: service.quantity, unitPrice: service.price,
    })),
    ...medications.map((medication) => ({
      itemType: "MEDICATION" as const, itemId: medication.medicationId, batchId: medication.batchId,
      name: medication.name, quantity: medication.quantity, unitPrice: medication.unitPrice, skipStock: medication.dispensed,
    })),
  ];
  if (!lines.length) throw new Error("Add a service or medicine before taking payment.");
  const vetId = visit.veterinarianId || (actor.role === "VET" || actor.role === "SUPER_ADMIN" ? actor.id : null);
  const sale = await commitSale(actor, {
    lines, method: input.method, received: input.received, reference: input.reference,
    patientId: visit.patientId, ownerId: visit.ownerId, visitId: visit.id, veterinarianId: vetId,
    timelineTitle: diagnoses[0]?.label ? `Consultation · ${diagnoses[0].label}` : "Consultation",
    timelineSummary: [visit.presentingComplaint, services.map((service) => service.name).join(", ")].filter(Boolean).join(" · "),
  });
  if (visit.weight) {
    const { error } = await client.from("patients").update({ weight: visit.weight })
      .eq("organization_id", actor.organizationId).eq("id", visit.patientId);
    throwDatabaseError(error);
  }
  if (visit.treatmentNotes) {
    const { error } = await client.from("timeline_events").insert(toDatabase({
      id: id(), organizationId: actor.organizationId, patientId: visit.patientId, visitId: visit.id,
      eventType: "TREATMENT", title: "Treatment", summary: visit.treatmentNotes.slice(0, 180),
      occurredAt: new Date(), veterinarianId: vetId, relatedType: "Visit", relatedId: visit.id,
    }) as never);
    throwDatabaseError(error);
  }
  return sale;
}

export async function createPrescription(actor: Actor, input: {
  patientId: string; visitId?: string | null; notes?: string;
  items: {
    medicationId?: string; medicationName: string; strength?: string; dose?: string; route?: string;
    frequency?: string; duration?: string; quantity?: string; instructions?: string; repeats?: number;
  }[];
}) {
  if (actor.role !== "VET" && actor.role !== "SUPER_ADMIN") throw new Error("A veterinarian must sign the prescription.");
  const items = input.items.filter((item) => item.medicationName.trim());
  if (!items.length) throw new Error("Add at least one medicine.");
  const patient = await findRow<{ id: string; ownerId: string }>("patients", actor.organizationId, input.patientId);
  if (!patient) throw new Error("Patient not found.");
  const number = prescriptionNumber(await nextSequence(actor.organizationId, "PRESCRIPTION"));
  const prescription = await insertRow<{ id: string }>("prescriptions", {
    id: id(), ...org(actor), number, patientId: patient.id, ownerId: patient.ownerId,
    visitId: input.visitId || null, veterinarianId: actor.id, notes: input.notes?.trim() || null,
  });
  const itemRows = items.map((item) => ({
    id: id(), organizationId: actor.organizationId, prescriptionId: prescription.id,
    medicationId: item.medicationId || null, medicationName: item.medicationName.trim(),
    strength: item.strength?.trim() || null, dose: item.dose?.trim() || null, route: item.route?.trim() || null,
    frequency: item.frequency?.trim() || null, duration: item.duration?.trim() || null,
    quantity: item.quantity?.trim() || null, instructions: item.instructions?.trim() || null, repeats: item.repeats ?? 0,
  }));
  const { error: itemsError } = await supabaseAdmin().from("prescription_items").insert(toDatabase(itemRows) as never);
  throwDatabaseError(itemsError);
  const { error: timelineError } = await supabaseAdmin().from("timeline_events").insert(toDatabase({
    id: id(), organizationId: actor.organizationId, patientId: patient.id, visitId: input.visitId || null,
    eventType: "PRESCRIPTION", title: number, summary: items.map((item) => item.medicationName.trim()).join(", "),
    occurredAt: new Date(), veterinarianId: actor.id, relatedType: "Prescription", relatedId: prescription.id,
  }) as never);
  throwDatabaseError(timelineError);
  await writeAudit({
    ...org(actor), userId: actor.id, action: "PRESCRIPTION", entity: "Prescription", entityId: prescription.id, details: { number },
  });
  return { ...prescription, number };
}

export async function buildDirectSaleLines(
  lines: { itemType: "SERVICE" | "MEDICATION" | "PRODUCT"; itemId: string; batchId?: string | null; quantity: number }[],
) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to create a sale.");
  const resolved: SaleLine[] = [];
  for (const line of lines) {
    if (line.itemType === "SERVICE") {
      const service = await findRow<{ id: string; name: string; price: number; active: boolean }>("services", session.organizationId, line.itemId);
      if (!service || !service.active) throw new Error("A service is no longer available.");
      resolved.push({ itemType: "SERVICE", itemId: service.id, name: service.name, quantity: line.quantity, unitPrice: service.price });
    } else if (line.itemType === "MEDICATION") {
      if (!line.batchId) throw new Error("Choose a medicine batch.");
      const [medication, batch] = await Promise.all([
        findRow<{ id: string; name: string; sellingPrice: number; active: boolean }>("medications", session.organizationId, line.itemId),
        findRow<{ id: string; medicationId: string; batchNumber: string }>("medication_batches", session.organizationId, line.batchId),
      ]);
      if (!medication?.active || !batch || batch.medicationId !== medication.id) throw new Error("Choose a medicine batch.");
      resolved.push({
        itemType: "MEDICATION", itemId: medication.id, batchId: batch.id,
        name: `${medication.name} · ${batch.batchNumber}`, quantity: line.quantity, unitPrice: medication.sellingPrice,
      });
    } else {
      const product = await findRow<{ id: string; name: string; sellingPrice: number; active: boolean }>("products", session.organizationId, line.itemId);
      if (!product || !product.active) throw new Error("A product is no longer available.");
      resolved.push({ itemType: "PRODUCT", itemId: product.id, name: product.name, quantity: line.quantity, unitPrice: product.sellingPrice });
    }
  }
  return resolved;
}
