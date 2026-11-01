import { fromDatabase, throwDatabaseError } from "@/lib/supabase-admin";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";
import { id } from "@/lib/ids";

export async function getRegistrationIntent(id: string) {
  const { data, error } = await billingSupabaseAdmin()
    .from("registration_intents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwDatabaseError(error);
  return data ? fromDatabase<{
    id: string;
    slug: string;
    practiceName: string;
    adminName: string;
    email: string;
    phone: string;
    address: string;
    pinHash: string;
    logoUrl: string;
    paynowPollUrl: string | null;
    paymentMethod: string;
    status: string;
  }>(data) : null;
}

export async function createRegistrationIntent(intent: {
  id: string;
  slug: string;
  practiceName: string;
  adminName: string;
  email: string;
  phone: string;
  address: string;
  pinHash: string;
  logoUrl: string;
  paymentMethod: string;
}) {
  const { error } = await billingSupabaseAdmin().from("registration_intents").insert({
    id: intent.id,
    slug: intent.slug,
    practice_name: intent.practiceName,
    admin_name: intent.adminName,
    email: intent.email,
    phone: intent.phone,
    address: intent.address,
    pin_hash: intent.pinHash,
    logo_url: intent.logoUrl,
    payment_method: intent.paymentMethod,
  });
  throwDatabaseError(error);
}

export async function updateRegistrationIntentPollUrl(id: string, pollUrl: string) {
  const { error } = await billingSupabaseAdmin()
    .from("registration_intents")
    .update({ paynow_poll_url: pollUrl })
    .eq("id", id);
  throwDatabaseError(error);
}

export async function deleteRegistrationIntent(id: string) {
  const { error } = await billingSupabaseAdmin().from("registration_intents").delete().eq("id", id);
  throwDatabaseError(error);
}

export async function completePracticeRegistration(input: {
  intentId: string;
  paymentMethod: "PAYNOW" | "VOUCHER";
  pollUrl?: string;
  codeHash?: string;
}) {
  const { data, error } = await billingSupabaseAdmin().rpc("complete_practice_registration", {
    p_intent_id: input.intentId,
    p_payment_method: input.paymentMethod,
    p_paynow_poll_url: input.pollUrl ?? null,
    p_code_hash: input.codeHash ?? null,
    p_organization_id: id(),
    p_branch_id: id(),
    p_user_id: id(),
    p_subscription_id: id(),
  });
  throwDatabaseError(error);
  return data === true;
}
