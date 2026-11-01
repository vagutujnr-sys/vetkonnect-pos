import { StockTake } from "@/components/StockTake";
import { getSession } from "@/lib/session";
import { inventoryView } from "@/server/queries";

export default async function StockTakePage() {
  const session = await getSession();
  const rows = await inventoryView("ALL", "ALL");
  return (
    <StockTake
      canAdjust={session?.role === "VET" || session?.role === "SUPER_ADMIN"}
      rows={rows.map((row) => ({
        key: row.key,
        name: row.name,
        batch: row.batch,
        batchId: row.batchId,
        itemId: row.itemId,
        itemType: row.kind === "MEDICATION" ? "MEDICATION" : "PRODUCT",
        stock: row.stock,
        unit: row.unit,
      }))}
    />
  );
}
