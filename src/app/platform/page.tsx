import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";
import { createSubscriptionVoucherAction, revokeSubscriptionVoucherAction, setOrganizationStatusAction, signOut } from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ voucherCreated?: string; voucherRevoked?: string; voucherError?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "PLATFORM_ADMIN") redirect("/home");
  const query = await searchParams;
  const { data: organizationsData, error: organizationsError } = await supabaseAdmin()
    .from("organizations")
    .select("*")
    .neq("slug", "0000000")
    .order("created_at", { ascending: false });
  throwDatabaseError(organizationsError);
  const organizations = fromDatabase<{ id: string; name: string; slug: string; status: string }[]>(organizationsData ?? []);
  const { data: usersData, error: usersError } = await supabaseAdmin()
    .from("users")
    .select("organization_id");
  throwDatabaseError(usersError);
  const users = fromDatabase<{ organizationId: string }[]>(usersData ?? []);
  const { data: voucherData, error: voucherError } = await billingSupabaseAdmin()
    .from("subscription_vouchers")
    .select("*")
    .order("created_at", { ascending: false });
  if (voucherError) throw new Error(voucherError.message);
  return (
    <main className="platform-page">
      <header className="platform-head">
        <div><span className="eyebrow">VETKONNECT / PLATFORM</span><h1>Platform management</h1></div>
        <form action={signOut}><button className="btn btn-quiet" type="submit">Sign out</button></form>
      </header>
      <section className="platform-section">
        <h2>Practice accounts</h2>
      <div className="platform-table-wrap">
        <table className="data platform-table">
          <thead><tr><th>Practice</th><th>Practice URL</th><th>Team</th><th>Status</th><th>Access</th></tr></thead>
          <tbody>
            {organizations.map((organization) => {
              const teamSize = users.filter((user) => user.organizationId === organization.id).length;
              return (
                <tr key={organization.id}>
                  <td><strong>{organization.name}</strong></td>
                  <td><code>/practice/{organization.slug}</code></td>
                  <td>{teamSize}</td>
                  <td><span className={`account-status ${organization.status.toLowerCase()}`}>{organization.status}</span></td>
                  <td>
                    <form action={setOrganizationStatusAction}>
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <input type="hidden" name="status" value={organization.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"} />
                      <button className="btn btn-small" type="submit">{organization.status === "ACTIVE" ? "Suspend" : "Approve / activate"}</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </section>
      <section className="platform-section">
        <h2>Subscription vouchers</h2>
        <p>Create single-use vouchers that cover one month ($5 USD), or manage limited-use flagship codes. Voucher codes are stored securely; copy and share the code you enter.</p>
        {query.voucherCreated ? <p className="banner">Voucher created.</p> : null}
        {query.voucherRevoked ? <p className="banner">Voucher revoked.</p> : null}
        {query.voucherError ? (
          <p className="banner danger">
            {query.voucherError === "duplicate" ? "That voucher code already exists." :
              query.voucherError === "invalid" ? "Use 8–32 letters, numbers, or hyphens." :
                "That voucher is no longer available to revoke."}
          </p>
        ) : null}
        <form action={createSubscriptionVoucherAction} className="platform-voucher-form">
          <label className="field">
            <span>Voucher code (8–32 letters, numbers, or hyphens)</span>
            <input name="code" minLength={8} maxLength={32} pattern="[A-Za-z0-9-]{8,32}" required autoComplete="off" />
          </label>
          <button className="btn btn-primary" type="submit">Create voucher</button>
        </form>
        <div className="platform-table-wrap">
          <table className="data platform-table">
            <thead><tr><th>Code ending</th><th>Status</th><th>Created</th><th>Uses</th><th>Action</th></tr></thead>
            <tbody>
              {voucherData?.map((voucher) => (
                <tr key={voucher.id}>
                  <td><code>•••• {voucher.code_suffix}</code></td>
                  <td><span className={`account-status ${voucher.status.toLowerCase()}`}>{voucher.status}</span></td>
                  <td>{new Date(voucher.created_at).toLocaleDateString()}</td>
                  <td>{voucher.redemption_count} / {voucher.max_redemptions}</td>
                  <td>
                    {voucher.status === "ACTIVE" ? (
                      <form action={revokeSubscriptionVoucherAction}>
                        <input type="hidden" name="voucherId" value={voucher.id} />
                        <button className="btn btn-small" type="submit">Revoke</button>
                      </form>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {!voucherData?.length ? <tr><td colSpan={5}>No vouchers created yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}