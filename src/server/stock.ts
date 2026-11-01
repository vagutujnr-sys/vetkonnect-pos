import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

type Movement = {
  itemType: string;
  itemId: string;
  batchId: string | null;
  quantity: number;
};

export async function quantityOnHand(
  itemType: string,
  itemId: string,
  batchId?: string | null,
) {
  const session = await getSession();
  if (!session) throw new Error("Sign in to check stock.");
  let query = supabaseAdmin()
    .from("stock_movements")
    .select("quantity")
    .eq("organization_id", session.organizationId)
    .eq("item_type", itemType)
    .eq("item_id", itemId);
  if (batchId !== undefined) query = batchId === null ? query.is("batch_id", null) : query.eq("batch_id", batchId);
  const { data, error } = await query;
  throwDatabaseError(error);
  return ((data ?? []) as { quantity: number }[]).reduce((total, row) => total + row.quantity, 0);
}

export async function movementTotals() {
  const organizationId = (await getSession())?.organizationId;
  if (!organizationId) return [];
  const { data, error } = await supabaseAdmin()
    .from("stock_movements")
    .select("item_type,item_id,batch_id,quantity")
    .eq("organization_id", organizationId);
  throwDatabaseError(error);
  const rows = fromDatabase<Movement[]>(data ?? []);
  const totals = new Map<string, Movement>();
  for (const row of rows) {
    const key = `${row.itemType}:${row.itemId}:${row.batchId ?? ""}`;
    const current = totals.get(key) ?? { ...row, quantity: 0 };
    current.quantity += row.quantity;
    totals.set(key, current);
  }
  return [...totals.values()].map((row) => ({
    itemType: row.itemType,
    itemId: row.itemId,
    batchId: row.batchId,
    _sum: { quantity: row.quantity },
  }));
}

export function sumQty(
  rows: Awaited<ReturnType<typeof movementTotals>>,
  itemType: string,
  itemId: string,
  batchId?: string | null,
) {
  return rows.reduce((total, row) => {
    if (row.itemType !== itemType || row.itemId !== itemId) return total;
    if (batchId !== undefined && row.batchId !== batchId) return total;
    return total + (row._sum.quantity ?? 0);
  }, 0);
}
