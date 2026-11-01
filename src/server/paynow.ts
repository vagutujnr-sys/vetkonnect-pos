import { getPaynow } from "@/lib/paynow";
import { hashVoucherCode, isValidVoucherCode } from "@/lib/vouchers";
import { fromDatabase, throwDatabaseError } from "@/lib/supabase-admin";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";
import { completePracticeRegistration, getRegistrationIntent } from "./billing-db";

export async function confirmPaynowRegistration(reference: string) {
  const intent = await getRegistrationIntent(reference);
  if (!intent || intent.paymentMethod !== "PAYNOW") return false;
  if (intent.status === "COMPLETED") return true;
  if (!intent.paynowPollUrl) return false;

  const result = await getPaynow().pollTransaction(intent.paynowPollUrl);
  if (String(result?.status).toLowerCase() !== "paid") return false;
  return completePracticeRegistration({
    intentId: reference,
    paymentMethod: "PAYNOW",
    pollUrl: intent.paynowPollUrl,
  });
}

export async function confirmVoucherRegistration(reference: string, code: string) {
  if (!isValidVoucherCode(code)) return false;
  return completePracticeRegistration({
    intentId: reference,
    paymentMethod: "VOUCHER",
    codeHash: hashVoucherCode(code),
  });
}

export async function confirmSubscriptionPayment(reference: string) {
  const { data, error } = await billingSupabaseAdmin()
    .from("subscription_payments")
    .select("*")
    .eq("id", reference)
    .maybeSingle();
  throwDatabaseError(error);
  const payment = data ? fromDatabase<{
    id: string;
    organizationId: string;
    paynowPollUrl: string | null;
    status: string;
    amount: number;
  }>(data) : null;

  if (!payment || payment.status === "COMPLETED" || !payment.paynowPollUrl || payment.amount !== 5) {
    return payment?.status === "COMPLETED";
  }
  const result = await getPaynow().pollTransaction(payment.paynowPollUrl);
  if (String(result?.status).toLowerCase() !== "paid") return false;

  const { data: completed, error: completionError } = await billingSupabaseAdmin().rpc("complete_subscription_payment", {
    p_payment_id: payment.id,
    p_paynow_poll_url: payment.paynowPollUrl,
  });
  throwDatabaseError(completionError);
  return completed === true;
}
