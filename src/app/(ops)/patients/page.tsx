import Link from "next/link";
import { ageLabel } from "@/lib/dates";
import { searchPatients } from "@/server/queries";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const patients = await searchPatients(q);
  return (
    <div>
      <div className="page-head">
        <h1>Patients</h1>
        <Link className="btn btn-primary" href="/patients/new">Register</Link>
      </div>
      <form>
        <label className="field">
          <span>Name, owner, mobile, patient number or microchip</span>
          <input name="q" defaultValue={q} placeholder="Search" />
        </label>
      </form>
      <div className="list">
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <span className="stack">
              <span className="row-title">{patient.name}{patient.status === "DECEASED" ? " · Deceased" : ""}</span>
              <span className="row-meta">
                {patient.breed || patient.species} · {patient.sex} · {ageLabel(patient.dob, patient.estimatedAge)} · {patient.owner.fullName} · {patient.owner.mobile}
              </span>
            </span>
            <span className="row-meta">{patient.patientNumber}</span>
          </Link>
        ))}
        {patients.length === 0 ? <div className="row"><span className="row-meta">No patients found.</span></div> : null}
      </div>
    </div>
  );
}
