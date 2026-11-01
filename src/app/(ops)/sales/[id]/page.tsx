import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getClinicSettings } from "@/lib/clinic";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { getSession } from "@/lib/session";
import { refundAction } from "@/server/actions";

export default async function SalePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await getSession();
  const { data, error: saleError } = await supabaseAdmin()
    .from("sales")
    .select("*,items:sale_items(*),payments(*),patient:patients(*,owner:owners(full_name))")
    .eq("id", id)
    .eq("organization_id", session?.organizationId ?? "")
    .maybeSingle();
  throwDatabaseError(saleError);
  const sale = data ? fromDatabase<{
    id: string;
    organizationId: string;
    receiptNumber: string;
    createdAt: Date;
    status: string;
    staffId: string;
    patient: { name: string; owner: { fullName: string } } | null;
    items: { id: string; name: string; quantity: number; lineTotal: number }[];
    payments: { id: string; method: string; received: number | null; changeGiven: number | null }[];
    total: number;
  }>(data) : null;
  if (!sale) notFound();
  const { data: staffData, error: staffError } = await supabaseAdmin()
    .from("users")
    .select("name")
    .eq("id", sale.staffId)
    .eq("organization_id", sale.organizationId)
    .maybeSingle();
  throwDatabaseError(staffError);
  const staff = staffData as { name: string } | null;
  const settings = await getClinicSettings();
  const symbol = settings?.currencySymbol ?? "$";
  return (
    <div>
      <h1>{sale.receiptNumber}</h1>
      <p className="sub">{formatDateTime(sale.createdAt)} · {sale.status} · {staff?.name}</p>
      {error ? <p className="banner danger">{error}</p> : null}
      {sale.patient ? <p>{sale.patient.name} / {sale.patient.owner.fullName}</p> : null}
      <div className="list">
        {sale.items.map((item) => (
          <div key={item.id} className="row"><span>{item.name} × {item.quantity}</span><span>{formatMoney(item.lineTotal, symbol)}</span></div>
        ))}
      </div>
      <p className="totals"><span>Total</span><span>{formatMoney(sale.total, symbol)}</span></p>
      {sale.payments.map((payment) => (
        <p key={payment.id}>{payment.method}{payment.received != null
          ? payment.method === "Cash"
            ? ` · Received ${formatMoney(payment.received, symbol)} · Change ${formatMoney(payment.changeGiven ?? 0, symbol)}`
            : ` · Paid ${formatMoney(payment.received, symbol)}`
          : ""}</p>
      ))}
      <Link className="btn btn-primary btn-block" href={`/receipts/${sale.id}`}>Print receipt</Link>
      {sale.status === "COMPLETED" ? (
        <form action={refundAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="saleId" value={sale.id} />
          <label className="field"><span>Refund reason</span><input name="reason" /></label>
          <button className="btn" type="submit">Refund sale</button>
          <p className="sub">Administered vaccine doses stay out of stock. Sold retail items return to stock.</p>
        </form>
      ) : null}
    </div>
  );
}
