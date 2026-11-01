import { fromDatabase, supabaseAdmin, throwDatabaseError } from "./supabase-admin";
import { getSession } from "./session";

type ClinicSettingsRow = {
  id: string;
  organizationId: string;
  branchId: string;
  clinicName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  integrationId: string;
  currencySymbol: string;
  taxRate: number;
  lockTimeoutMinutes: number;
  receiptFooter: string | null;
  updatedAt: Date;
};

export async function getClinicSettings(organizationId?: string) {
  const tenantId = organizationId ?? (await getSession())?.organizationId;
  if (!tenantId) return null;
  const { data, error } = await supabaseAdmin()
    .from("clinic_settings")
    .select("*")
    .eq("organization_id", tenantId)
    .maybeSingle();
  throwDatabaseError(error);
  return data ? fromDatabase<ClinicSettingsRow>(data) : null;
}