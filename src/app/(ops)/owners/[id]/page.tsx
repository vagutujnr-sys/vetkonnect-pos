import Link from "next/link";
import { notFound } from "next/navigation";
import { ageLabel } from "@/lib/dates";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return null;
  const client = supabaseAdmin();
  const { data: ownerData, error: ownerError } = await client.from("owners").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(ownerError);
  if (!ownerData) notFound();
  const { data: patientData, error: patientError } = await client.from("patients").select("*")
    .eq("organization_id", session.organizationId).eq("owner_id", id).order("name");
  throwDatabaseError(patientError);
  const owner = fromDatabase<{
    id: string; fullName: string; mobile: string; altMobile: string | null; address: string | null; notes: string | null;
  }>(ownerData);
  const patients = fromDatabase<{
    id: string; name: string; breed: string | null; species: string; dob: Date | null; estimatedAge: string | null;
  }[]>(patientData ?? []);
  return (
    <div>
      <div className="page-head">
        <h1>{owner.fullName}</h1>
        <Link href={`/owners/${owner.id}/edit`}>Edit</Link>
      </div>
      <p className="sub">{owner.mobile}{owner.altMobile ? ` · ${owner.altMobile}` : ""}{owner.address ? ` · ${owner.address}` : ""}</p>
      {owner.notes ? <p>{owner.notes}</p> : null}
      <div className="list">
        {patients.map((patient) => (
          <Link key={patient.id} href={`/patients/${patient.id}`}>
            <span className="stack">
              <span className="row-title">{patient.name}</span>
              <span className="row-meta">{patient.breed || patient.species} · {ageLabel(patient.dob, patient.estimatedAge)}</span>
            </span>
          </Link>
        ))}
      </div>
      <Link className="btn btn-primary btn-block" href={`/patients/new?ownerId=${owner.id}`} style={{ marginTop: 12 }}>Add animal</Link>
    </div>
  );
}
