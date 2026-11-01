import { notFound } from "next/navigation";
import { ALTERED, SEXES, SPECIES } from "@/lib/constants";
import { toDateInput } from "@/lib/dates";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { updatePatientAction } from "@/server/actions";

export default async function EditPatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  if (!session) return null;
  const { data, error: queryError } = await supabaseAdmin().from("patients").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(queryError);
  const patient = data ? fromDatabase<{
    id: string; name: string; species: string; breed: string | null; sex: string; dob: Date | null;
    estimatedAge: string | null; colour: string | null; weight: number | null; microchip: string | null;
    spayedNeutered: string | null; identifyingMarks: string | null; allergies: string | null;
    clinicalAlerts: string | null; notes: string | null; status: string;
  }>(data) : null;
  if (!patient) notFound();
  return (
    <form action={updatePatientAction}>
      <h1>Edit {patient.name}</h1>
      {error ? <p className="banner danger">{error}</p> : null}
      <input type="hidden" name="patientId" value={patient.id} />
      <label className="field"><span>Name</span><input name="name" defaultValue={patient.name} /></label>
      <label className="field"><span>Species</span><select name="species" defaultValue={patient.species}>{SPECIES.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>Breed</span><input name="breed" defaultValue={patient.breed ?? ""} /></label>
      <div className="grid-2">
        <label className="field"><span>Sex</span><select name="sex" defaultValue={patient.sex}>{SEXES.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Date of birth</span><input type="date" name="dob" defaultValue={toDateInput(patient.dob)} /></label>
      </div>
      <label className="field"><span>Estimated age</span><input name="estimatedAge" defaultValue={patient.estimatedAge ?? ""} /></label>
      <div className="grid-2">
        <label className="field"><span>Colour</span><input name="colour" defaultValue={patient.colour ?? ""} /></label>
        <label className="field"><span>Weight</span><input name="weight" defaultValue={patient.weight ?? ""} /></label>
      </div>
      <label className="field"><span>Microchip</span><input name="microchip" defaultValue={patient.microchip ?? ""} /></label>
      <label className="field"><span>Spayed / neutered</span><select name="spayedNeutered" defaultValue={patient.spayedNeutered ?? "Unknown"}>{ALTERED.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="field"><span>Identifying marks</span><input name="identifyingMarks" defaultValue={patient.identifyingMarks ?? ""} /></label>
      <label className="field"><span>Allergies</span><input name="allergies" defaultValue={patient.allergies ?? ""} /></label>
      <label className="field"><span>Clinical alerts</span><input name="clinicalAlerts" defaultValue={patient.clinicalAlerts ?? ""} /></label>
      <label className="field"><span>Notes</span><textarea name="notes" defaultValue={patient.notes ?? ""} /></label>
      <label className="field"><span>Status</span><select name="status" defaultValue={patient.status}><option value="ACTIVE">Active</option><option value="DECEASED">Deceased</option></select></label>
      <button className="btn btn-primary btn-block" type="submit">Save</button>
    </form>
  );
}
