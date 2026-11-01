import { notFound, redirect } from "next/navigation";
import { VisitWizard } from "@/components/VisitWizard";
import { ageLabel, formatDate, isExpired, isExpiringSoon, toDateInput } from "@/lib/dates";
import { getClinicSettings } from "@/lib/clinic";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { medicationCatalog } from "@/server/queries";

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();
  const client = supabaseAdmin();
  const { data: visitData, error: visitError } = await client.from("visits").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(visitError);
  if (!visitData) notFound();
  const visit = fromDatabase<{
    id: string; status: string; patientId: string; step: string; veterinarianId: string | null;
    presentingComplaint: string | null; history: string | null; weight: number | null; temperature: number | null;
    examination: string | null; treatmentNotes: string | null; clinicalNotes: string | null; followUpDate: Date | null;
  }>(visitData);
  if (visit.status === "COMPLETED") {
    const { data: sale, error } = await client.from("sales").select("id")
      .eq("organization_id", session.organizationId).eq("visit_id", visit.id).maybeSingle();
    throwDatabaseError(error);
    redirect(sale ? `/receipts/${sale.id}` : `/patients/${visit.patientId}`);
  }
  const [patientResult, serviceLinesResult, medicationLinesResult, diagnosesResult, servicesResult,
    suggestionsResult, methodsResult, vetsResult, settings, medicines] = await Promise.all([
    client.from("patients").select("*").eq("organization_id", session.organizationId).eq("id", visit.patientId).maybeSingle(),
    client.from("visit_services").select("*").eq("organization_id", session.organizationId).eq("visit_id", visit.id),
    client.from("visit_medications").select("*").eq("organization_id", session.organizationId).eq("visit_id", visit.id),
    client.from("diagnoses").select("*").eq("organization_id", session.organizationId).eq("visit_id", visit.id),
    client.from("services").select("*").eq("organization_id", session.organizationId).eq("active", true).order("name"),
    client.from("service_suggestions").select("service_id,medication_id").eq("organization_id", session.organizationId),
    client.from("payment_methods").select("name").eq("organization_id", session.organizationId).or("active.eq.true,name.eq.VKWallet").order("sort_order"),
    client.from("users").select("id,name").eq("organization_id", session.organizationId).eq("active", true).in("role", ["VET", "SUPER_ADMIN"]).order("name"),
    getClinicSettings(),
    medicationCatalog(),
  ]);
  for (const result of [patientResult, serviceLinesResult, medicationLinesResult, diagnosesResult, servicesResult, suggestionsResult, methodsResult, vetsResult]) {
    throwDatabaseError(result.error);
  }
  if (!patientResult.data) notFound();
  const patient = fromDatabase<{
    id: string; ownerId: string; name: string; species: string; breed: string | null; sex: string; dob: Date | null;
    estimatedAge: string | null; weight: number | null; clinicalAlerts: string | null; allergies: string | null;
  }>(patientResult.data);
  const { data: ownerData, error: ownerError } = await client.from("owners").select("full_name,mobile")
    .eq("organization_id", session.organizationId).eq("id", patient.ownerId).maybeSingle();
  throwDatabaseError(ownerError);
  if (!ownerData) notFound();
  const owner = fromDatabase<{ fullName: string; mobile: string }>(ownerData);
  const serviceLines = fromDatabase<{ serviceId: string; name: string; price: number; quantity: number }[]>(serviceLinesResult.data ?? []);
  const medicationLines = fromDatabase<{
    id: string; medicationId: string; name: string; quantity: number; unitPrice: number; dispensed: boolean;
  }[]>(medicationLinesResult.data ?? []);
  const diagnoses = fromDatabase<{ id: string; label: string }[]>(diagnosesResult.data ?? []);
  const services = fromDatabase<{ id: string; name: string; category: string; price: number }[]>(servicesResult.data ?? []);
  const suggestions = fromDatabase<{ serviceId: string; medicationId: string }[]>(suggestionsResult.data ?? []);
  const methods = fromDatabase<{ name: string }[]>(methodsResult.data ?? []);
  const vets = fromDatabase<{ id: string; name: string }[]>(vetsResult.data ?? []);
  return (
    <VisitWizard
      symbol={settings?.currencySymbol ?? "$"}
      vets={vets.map((vet) => ({ id: vet.id, name: vet.name }))}
      methods={methods.map((method) => method.name)}
      services={services.map((service) => ({ id: service.id, name: service.name, category: service.category, price: service.price }))}
      suggestions={suggestions.map((item) => ({ serviceId: item.serviceId, medicationId: item.medicationId }))}
      medicines={medicines.map((medicine) => ({
        id: medicine.id,
        name: medicine.name,
        unit: medicine.unit,
        strength: medicine.strength,
        sellingPrice: medicine.sellingPrice,
        category: medicine.category,
        onHand: medicine.onHand,
        batches: medicine.batches.map((batch) => ({
          id: batch.id,
          batchNumber: batch.batchNumber,
          expiry: formatDate(batch.expiryDate),
          onHand: batch.onHand,
          expired: isExpired(batch.expiryDate),
          expiring: isExpiringSoon(batch.expiryDate, 60),
        })),
      }))}
      visit={{
        id: visit.id,
        step: visit.step,
        veterinarianId: visit.veterinarianId,
        presentingComplaint: visit.presentingComplaint ?? "",
        history: visit.history ?? "",
        weight: visit.weight?.toString() ?? "",
        temperature: visit.temperature?.toString() ?? "",
        examination: visit.examination ?? "",
        treatmentNotes: visit.treatmentNotes ?? "",
        clinicalNotes: visit.clinicalNotes ?? "",
        followUpDate: toDateInput(visit.followUpDate),
        patient: {
          name: patient.name,
          species: patient.species,
          breed: patient.breed ?? "",
          sex: patient.sex,
          age: ageLabel(patient.dob, patient.estimatedAge),
          weight: patient.weight?.toString() ?? "",
          alerts: patient.clinicalAlerts ?? "",
          allergies: patient.allergies ?? "",
          owner: owner.fullName,
          mobile: owner.mobile,
        },
        services: serviceLines.map((service) => ({
          serviceId: service.serviceId,
          name: service.name,
          price: service.price,
          quantity: service.quantity,
        })),
        medications: medicationLines.map((line) => ({
          id: line.id,
          medicationId: line.medicationId,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          dispensed: line.dispensed,
          category: medicines.find((medicine) => medicine.id === line.medicationId)?.category ?? "",
        })),
        diagnoses: diagnoses.map((item) => ({ id: item.id, label: item.label })),
      }}
    />
  );
}
