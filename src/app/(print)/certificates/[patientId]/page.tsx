import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { ageLabel, formatDate } from "@/lib/dates";
import { getClinicSettings } from "@/lib/clinic";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export default async function CertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { patientId } = await params;
  const { auto } = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const client = supabaseAdmin();
  const { data: patientData, error: patientError } = await client.from("patients").select("*")
    .eq("organization_id", session.organizationId).eq("id", patientId).maybeSingle();
  throwDatabaseError(patientError);
  if (!patientData) notFound();
  const patient = fromDatabase<{
    id: string; ownerId: string; name: string; patientNumber: string; species: string; breed: string | null;
    sex: string; colour: string | null; dob: Date | null; estimatedAge: string | null; microchip: string | null;
    identifyingMarks: string | null;
  }>(patientData);
  const [settings, ownerResult, vaccinationResult, vetResult] = await Promise.all([
    getClinicSettings(),
    client.from("owners").select("full_name,mobile,address").eq("organization_id", session.organizationId).eq("id", patient.ownerId).maybeSingle(),
    client.from("vaccinations").select("*").eq("organization_id", session.organizationId).eq("patient_id", patient.id).order("administered_at"),
    client.from("users").select("id,name").eq("organization_id", session.organizationId),
  ]);
  for (const result of [ownerResult, vaccinationResult, vetResult]) throwDatabaseError(result.error);
  if (!ownerResult.data) notFound();
  const owner = fromDatabase<{ fullName: string; mobile: string; address: string | null }>(ownerResult.data);
  const vaccinations = fromDatabase<{
    id: string; administeredAt: Date; vaccineName: string; administeredElsewhere: boolean; disease: string | null;
    batchNumber: string | null; expiryDate: Date | null; nextDue: Date | null; veterinarianId: string | null; externalVeterinarian: string | null;
  }[]>(vaccinationResult.data ?? []);
  const vets = fromDatabase<{ id: string; name: string }[]>(vetResult.data ?? []);
  return (
    <div>
      <PrintButton kind="vaccination-certificate" entityId={patient.id} auto={auto === "1"} />
      <article className="doc">
        <img src="/logo.png" alt="" style={{ width: 96 }} />
        <h1>{settings?.clinicName}</h1>
        <p>{settings?.address}{settings?.phone ? ` · ${settings.phone}` : ""}</p>
        <h2>Vaccination certificate</h2>
        <h2>Owner</h2>
        <p>Name: {owner.fullName}<br />Phone: {owner.mobile}<br />Address: {owner.address || "—"}</p>
        <h2>Patient</h2>
        <p>
          Name: {patient.name}<br />
          Patient number: {patient.patientNumber}<br />
          Species: {patient.species}<br />
          Breed: {patient.breed || "—"}<br />
          Sex: {patient.sex}<br />
          Colour: {patient.colour || "—"}<br />
          DOB / age: {patient.dob ? formatDate(patient.dob) : patient.estimatedAge || "—"} · {ageLabel(patient.dob, patient.estimatedAge)}<br />
          Microchip: {patient.microchip || "—"}<br />
          Identifying marks: {patient.identifyingMarks || "—"}
        </p>
        <h2>Vaccination history</h2>
        <table className="data">
          <thead>
            <tr><th>Date</th><th>Vaccine</th><th>Disease</th><th>Batch</th><th>Expiry</th><th>Next due</th><th>Veterinarian</th></tr>
          </thead>
          <tbody>
            {vaccinations.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.administeredAt)}</td>
                <td>{row.vaccineName}{row.administeredElsewhere ? " (elsewhere)" : ""}</td>
                <td>{row.disease || "—"}</td>
                <td>{row.batchNumber || "—"}</td>
                <td>{formatDate(row.expiryDate)}</td>
                <td>{formatDate(row.nextDue)}</td>
                <td>{row.administeredElsewhere ? row.externalVeterinarian : vets.find((vet) => vet.id === row.veterinarianId)?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 36 }}>
          <p>Veterinarian ______________________________</p>
          <p>Registration ______________________________</p>
          <p>Signature ______________________________</p>
          <p>Clinic stamp</p>
          <div style={{ width: 140, height: 80, border: "1px solid #ccc" }} />
        </div>
      </article>
    </div>
  );
}
