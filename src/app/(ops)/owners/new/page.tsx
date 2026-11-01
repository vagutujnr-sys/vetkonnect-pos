import { createOwnerAction } from "@/server/actions";

export default async function NewOwnerPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <form action={createOwnerAction}>
      <h1>New owner</h1>
      {error ? <p className="banner danger">{error}</p> : null}
      <label className="field"><span>Full name</span><input name="fullName" /></label>
      <label className="field"><span>Mobile</span><input name="mobile" inputMode="tel" /></label>
      <label className="field"><span>Alternative mobile</span><input name="altMobile" /></label>
      <label className="field"><span>Email</span><input name="email" /></label>
      <label className="field"><span>Address</span><input name="address" /></label>
      <label className="field"><span>Notes</span><textarea name="notes" /></label>
      <button className="btn btn-primary btn-block" type="submit">Save owner</button>
    </form>
  );
}
