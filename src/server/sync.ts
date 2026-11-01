import { supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export async function checkSupabaseConnection() {
  const { error } = await supabaseAdmin().from("organizations").select("id").limit(1);
  throwDatabaseError(error);
  return { connected: true, message: "Application data is stored directly in Supabase." };
}
