type SupabaseTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

type Tables = Record<
  | "organizations"
  | "registration_intents"
  | "subscriptions"
  | "branches"
  | "users"
  | "owners"
  | "patients"
  | "suppliers"
  | "services"
  | "service_suggestions"
  | "medications"
  | "medication_batches"
  | "products"
  | "stock_movements"
  | "visits"
  | "visit_services"
  | "visit_medications"
  | "diagnoses"
  | "vaccinations"
  | "prescriptions"
  | "prescription_items"
  | "sales"
  | "sale_items"
  | "payments"
  | "payment_methods"
  | "timeline_events"
  | "audio_notes"
  | "notifications"
  | "audit_logs"
  | "sync_queue"
  | "sequences"
  | "clinic_settings"
  | "printer_configs"
  | "subscription_payments"
  | "subscription_vouchers",
  SupabaseTable
>;

export type Database = {
  public: {
    Tables: Tables;
    Views: Record<string, never>;
    Functions: {
      next_sequence: {
        Args: { p_organization_id: string; p_key: string };
        Returns: number;
      };
      remove_demo_data: {
        Args: { p_organization_id: string; p_branch_id: string };
        Returns: undefined;
      };
      create_sale: {
        Args: {
          p_sale_id: string;
          p_organization_id: string;
          p_branch_id: string;
          p_staff_id: string;
          p_veterinarian_id: string | null;
          p_patient_id: string | null;
          p_owner_id: string | null;
          p_visit_id: string | null;
          p_lines: unknown;
          p_method: string;
          p_received: number | null;
          p_reference: string | null;
          p_notes: string | null;
          p_timeline_title: string | null;
          p_timeline_summary: string | null;
        };
        Returns: Record<string, unknown>;
      };
      refund_sale: {
        Args: {
          p_sale_id: string;
          p_organization_id: string;
          p_branch_id: string;
          p_user_id: string;
          p_reason: string;
        };
        Returns: Record<string, unknown>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
