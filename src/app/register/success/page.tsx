import Link from "next/link";
import { notFound } from "next/navigation";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";
import { tenantUrl } from "@/lib/tenant-url";
import { confirmPaynowRegistration } from "@/server/paynow";
import { getRegistrationIntent } from "@/server/billing-db";

export const dynamic = "force-dynamic";

export default async function RegistrationSuccessPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const { reference } = await searchParams;
  if (!reference) notFound();
  const intent = await getRegistrationIntent(reference);
  if (!intent) notFound();
  if (intent.paymentMethod === "PAYNOW") {
    if (!process.env.PAYNOW_INTEGRATION_ID || !process.env.PAYNOW_INTEGRATION_KEY) notFound();
    await confirmPaynowRegistration(intent.id).catch(() => false);
  }
  const updatedIntent = await getRegistrationIntent(intent.id);
  const { data: organizationData, error: organizationError } = updatedIntent?.status === "COMPLETED"
    ? await billingSupabaseAdmin().from("organizations").select("status").eq("slug", intent.slug).maybeSingle()
    : { data: null, error: null };
  if (organizationError) throw new Error(organizationError.message);
  const organization = organizationData;
  return (
    <main className="login">
      <section className="login-card register-card">
        <img className="logo" src={intent.logoUrl} alt={`${intent.practiceName} logo`} />
        {organization?.status === "ACTIVE" ? (
          <>
            <h1>Your practice is ready</h1>
            <p className="sub">{intent.practiceName} is set up. Your Super Admin can sign in and invite the rest of your team.</p>
            <Link className="btn btn-primary btn-block" href={tenantUrl(intent.slug)}>Open {intent.practiceName}</Link>
          </>
        ) : (
          <>
            <h1>{updatedIntent?.status === "COMPLETED" ? "Payment received" : "Payment pending"}</h1>
            <p className="sub">{updatedIntent?.status === "COMPLETED" ? "Your practice is being activated." : "Paynow has not confirmed this payment yet. Once payment is complete, refresh this page to check again."}</p>
            <Link className="btn btn-quiet btn-block" href={`/register/success?reference=${encodeURIComponent(reference)}`}>Check payment status</Link>
          </>
        )}
      </section>
    </main>
  );
}