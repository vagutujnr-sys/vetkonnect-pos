import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getClinicSettings } from "@/lib/clinic";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";

export default async function SalesPage() {
  const session = await getSession();
  const { data, error } = await supabaseAdmin()
    .from("sales")
    .select("id,receipt_number,created_at,status,total,patient:patients(name)")
    .eq("organization_id", session?.organizationId ?? "")
    .order("created_at", { ascending: false })
    .limit(50);
  throwDatabaseError(error);
  const sales = fromDatabase<{ id: string; receiptNumber: string; createdAt: Date; status: string; total: number; patient: { name: string } | null }[]>(data ?? []);
  const settings = await getClinicSettings();
  return (
    <div>
      <h1>Sales</h1>
      <div className="list">
        {sales.map((sale) => (
          <Link key={sale.id} href={`/sales/${sale.id}`}>
            <span className="stack">
              <span className="row-title">{sale.receiptNumber}</span>
              <span className="row-meta">{formatDateTime(sale.createdAt)} · {sale.patient?.name || "No patient"} · {sale.status}</span>
            </span>
            <span>{formatMoney(sale.total, settings?.currencySymbol ?? "$")}</span>
          </Link>
        ))}
        {sales.length === 0 ? <div className="row"><span className="row-meta">No sales yet.</span></div> : null}
      </div>
    </div>
  );
}
