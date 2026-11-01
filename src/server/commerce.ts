import { id } from "@/lib/ids";
import { fromDatabase, supabaseAdmin, throwDatabaseError, toDatabase } from "@/lib/supabase-admin";

export type Actor = {
  id: string;
  name: string;
  role: string;
  organizationId: string;
  branchId: string;
};

export type SaleLine = {
  itemType: "SERVICE" | "MEDICATION" | "PRODUCT" | "CUSTOM";
  itemId: string;
  batchId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  skipStock?: boolean;
};

type CommitSaleInput = {
  saleId?: string;
  lines: SaleLine[];
  method: string;
  received?: number | null;
  reference?: string | null;
  patientId?: string | null;
  ownerId?: string | null;
  visitId?: string | null;
  veterinarianId?: string | null;
  notes?: string | null;
  timelineTitle?: string;
  timelineSummary?: string;
};

export async function commitSale(actor: Actor, input: CommitSaleInput) {
  if (!input.lines.length) throw new Error("Add at least one item.");
  if (input.lines.some((line) => line.quantity <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) {
    throw new Error("Sale lines must have a valid quantity and price.");
  }
  const { data, error } = await supabaseAdmin().rpc("create_sale", {
    p_sale_id: input.saleId ?? id(),
    p_organization_id: actor.organizationId,
    p_branch_id: actor.branchId,
    p_staff_id: actor.id,
    p_veterinarian_id: input.veterinarianId ?? null,
    p_patient_id: input.patientId ?? null,
    p_owner_id: input.ownerId ?? null,
    p_visit_id: input.visitId ?? null,
    p_lines: toDatabase(input.lines),
    p_method: input.method,
    p_received: input.received ?? null,
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
    p_timeline_title: input.timelineTitle ?? null,
    p_timeline_summary: input.timelineSummary ?? null,
  });
  throwDatabaseError(error);
  return fromDatabase<{ id: string; receiptNumber: string; total: number; status: string }>(data);
}

export async function refundSale(actor: Actor, saleId: string, reason: string) {
  const note = reason.trim();
  if (!note) throw new Error("A reason is required to refund.");
  const { data, error } = await supabaseAdmin().rpc("refund_sale", {
    p_sale_id: saleId,
    p_organization_id: actor.organizationId,
    p_branch_id: actor.branchId,
    p_user_id: actor.id,
    p_reason: note,
  });
  throwDatabaseError(error);
  return fromDatabase<{ id: string; receiptNumber: string; status: string }>(data);
}
