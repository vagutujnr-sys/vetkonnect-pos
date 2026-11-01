import { id } from "@/lib/ids";
import { supabaseAdmin, throwDatabaseError, toDatabase } from "@/lib/supabase-admin";

type AuditInput = {
  organizationId: string;
  branchId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: unknown;
};

export async function writeAudit(input: AuditInput) {
  const { error } = await supabaseAdmin().from("audit_logs").insert(toDatabase({
    id: id(),
    organizationId: input.organizationId,
    branchId: input.branchId,
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    details: input.details ? JSON.stringify(input.details) : null,
  }) as never);
  throwDatabaseError(error);
}

export async function writeSupabaseAudit(input: AuditInput) {
  return writeAudit(input);
}
