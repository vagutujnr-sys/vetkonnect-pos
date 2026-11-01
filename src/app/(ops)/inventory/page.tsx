import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { categoryLabel } from "@/lib/constants";
import { inventoryView } from "@/server/queries";

const kinds = ["ALL", "MEDICATION", "FEED", "ACCESSORIES"];
const statuses = ["ALL", "IN STOCK", "LOW", "OUT", "EXPIRING", "EXPIRED"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string }> }) {
  const params = await searchParams;
  const kind = params.kind || "ALL";
  const status = params.status || "ALL";
  const rows = await inventoryView(kind, status);
  return (
    <div>
      <div className="page-head">
        <h1>Inventory</h1>
        <Link className="btn" href="/inventory/receive">Receive</Link>
      </div>
      <div className="seg">
        {kinds.map((item) => <Link key={item} className={kind === item ? "on" : ""} href={`/inventory?kind=${item}&status=${status}`}>{item === "ALL" ? "All" : item[0] + item.slice(1).toLowerCase()}</Link>)}
      </div>
      <div className="seg" style={{ marginTop: 8 }}>
        {statuses.map((item) => <Link key={item} className={status === item ? "on" : ""} href={`/inventory?kind=${kind}&status=${encodeURIComponent(item)}`}>{item === "IN STOCK" ? "In stock" : item[0] + item.slice(1).toLowerCase()}</Link>)}
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        {rows.map((row) => (
          <div key={row.key} className="row">
            <span className="stack">
              <span className="row-title">{row.name}</span>
              <span className="row-meta">
                {row.batch ? `Batch ${row.batch}` : categoryLabel(row.category)} · {row.stock} {row.unit}
                {row.expiry ? ` · ${formatDate(row.expiry)}` : ""} · {formatMoney(row.price)}
              </span>
            </span>
            <span className={`tag ${row.status === "LOW" || row.status === "EXPIRING" ? "warn" : ""} ${row.status === "OUT" || row.status === "EXPIRED" ? "danger" : ""}`}>{row.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
