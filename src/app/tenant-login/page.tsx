import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LoginScreen } from "@/components/LoginScreen";
import { getSession } from "@/lib/session";
import { tenantUrl } from "@/lib/tenant-url";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function TenantLoginPage() {
  const slug = (await headers()).get("x-practice-code");
  if (!slug) redirect("/");
  const { data: organizationData, error } = await supabaseAdmin()
    .from("organizations")
    .select("id,slug,name,logo_url,status")
    .eq("slug", slug)
    .maybeSingle();
  throwDatabaseError(error);
  const organization = organizationData
    ? fromDatabase<{ id: string; slug: string; name: string; logoUrl: string | null; status: string }>(organizationData)
    : null;
  if (!organization) notFound();

  const session = await getSession();
  if (session?.role === "PLATFORM_ADMIN") redirect("/platform");
  if (session?.organizationId === organization.id) redirect("/pos");
  if (session) redirect(tenantUrl(session.organizationSlug, "/pos"));
  if (organization.status !== "ACTIVE") {
    return (
      <main className="login">
        <section className="login-card">
          <img className="logo clinic-login-logo" src={organization.logoUrl || "/vetkonnect-logo.png"} alt={`${organization.name} logo`} />
          <h1 className="clinic-login-name">{organization.name}</h1>
          <p className="sub">This practice account is not currently active. Contact VetKonnect support.</p>
        </section>
      </main>
    );
  }
  return <LoginScreen practiceCode={slug} organizationName={organization.name} logoUrl={organization.logoUrl} />;
}