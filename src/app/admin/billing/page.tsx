import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";
import { confirmSubscriptionPayment } from "@/server/paynow";
import { renewSubscriptionAction } from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; renewed?: string; error?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "SUPER_ADMIN") redirect("/home");

  const query = await searchParams;
  let paymentCheckError = false;
  let paymentConfirmed = false;
  if (query.reference) {
    const { data: paymentData, error: paymentError } = await billingSupabaseAdmin()
      .from("subscription_payments")
      .select("id, organization_id")
      .eq("id", query.reference)
      .maybeSingle();
    if (paymentError) throw new Error(paymentError.message);
    if (!paymentData || paymentData.organization_id !== session.organizationId) notFound();
    try {
      await confirmSubscriptionPayment(paymentData.id);
      const { data: updatedPaymentData, error: updatedPaymentError } = await billingSupabaseAdmin()
        .from("subscription_payments")
        .select("status")
        .eq("id", paymentData.id)
        .maybeSingle();
      if (updatedPaymentError) throw new Error(updatedPaymentError.message);
      paymentConfirmed = updatedPaymentData?.status === "COMPLETED";
    } catch (error) {
      console.error("Subscription payment confirmation failed", error);
      paymentCheckError = true;
    }
  }

  const { data: subscriptionData, error: subscriptionError } = await billingSupabaseAdmin()
    .from("subscriptions")
    .select("*")
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (subscriptionError) throw new Error(subscriptionError.message);
  const subscription = subscriptionData;
  if (!subscription) notFound();
  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
  const daysUntilRenewal = periodEnd ? Math.ceil((periodEnd.getTime() - Date.now()) / 86_400_000) : 0;
  const renewalDue = !periodEnd || daysUntilRenewal <= 7;

  return (
    <div>
      <h1>Subscription</h1>
      <p className="sub">Your practice subscription is $5 USD per month. Each voucher can be redeemed once per practice and covers one month.</p>
      {query.renewed ? <p className="banner">Your subscription has been extended by one month.</p> : null}
      {query.reference && paymentConfirmed ? (
        <p className="banner">Payment received. Your subscription is active through {periodEnd?.toLocaleDateString()}.</p>
      ) : query.reference ? (
        <p className="banner">{paymentCheckError ? "We could not confirm the payment yet. Refresh this page to check again." : "Payment is not confirmed yet. Refresh this page after completing Paynow."}</p>
      ) : null}
      {query.error ? (
        <p className="banner danger">
          {query.error === "voucher" ? "That voucher is invalid, revoked, or already redeemed." :
            query.error === "unavailable" ? "Paynow is not configured for this practice yet." :
              query.error === "subscription" ? "No subscription was found for this practice." :
                query.error === "email" ? "Add a practice email address before starting Paynow checkout." :
                query.error === "payment" ? "Choose an available payment method." :
                  "Could not start Paynow checkout. Please try again."}
        </p>
      ) : null}
      <section className="billing-card">
        <div>
          <span className="eyebrow">CURRENT SUBSCRIPTION</span>
          <h2>{subscription.status}</h2>
          <p>
            {renewalDue ? "Renewal due " : "Next renewal "}
            {periodEnd?.toLocaleDateString() ?? "Not scheduled"}
            {daysUntilRenewal > 0 ? ` · ${daysUntilRenewal} day${daysUntilRenewal === 1 ? "" : "s"} remaining` : ""}
          </p>
        </div>
        <form action={renewSubscriptionAction} className="billing-form">
          <label className="field">
            <span>Payment method</span>
            <select name="paymentMethod" defaultValue="PAYNOW">
              <option value="PAYNOW">Paynow · $5/month</option>
              <option value="VOUCHER">Subscription voucher · one month</option>
              <option value="CLUB_WALLET" disabled>VetKonnect Club Wallet · coming soon</option>
            </select>
          </label>
          <label className="field">
            <span>Voucher code (for voucher payment)</span>
            <input name="voucherCode" autoComplete="off" maxLength={32} />
          </label>
          <button className="btn btn-primary" type="submit">Renew for one month</button>
        </form>
      </section>
      <section className="billing-wallet-note">
        <h2>VetKonnect Club Wallet</h2>
        <p>Wallet balance payments will be enabled once the Club Wallet API connection is available.</p>
      </section>
      <Link href="/admin">Back to admin</Link>
    </div>
  );
}
