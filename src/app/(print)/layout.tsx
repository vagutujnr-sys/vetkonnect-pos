import { redirect } from "next/navigation";
import { clearSessionCookie, getSession } from "@/lib/session";
import { supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role === "PLATFORM_ADMIN") redirect("/platform");
  const { data: organization, error } = await supabaseAdmin().from("organizations")
    .select("id,status").eq("id", session.organizationId).maybeSingle();
  throwDatabaseError(error);
  if (!organization || organization.status !== "ACTIVE") {
    await clearSessionCookie();
    redirect("/");
  }
  return <div className="main" style={{ paddingBottom: 24 }}>{children}</div>;
}
