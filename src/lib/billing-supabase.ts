import "server-only";
import { createClient } from "@supabase/supabase-js";

type BillingTable<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type BillingDatabase = {
  public: {
    Tables: {
      organizations: BillingTable<{
        id: string;
        name: string;
        slug: string;
        logo_url: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      registration_intents: BillingTable<{
        id: string;
        slug: string;
        practice_name: string;
        admin_name: string;
        email: string;
        phone: string;
        address: string;
        pin_hash: string;
        logo_url: string;
        paynow_poll_url: string | null;
        payment_method: string;
        status: string;
        created_at: string;
        completed_at: string | null;
      }>;
      subscriptions: BillingTable<{
        id: string;
        organization_id: string;
        paynow_reference: string | null;
        status: string;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        created_at: string;
        updated_at: string;
      }>;
      branches: BillingTable<{
        id: string;
        organization_id: string;
        name: string;
        created_at: string;
        updated_at: string;
      }>;
      subscription_payments: BillingTable<{
        id: string;
        organization_id: string;
        paynow_poll_url: string | null;
        status: string;
        amount: number;
        created_at: string;
        completed_at: string | null;
      }>;
      subscription_vouchers: BillingTable<{
        id: string;
        code_hash: string;
        code_suffix: string;
        status: string;
        max_redemptions: number;
        redemption_count: number;
        redeemed_at: string | null;
        redeemed_by_organization_id: string | null;
        created_by_user_id: string;
        created_at: string;
      }>;
      users: BillingTable<{
        id: string;
        organization_id: string;
        branch_id: string;
        name: string;
        role: string;
        pin_hash: string;
        email: string | null;
        password_hash: string | null;
        registration_number: string | null;
        active: boolean;
        is_demo: boolean;
        created_at: string;
        updated_at: string;
      }>;
      clinic_settings: BillingTable<{
        id: string;
        organization_id: string;
        branch_id: string;
        clinic_name: string;
        tagline: string;
        address: string;
        phone: string;
        email: string;
        integration_id: string;
        currency_symbol: string;
        lock_timeout_minutes: number;
        updated_at: string;
      }>;
      payment_methods: BillingTable<{
        id: string;
        organization_id: string | null;
        name: string;
        active: boolean;
        sort_order: number;
      }>;
      sequences: BillingTable<{
        id: string;
        organization_id: string | null;
        value: number;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      complete_practice_registration: {
        Args: {
          p_intent_id: string;
          p_payment_method: string;
          p_paynow_poll_url: string | null;
          p_code_hash: string | null;
          p_organization_id: string;
          p_branch_id: string;
          p_user_id: string;
          p_subscription_id: string;
        };
        Returns: boolean;
      };
      redeem_subscription_voucher: {
        Args: { p_code_hash: string; p_organization_id: string };
        Returns: boolean;
      };
      complete_subscription_payment: {
        Args: { p_payment_id: string; p_paynow_poll_url: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let client: ReturnType<typeof createClient<BillingDatabase>> | undefined;

export function billingSupabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase server credentials are not configured.");
  client = createClient<BillingDatabase>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
