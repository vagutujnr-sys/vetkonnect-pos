import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loginPlatformAdmin } from "@/server/actions";

export const dynamic = "force-dynamic";

export default async function PlatformLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession();
  if (session?.role === "PLATFORM_ADMIN") redirect("/platform");
  const { error } = await searchParams;

  return (
    <main className="login">
      <section className="login-card platform-login-card">
        <img className="logo" src="/vetkonnect-logo.png" alt="VetKonnect" />
        <h1 className="center">Platform admin</h1>
        <p className="sub center">Manage VetKonnect practice accounts</p>
        <form action={loginPlatformAdmin}>
          <label className="field">
            <span>Email</span>
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && <p className="platform-login-error" role="alert">{error === "locked" ? "Too many attempts. Wait 30 seconds." : "Unable to sign in with those credentials."}</p>}
          <button className="btn btn-primary btn-block" type="submit">Sign in</button>
        </form>
        <p className="center platform-login-back"><Link href="/">Back to VetKonnect</Link></p>
      </section>
    </main>
  );
}