import { supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export async function nextSequence(organizationId: string, key: string) {
  const { data, error } = await supabaseAdmin().rpc("next_sequence", {
    p_organization_id: organizationId,
    p_key: key,
  });
  throwDatabaseError(error);
  if (typeof data !== "number") throw new Error("Could not allocate the next sequence number.");
  return data;
}

export function patientNumber(value: number) {
  return `AP-${String(value).padStart(4, "0")}`;
}

export function receiptNumber(value: number, when = new Date()) {
  const y = when.getFullYear();
  const m = String(when.getMonth() + 1).padStart(2, "0");
  const d = String(when.getDate()).padStart(2, "0");
  return `R${y}${m}${d}-${String(value).padStart(4, "0")}`;
}

export function prescriptionNumber(value: number) {
  return `RX-${String(value).padStart(5, "0")}`;
}
