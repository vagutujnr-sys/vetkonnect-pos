import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { ageLabel, formatDate } from "@/lib/dates";
import { getClinicSettings } from "@/lib/clinic";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export default async function PrescriptionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const client = supabaseAdmin();
  const { data: prescriptionData, error: prescriptionError } = await client.from("prescriptions").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(prescriptionError);
  if (!prescriptionData) notFound();
  const prescription = fromDatabase<{
    id: string; number: string; patientId: string; veterinarianId: string; notes: string | null; createdAt: Date;
  }>(prescriptionData);
  const [settings, patientResult, itemsResult, vetResult] = await Promise.all([
    getClinicSettings(),
    client.from("patients").select("*").eq("organization_id", session.organizationId).eq("id", prescription.patientId).maybeSingle(),
    client.from("prescription_items").select("*").eq("organization_id", session.organizationId).eq("prescription_id", id),
    client.from("users").select("name,registration_number").eq("organization_id", session.organizationId)
      .eq("id", prescription.veterinarianId).maybeSingle(),
  ]);
  for (const result of [patientResult, itemsResult, vetResult]) throwDatabaseError(result.error);
  if (!patientResult.data) notFound();
  const patientData = fromDatabase<{
    id: string; ownerId: string; name: string; patientNumber: string; species: string; breed: string | null;
    sex: string; dob: Date | null; estimatedAge: string | null;
  }>(patientResult.data);
  const { data: ownerData, error: ownerError } = await client.from("owners").select("full_name,mobile")
    .eq("organization_id", session.organizationId).eq("id", patientData.ownerId).maybeSingle();
  throwDatabaseError(ownerError);
  if (!ownerData) notFound();
  const owner = fromDatabase<{ fullName: string; mobile: string }>(ownerData);
  const patient = { ...patientData, owner };
  const items = fromDatabase<{
    id: string; medicationName: string; strength: string | null; dose: string | null; route: string | null;
    frequency: string | null; duration: string | null; quantity: number | null; instructions: string | null; repeats: number | null;
  }[]>(itemsResult.data ?? []);
  const vet = vetResult.data ? fromDatabase<{ name: string; registrationNumber: string | null }>(vetResult.data) : null;
  return (
    <div>
      <PrintButton kind="prescription" entityId={prescription.id} auto={auto === "1"} />
      <article className="doc">
        <img src="/logo.png" alt="" style={{ width: 92 }} />
        <h1>{settings?.clinicName}</h1>
        <p>{settings?.address}{settings?.phone ? ` · ${settings.phone}` : ""}</p>
        <h2>Prescription {prescription.number}</h2>
        <p>{formatDate(prescription.createdAt)}</p>
        <p><strong>Owner</strong> {patient.owner.fullName} · {patient.owner.mobile}</p>
        <p><strong>Patient</strong> {patient.name} · {patient.patientNumber} · {patient.species} · {patient.breed} · {patient.sex} · {ageLabel(patient.dob, patient.estimatedAge)}</p>
        {items.map((item) => (
          <div key={item.id} style={{ marginTop: 14 }}>
            <strong>{item.medicationName}</strong>
            <p>
              {[item.strength, item.dose, item.route, item.frequency, item.duration, item.quantity ? `Qty ${item.quantity}` : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {item.instructions ? <p>{item.instructions}</p> : null}
            {item.repeats ? <p>Repeats: {item.repeats}</p> : null}
          </div>
        ))}
        {prescription.notes ? <p>{prescription.notes}</p> : null}
        <div style={{ marginTop: 48 }}>
          <p>{vet?.name}</p>
          {vet?.registrationNumber ? <p>Registration {vet.registrationNumber}</p> : null}
          <p>Signature ______________________________</p>
        </div>
      </article>
    </div>
  );
}
