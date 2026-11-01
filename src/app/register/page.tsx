import Link from "next/link";
import { redirect } from "next/navigation";
import { registerPracticeAction } from "@/server/actions";
import { getSession } from "@/lib/session";
import { RegisterSubmitButton } from "@/components/RegisterSubmitButton";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; cancelled?: string }>;
}) {
  if (await getSession()) redirect("/pos");
  const query = await searchParams;
  return (
    <main className="login">
      <section className="login-card register-card">
        <Link className="onboarding-brand" href="/"><img src="/vetkonnect-logo.png" alt="" /><span>VetKonnect <b>P.O.S &amp; Management</b></span></Link>
        <span className="saas-kicker">PRACTICE REGISTRATION</span>
        <h1>Create your practice account</h1>
        <p className="sub">$5 USD per month. Your subscription starts immediately, with no trial period or setup fee.</p>
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        {query.cancelled ? <p className="banner">Payment was cancelled. Your details were not activated.</p> : null}
        <form action={registerPracticeAction} className="onboarding-form">
          <label className="field register-wide"><span>Clinic or surgery name</span><input name="practiceName" autoComplete="organization" required minLength={2} /></label>
          <label className="field"><span>Super Admin name</span><input name="adminName" autoComplete="name" required minLength={2} /></label>
          <label className="field"><span>Work email</span><input name="email" type="email" autoComplete="email" required /></label>
          <label className="field register-wide"><span>Practice address</span><input name="address" autoComplete="street-address" required minLength={5} /></label>
          <label className="field"><span>Practice phone</span><input name="phone" type="tel" autoComplete="tel" required minLength={5} /></label>
          <label className="field"><span>Super Admin 4-digit PIN</span><input name="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} pattern="[0-9]{4}" required /></label>
          <label className="field register-wide"><span>Clinic logo (PNG, JPG or WebP; max 5 MB)</span><input name="clinicLogo" type="file" accept="image/png,image/jpeg,image/webp" required /></label>
          <label className="field">
            <span>Payment method</span>
            <select name="paymentMethod" defaultValue="PAYNOW">
              <option value="PAYNOW">Paynow · $5/month</option>
              <option value="VOUCHER">Subscription voucher · one month</option>
            </select>
          </label>
          <label className="field">
            <span>Voucher code (for voucher payment)</span>
            <input name="voucherCode" autoComplete="off" maxLength={32} />
          </label>
          <p className="register-note register-wide">A voucher can be redeemed once per practice and covers one month.</p>
          <div className="register-wallet-coming register-wide">
            <img src="/vetkonnect-logo.png" alt="" />
            <span>VetKonnect Club Wallet Payments Coming Soon</span>
          </div>
          <RegisterSubmitButton />
        </form>
        <p className="register-foot">Already subscribed? <Link href="/sign-in">Find your practice sign-in</Link></p>
        <Link className="register-link" href="/">Back to VetKonnect</Link>
      </section>
    </main>
  );
}