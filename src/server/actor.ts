import { redirect } from "next/navigation";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { getSession, clearSessionCookie } from "@/lib/session";
import type { Actor } from "./commerce";

type UserRow = { id: string; name: string; role: string; organizationId: string; branchId: string; active: boolean };
type OrganizationRow = { id: string; status: string };

export async function actor(): Promise<Actor> {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role === "PLATFORM_ADMIN") redirect("/platform");
  const { data: userData, error: userError } = await supabaseAdmin()
    .from("users")
    .select("*")
    .eq("id", session.id)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  throwDatabaseError(userError);
  const user = userData ? fromDatabase<UserRow>(userData) : null;
  if (!user || !user.active) {
    await clearSessionCookie();
    redirect("/");
  }
  const { data: organizationData, error: organizationError } = await supabaseAdmin()
    .from("organizations")
    .select("id,status")
    .eq("id", user.organizationId)
    .maybeSingle();
  throwDatabaseError(organizationError);
  const organization = organizationData ? fromDatabase<OrganizationRow>(organizationData) : null;
  if (!organization || organization.status !== "ACTIVE") {
    await clearSessionCookie();
    redirect("/");
  }
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    branchId: user.branchId,
  };
}

export function rethrow(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_")
  ) {
    throw error;
  }
  throw error;
}
