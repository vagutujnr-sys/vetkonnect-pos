import { createClient } from "@supabase/supabase-js";

const bucket = "clinic-logos";

function storage() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase Storage is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).storage.from(bucket);
}

export async function uploadClinicLogo(path: string, file: File) {
  const store = storage();
  const { error } = await store.upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error("Clinic logo upload failed. Check the Supabase Storage setup.");
  return store.getPublicUrl(path).data.publicUrl;
}

export async function removeClinicLogo(path: string) {
  const { error } = await storage().remove([path]);
  if (error) throw new Error("Clinic logo cleanup failed.");
}