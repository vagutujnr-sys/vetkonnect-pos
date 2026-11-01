import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { updateOwnerAction } from "@/server/actions";

export default async function EditOwnerPage({
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
  const { data, error: queryError } = await supabaseAdmin().from("owners").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(queryError);
  const owner = data ? fromDatabase<{
    id: string; fullName: string; mobile: string; altMobile: string | null; email: string | null;
    address: string | null; notes: string | null;
  }>(data) : null;
  if (!owner) notFound();
  return (
    <form action={updateOwnerAction}>
      <h1>Edit owner</h1>
      {error ? <p className="banner danger">{error}</p> : null}
      <input type="hidden" name="ownerId" value={owner.id} />
      <label className="field"><span>Full name</span><input name="fullName" defaultValue={owner.fullName} /></label>
      <label className="field"><span>Mobile</span><input name="mobile" defaultValue={owner.mobile} /></label>
      <label className="field"><span>Alternative mobile</span><input name="altMobile" defaultValue={owner.altMobile ?? ""} /></label>
      <label className="field"><span>Email</span><input name="email" defaultValue={owner.email ?? ""} /></label>
      <label className="field"><span>Address</span><input name="address" defaultValue={owner.address ?? ""} /></label>
      <label className="field"><span>Notes</span><textarea name="notes" defaultValue={owner.notes ?? ""} /></label>
      <button className="btn btn-primary btn-block" type="submit">Save</button>
    </form>
  );
}
