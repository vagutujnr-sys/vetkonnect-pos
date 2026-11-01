import Link from "next/link";
import { redirect } from "next/navigation";
import { clearSessionCookie, getSession } from "@/lib/session";
import { getClinicSettings } from "@/lib/clinic";
import { throwDatabaseError } from "@/lib/supabase-admin";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";

export const dynamic = "force-dynamic";

const groups = [
  ["Overview", [["/admin", "Overview"]]],
  ["Clinic", [["/admin/patients", "Patients"], ["/admin/consultations", "Consultations"], ["/admin/sales", "Sales"]]],
  ["Stock", [["/admin/pharmacy", "Pharmacy"], ["/admin/inventory", "Inventory"], ["/admin/suppliers", "Suppliers"], ["/admin/services", "Services"], ["/admin/products", "Products"]]],
  ["Records", [["/admin/vaccinations", "Vaccinations"], ["/admin/prescriptions", "Prescriptions"], ["/reports", "Reports"]]],
  ["System", [["/admin/staff", "Staff"], ["/admin/audit", "Audit log"], ["/admin/printers", "Printers"], ["/admin/sync", "Sync"], ["/admin/backups", "Backups"], ["/admin/settings", "Settings"], ["/admin/billing", "Subscription"]]],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "SUPER_ADMIN") redirect("/home");
  const { data: organization, error: organizationError } = await billingSupabaseAdmin()
    .from("organizations")
    .select("id,status")
    .eq("id", session.organizationId)
    .maybeSingle();
  throwDatabaseError(organizationError);
  if (!organization || organization.status !== "ACTIVE") {
    await clearSessionCookie();
    redirect("/");
  }
  const settings = await getClinicSettings(session.organizationId);
  const { data: subscription, error: subscriptionError } = await billingSupabaseAdmin()
    .from("subscriptions")
    .select("current_period_end")
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message);
  const currentPeriodEnd = subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  const renewalDue = Boolean(
    currentPeriodEnd &&
    currentPeriodEnd.getTime() <= Date.now() + 7 * 86_400_000,
  );
  return (
    <div className="admin">
      <aside className="side">
        <div className="desk-only" style={{ padding: "4px 10px 12px" }}>
          <strong>{settings?.clinicName ?? "VetKonnect POS"}</strong>
          <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>{session.name}</div>
        </div>
        {groups.map(([label, links]) => (
          <div key={String(label)}>
            <div className="group">{label}</div>
            {(links as [string, string][]).map(([href, title]) => (
              <Link key={href} href={href}>{title}</Link>
            ))}
          </div>
        ))}
        <Link href="/home">Surgery app</Link>
      </aside>
      <div className="admin-main">
        {renewalDue ? <p className="banner">Your monthly subscription is due soon. <Link href="/admin/billing">Review renewal options</Link>.</p> : null}
        {children}
      </div>
    </div>
  );
}
