import { createClient } from "@supabase/supabase-js";

const clinicLogoBucket = "clinic-logos";
const patientPhotoBucket = "patient-photos";

function storage(bucket: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase Storage is not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).storage.from(bucket);
}

export async function uploadClinicLogo(path: string, file: File) {
  const store = storage(clinicLogoBucket);
  const { error } = await store.upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error("Clinic logo upload failed. Check the Supabase Storage setup.");
  return store.getPublicUrl(path).data.publicUrl;
}

export async function removeClinicLogo(path: string) {
  const { error } = await storage(clinicLogoBucket).remove([path]);
  if (error) throw new Error("Clinic logo cleanup failed.");
}

export async function uploadPatientPhoto(organizationId: string, patientId: string, file: File) {
  const objectPath = `${organizationId}/${patientId}/photo`;
  const { error } = await storage(patientPhotoBucket).upload(objectPath, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error("Patient photo upload failed. Check the Supabase Storage setup.");
  return objectPath;
}

export async function downloadPatientPhoto(objectPath: string) {
  return storage(patientPhotoBucket).download(objectPath);
}