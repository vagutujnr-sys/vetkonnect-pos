import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { tenantUrl } from "@/lib/tenant-url";

export const dynamic = "force-dynamic";

async function openPractice(formData: FormData) {
  "use server";
  const slug = String(formData.get("practice") ?? "").trim().toLowerCase();
  const { data: organization, error } = await supabaseAdmin()
    .from("organizations")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  throwDatabaseError(error);
  const practice = organization as { slug: string } | null;
  if (!practice) redirect("/sign-in?error=Practice%20not%20found.");
  redirect(tenantUrl(practice.slug));
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  return (
    <main className="login">
      <section className="login-card register-card sign-in-card">
        <Link className="onboarding-brand" href="/"><img src="/vetkonnect-logo.png" alt="" /><span>VetKonnect <b>P.O.S &amp; Management</b></span></Link>
        <h1>Find your practice</h1>
        <p className="sub">Enter the practice URL name your Super Admin received at registration.</p>
        {query.error ? <p className="banner danger">{query.error}</p> : null}
        <form action={openPractice}>
          <label className="field"><span>Practice URL name</span><input name="practice" autoComplete="organization" required placeholder="e.g. green-valley" /></label>
          <button className="btn btn-primary btn-block" type="submit">Continue to practice</button>
        </form>
        <p className="register-foot">New to VetKonnect? <Link href="/register">Register your practice</Link></p>
      </section>
    </main>
  );
}