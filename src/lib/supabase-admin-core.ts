import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: ReturnType<typeof createClient<Database>> | undefined;

export function supabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.");
  if (serviceRoleKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is a publishable key. Use a Supabase secret key for server-side access.");
  }
  const keyParts = serviceRoleKey.split(".");
  if (keyParts.length === 3) {
    let role: string | undefined;
    try {
      role = (JSON.parse(Buffer.from(keyParts[1], "base64url").toString("utf8")) as { role?: string }).role;
    } catch {}
    if (role && role !== "service_role") {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a service-role key. Use a Supabase service_role or secret key.");
    }
  }
  client = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function fromDatabase<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((item) => fromDatabase(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
        fromDatabase(item),
      ]),
    ) as T;
  }
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value) as T;
  return value as T;
}

export function toDatabase(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toDatabase);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
        toDatabase(item),
      ]),
    );
  }
  return value;
}

export function throwDatabaseError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}
