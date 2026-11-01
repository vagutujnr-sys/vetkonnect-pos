import { NextRequest, NextResponse } from "next/server";
import { getPaynow } from "@/lib/paynow";
import { getRegistrationIntent } from "@/server/billing-db";
import { billingSupabaseAdmin } from "@/lib/billing-supabase";
import { confirmPaynowRegistration, confirmSubscriptionPayment } from "@/server/paynow";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let status;
  try {
    status = getPaynow().parseStatusUpdate(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid Paynow result." }, { status: 400 });
  }

  const reference = String(status.reference);
  try {
    const registration = await getRegistrationIntent(reference);
    if (registration) {
      if (
        registration.paymentMethod !== "PAYNOW" ||
        !registration.paynowPollUrl ||
        String(status.pollUrl) !== registration.paynowPollUrl ||
        Number(status.amount) !== 5 ||
        String(status.status).toLowerCase() !== "paid"
      ) {
        return NextResponse.json({ received: true });
      }
      await confirmPaynowRegistration(reference);
      return NextResponse.json({ received: true });
    }

    const { data: subscriptionPaymentData, error: paymentError } = await billingSupabaseAdmin()
      .from("subscription_payments")
      .select("*")
      .eq("id", reference)
      .maybeSingle();
    if (paymentError) throw new Error(paymentError.message);
    const subscriptionPayment = subscriptionPaymentData;
    if (
      !subscriptionPayment ||
      !subscriptionPayment.paynow_poll_url ||
      String(status.pollUrl) !== subscriptionPayment.paynow_poll_url ||
      Number(status.amount) !== subscriptionPayment.amount ||
      String(status.status).toLowerCase() !== "paid"
    ) {
      return NextResponse.json({ received: true });
    }
    await confirmSubscriptionPayment(reference);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paynow result processing failed", error);
    return NextResponse.json({ error: "Paynow result processing failed." }, { status: 500 });
  }
}