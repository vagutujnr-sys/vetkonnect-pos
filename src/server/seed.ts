import { id } from "@/lib/ids";
import { hashPassword } from "@/lib/password";
import { fromDatabase, supabaseAdmin, throwDatabaseError, toDatabase } from "@/lib/supabase-admin-core";

export async function configurePlatformAdmin(name: string, email: string, password: string) {
  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedName) throw new Error("Enter a platform administrator name.");
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("Enter a valid email address.");
  if (password.length < 8) throw new Error("Use a password with at least 8 characters.");
  const client = supabaseAdmin();
  const { data: admins, error: adminError } = await client.from("users")
    .select("id,organization_id,branch_id").eq("role", "PLATFORM_ADMIN").limit(2);
  throwDatabaseError(adminError);
  if ((admins?.length ?? 0) > 1) throw new Error("More than one platform administrator exists. Resolve this in Supabase before continuing.");
  const platformAdmin = admins?.[0]
    ? fromDatabase<{ id: string; organizationId: string; branchId: string }>(admins[0])
    : null;
  const { data: existing, error: existingError } = await client.from("users")
    .select("id").eq("email", normalizedEmail).eq("role", "PLATFORM_ADMIN").maybeSingle();
  throwDatabaseError(existingError);
  if (existing && existing.id !== platformAdmin?.id) throw new Error("That email is already assigned to another user.");

  if (platformAdmin) {
    const { error } = await client.from("users").update({
      name: normalizedName,
      email: normalizedEmail,
      password_hash: hashPassword(password),
      pin_hash: null,
      active: true,
    }).eq("id", platformAdmin.id);
    throwDatabaseError(error);
    return;
  }

  const { data: orgData, error: orgError } = await client.from("organizations")
    .select("id").eq("slug", "0000000").maybeSingle();
  throwDatabaseError(orgError);
  const organization = orgData ? fromDatabase<{ id: string }>(orgData) : null;
  const organizationId = organization?.id ?? id();
  if (!organization) {
    const { error } = await client.from("organizations").insert(toDatabase({
      id: organizationId, name: "VetKonnect Platform", slug: "0000000", status: "ACTIVE",
    }) as never);
    throwDatabaseError(error);
  }
  const { data: branchData, error: branchError } = await client.from("branches")
    .select("id").eq("organization_id", organizationId).limit(1);
  throwDatabaseError(branchError);
  const branch = branchData?.[0] ? fromDatabase<{ id: string }>(branchData[0]) : null;
  const branchId = branch?.id ?? id();
  if (!branchData?.length) {
    const { error } = await client.from("branches").insert(toDatabase({
      id: branchId, organizationId, name: "Platform",
    }) as never);
    throwDatabaseError(error);
  }
  const { error } = await client.from("users").insert(toDatabase({
    id: id(), organizationId, branchId, name: normalizedName, role: "PLATFORM_ADMIN",
    email: normalizedEmail, passwordHash: hashPassword(password), pinHash: null, active: true,
  }) as never);
  throwDatabaseError(error);
}
