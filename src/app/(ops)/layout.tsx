import { redirect } from "next/navigation";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { getClinicSettings } from "@/lib/clinic";
import { clearSessionCookie, getSession } from "@/lib/session";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role === "PLATFORM_ADMIN") redirect("/platform");
  const { data: userData, error: userError } = await supabaseAdmin()
    .from("users")
    .select("id,name,role,organization_id,branch_id,active")
    .eq("id", session.id)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  throwDatabaseError(userError);
  const user = userData
    ? fromDatabase<{ id: string; name: string; role: string; organizationId: string; branchId: string; active: boolean }>(userData)
    : null;
  if (!user?.active) redirect("/");
  const { data: organizationData, error: organizationError } = await supabaseAdmin()
    .from("organizations")
    .select("id,name,status")
    .eq("id", user.organizationId)
    .maybeSingle();
  throwDatabaseError(organizationError);
  const organization = organizationData ? fromDatabase<{ id: string; name: string; status: string }>(organizationData) : null;
  if (!organization || organization.status !== "ACTIVE") {
    await clearSessionCookie();
    redirect("/");
  }
  const settings = await getClinicSettings(session.organizationId);
  const { data: noticesData, error: noticesError } = await supabaseAdmin()
    .from("notifications")
    .select("id,title,body,href")
    .eq("organization_id", session.organizationId)
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(8);
  throwDatabaseError(noticesError);
  const notices = fromDatabase<{ id: string; title: string; body: string; href: string | null }[]>(noticesData ?? []);
  return (
    <Shell
      clinic={settings?.clinicName ?? organization.name}
      userName={user.name}
      timeoutMinutes={settings?.lockTimeoutMinutes ?? 5}
      notices={notices}
    >
      {children}
    </Shell>
  );
}
