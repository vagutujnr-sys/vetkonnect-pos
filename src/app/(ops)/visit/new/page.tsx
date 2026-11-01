import { PatientPicker } from "@/components/PatientPicker";
import { searchPatients } from "@/server/queries";

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const patients = q.trim() ? await searchPatients(q) : [];
  return (
    <div>
      <h1>New visit</h1>
      <p className="sub">Find the patient first.</p>
      <PatientPicker
        query={q}
        patients={patients.map((patient) => ({
          id: patient.id,
          name: patient.name,
          meta: `${patient.owner.fullName} · ${patient.owner.mobile} · ${patient.patientNumber}`,
        }))}
      />
    </div>
  );
}
