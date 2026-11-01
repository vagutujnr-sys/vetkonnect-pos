import Link from "next/link";
import { notFound } from "next/navigation";
import { ageLabel, formatDate } from "@/lib/dates";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { externalVaccineAction, startVisitAction } from "@/server/actions";
import { StartVisit } from "@/components/StartVisit";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const client = supabaseAdmin();
  const { data: patientData, error: patientError } = await client.from("patients").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(patientError);
  if (!patientData) notFound();
  const patient = fromDatabase<{
    id: string; ownerId: string; name: string; breed: string | null; species: string; sex: string; dob: Date | null;
    estimatedAge: string | null; weight: number | null; clinicalAlerts: string | null; allergies: string | null;
    patientNumber: string; status: string; colour: string | null; microchip: string | null; notes: string | null; photoPath: string | null;
  }>(patientData);
  const [ownerResult, timelineResult, vaccinationResult, visitResult] = await Promise.all([
    client.from("owners").select("id,full_name,mobile").eq("organization_id", session.organizationId).eq("id", patient.ownerId).maybeSingle(),
    client.from("timeline_events").select("*").eq("organization_id", session.organizationId).eq("patient_id", patient.id)
      .order("occurred_at", { ascending: false }).limit(40),
    client.from("vaccinations").select("*").eq("organization_id", session.organizationId).eq("patient_id", patient.id)
      .order("administered_at", { ascending: false }),
    client.from("visits").select("id").eq("organization_id", session.organizationId).eq("patient_id", patient.id).eq("status", "DRAFT")
      .order("updated_at", { ascending: false }).limit(1),
  ]);
  for (const result of [ownerResult, timelineResult, vaccinationResult, visitResult]) throwDatabaseError(result.error);
  if (!ownerResult.data) notFound();
  const owner = fromDatabase<{ id: string; fullName: string; mobile: string }>(ownerResult.data);
  const timeline = fromDatabase<{
    id: string; title: string; summary: string | null; occurredAt: Date; veterinarianId: string | null; eventType: string;
  }[]>(timelineResult.data ?? []);
  const vaccinations = fromDatabase<{
    id: string; vaccineName: string; administeredAt: Date; batchNumber: string | null; administeredElsewhere: boolean;
    externalClinic: string | null;
  }[]>(vaccinationResult.data ?? []);
  const drafts = fromDatabase<{ id: string }[]>(visitResult.data ?? []);
  const vetIds = [...new Set(timeline.map((event) => event.veterinarianId).filter((value): value is string => Boolean(value)))];
  const { data: vetData, error: vetError } = vetIds.length
    ? await client.from("users").select("id,name").eq("organization_id", session.organizationId).in("id", vetIds)
    : { data: [], error: null };
  throwDatabaseError(vetError);
  const vets = fromDatabase<{ id: string; name: string }[]>(vetData ?? []);
  const tab = query.tab || "overview";
  return (
    <div>
      <div className="patient-hero">
        <div>
          <h1>{patient.name}</h1>
          <p className="sub">
            {patient.breed || patient.species} · {patient.sex} · {ageLabel(patient.dob, patient.estimatedAge)}
            {patient.weight ? ` · ${patient.weight}kg` : ""}
          </p>
        </div>
        {patient.photoPath ? <img className="photo" src={`/api/patients/${patient.id}/photo`} alt="" /> : null}
      </div>
      {patient.clinicalAlerts ? <p className="banner danger">{patient.clinicalAlerts}</p> : null}
      {patient.allergies ? <p className="banner">Allergy: {patient.allergies}</p> : null}
      <p className="sub">{patient.patientNumber} · {patient.status === "DECEASED" ? "Deceased" : "Active"}</p>
      <div className="list">
        <Link href={`/owners/${owner.id}`}>
          <span className="stack">
            <span className="row-meta">Owner</span>
            <span className="row-title">{owner.fullName}</span>
            <span className="row-meta">{owner.mobile}</span>
          </span>
        </Link>
      </div>
      <div className="btn-row" style={{ margin: "12px 0" }}>
        <StartVisit patientId={patient.id} label="New visit" />
        <StartVisit patientId={patient.id} label="Vaccinate" />
      </div>
      <div className="btn-row">
        <Link className="btn" href={`/prescriptions/new?patientId=${patient.id}`}>Prescription</Link>
        <Link className="btn" href={`/certificates/${patient.id}`}>Certificate</Link>
      </div>
      <div className="seg" style={{ marginTop: 14 }}>
        <Link className={tab === "overview" ? "on" : ""} href={`/patients/${patient.id}`}>Overview</Link>
        <Link className={tab === "history" ? "on" : ""} href={`/patients/${patient.id}?tab=history`}>History</Link>
        <Link className={tab === "vaccines" ? "on" : ""} href={`/patients/${patient.id}?tab=vaccines`}>Vaccines</Link>
      </div>
      {query.error ? <p className="banner danger">{query.error}</p> : null}
      {tab === "overview" ? (
        <div>
          <p>{patient.colour ? `Colour ${patient.colour}. ` : ""}{patient.microchip ? `Microchip ${patient.microchip}.` : ""}</p>
          {patient.notes ? <p>{patient.notes}</p> : null}
          <h2>Recent</h2>
          <Timeline events={timeline.slice(0, 4)} vets={vets} />
          <form action={async (formData) => {
            "use server";
            const { uploadPhotoAction } = await import("@/server/actions");
            await uploadPhotoAction(formData);
          }}>
            <input type="hidden" name="patientId" value={patient.id} />
            <label className="field"><span>Photograph</span><input name="photo" type="file" accept="image/*" /></label>
            <button className="btn" type="submit">Save photo</button>
          </form>
          <p><Link href={`/patients/${patient.id}/edit`}>Edit patient</Link></p>
        </div>
      ) : null}
      {tab === "history" ? <Timeline events={timeline} vets={vets} /> : null}
      {tab === "vaccines" ? (
        <div>
          <div className="list">
            {vaccinations.map((row) => (
              <div key={row.id} className="row">
                <span className="stack">
                  <span className="row-title">{row.vaccineName}</span>
                  <span className="row-meta">
                    {formatDate(row.administeredAt)} · {row.batchNumber || "No batch"}{row.administeredElsewhere ? ` · ${row.externalClinic}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <h2>Given elsewhere</h2>
          <form action={externalVaccineAction}>
            <input type="hidden" name="patientId" value={patient.id} />
            <label className="field"><span>Vaccine</span><input name="vaccineName" /></label>
            <label className="field"><span>Clinic</span><input name="clinic" /></label>
            <label className="field"><span>Veterinarian</span><input name="veterinarian" /></label>
            <label className="field"><span>Date</span><input type="date" name="administeredAt" /></label>
            <label className="field"><span>Batch</span><input name="batchNumber" /></label>
            <label className="field"><span>Next due</span><input type="date" name="nextDue" /></label>
            <button className="btn" type="submit">Save external record</button>
          </form>
        </div>
      ) : null}
      {drafts[0] ? <p className="banner">Draft visit open. <Link href={`/visit/${drafts[0].id}`}>Continue</Link></p> : null}
    </div>
  );
}

function Timeline({
  events,
  vets,
}: {
  events: { id: string; title: string; summary: string | null; occurredAt: Date; veterinarianId: string | null; eventType: string }[];
  vets: { id: string; name: string }[];
}) {
  if (!events.length) return <p className="sub">No history yet.</p>;
  return (
    <div className="list">
      {events.map((event) => (
        <div key={event.id} className="row">
          <span className="stack">
            <span className="row-title">{event.title}</span>
            <span className="row-meta">
              {formatDate(event.occurredAt)} · {event.eventType}
              {event.veterinarianId ? ` · ${vets.find((vet) => vet.id === event.veterinarianId)?.name ?? ""}` : ""}
              {event.summary ? ` · ${event.summary}` : ""}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
