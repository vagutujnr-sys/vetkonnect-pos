import Link from "next/link";
import { ALTERED, SEXES, SPECIES } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { createPatientAction } from "@/server/actions";
import { searchOwners } from "@/server/queries";

export default async function NewPatientPage({ searchParams }: { searchParams: Promise<{ error?: string; ownerId?: string; q?: string }> }) {
  const params = await searchParams;
  const owners = await searchOwners(params.q ?? "");
  const session = await getSession();
  if (!session) return null;
  let selected = null;
  if (params.ownerId) {
    const { data, error } = await supabaseAdmin().from("owners").select("*")
      .eq("organization_id", session.organizationId).eq("id", params.ownerId).maybeSingle();
    throwDatabaseError(error);
    selected = data ? fromDatabase<{ id: string; fullName: string; mobile: string }>(data) : null;
  }
  return (
    <div>
      <h1>Register patient</h1>
      {params.error ? <p className="banner danger">{params.error}</p> : null}
      <form>
        <label className="field"><span>Find owner</span><input name="q" defaultValue={params.q} placeholder="Name or mobile" /></label>
        <button className="btn" type="submit">Search owners</button>
      </form>
      <div className="list" style={{ margin: "10px 0" }}>
        {owners.map((owner) => (
          <Link key={owner.id} href={`/patients/new?ownerId=${owner.id}`}>
            <span className="stack">
              <span className="row-title">{owner.fullName}</span>
              <span className="row-meta">{owner.mobile} · {owner._count.patients} animals</span>
            </span>
          </Link>
        ))}
      </div>
      <form action={createPatientAction}>
        <input type="hidden" name="ownerId" value={selected?.id ?? ""} />
        {selected ? <p className="banner ok">Owner: {selected.fullName} · {selected.mobile}</p> : (
          <>
            <h2>New owner</h2>
            <label className="field"><span>Full name</span><input name="ownerName" /></label>
            <label className="field"><span>Mobile</span><input name="ownerMobile" inputMode="tel" /></label>
            <label className="field"><span>Alternative mobile</span><input name="ownerAlt" /></label>
            <label className="field"><span>Address</span><input name="ownerAddress" /></label>
          </>
        )}
        <h2>Patient</h2>
        <label className="field"><span>Name</span><input name="name" required /></label>
        <label className="field"><span>Species</span>
          <select name="species">{SPECIES.map((item) => <option key={item}>{item}</option>)}</select>
        </label>
        <label className="field"><span>Breed</span><input name="breed" /></label>
        <div className="grid-2">
          <label className="field"><span>Sex</span><select name="sex">{SEXES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Date of birth</span><input name="dob" type="date" /></label>
        </div>
        <label className="field"><span>Estimated age if date of birth is unknown</span><input name="estimatedAge" placeholder="4 yrs" /></label>
        <div className="grid-2">
          <label className="field"><span>Colour</span><input name="colour" /></label>
          <label className="field"><span>Weight (kg)</span><input name="weight" inputMode="decimal" /></label>
        </div>
        <label className="field"><span>Microchip</span><input name="microchip" /></label>
        <label className="field"><span>Spayed / neutered</span><select name="spayedNeutered">{ALTERED.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field"><span>Identifying marks</span><input name="identifyingMarks" /></label>
        <label className="field"><span>Allergies</span><input name="allergies" /></label>
        <label className="field"><span>Clinical alerts</span><input name="clinicalAlerts" /></label>
        <label className="field"><span>Notes</span><textarea name="notes" /></label>
        <button className="btn btn-primary btn-block" type="submit">Save patient</button>
      </form>
    </div>
  );
}
