import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getClinicSettings } from "@/lib/clinic";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const session = await getSession();
  if (!session) notFound();
  const client = supabaseAdmin();
  const { data: saleData, error: saleError } = await client.from("sales").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(saleError);
  if (!saleData) notFound();
  const sale = fromDatabase<{
    id: string; receiptNumber: string; staffId: string; patientId: string | null;
    createdAt: Date; total: number; status: string;
  }>(saleData);
  const [settings, itemsResult, paymentsResult, staffResult, patientResult] = await Promise.all([
    getClinicSettings(),
    client.from("sale_items").select("*").eq("organization_id", session.organizationId).eq("sale_id", sale.id),
    client.from("payments").select("*").eq("organization_id", session.organizationId).eq("sale_id", sale.id),
    client.from("users").select("name").eq("organization_id", session.organizationId).eq("id", sale.staffId).maybeSingle(),
    sale.patientId ? client.from("patients").select("id,name,owner_id").eq("organization_id", session.organizationId).eq("id", sale.patientId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  for (const result of [itemsResult, paymentsResult, staffResult, patientResult]) throwDatabaseError(result.error);
  const items = fromDatabase<{ id: string; name: string; quantity: number; lineTotal: number }[]>(itemsResult.data ?? []);
  const payments = fromDatabase<{ method: string; received: number | null; changeGiven: number | null; reference: string | null }[]>(paymentsResult.data ?? []);
  const staff = staffResult.data ? fromDatabase<{ name: string }>(staffResult.data) : null;
  const patientRow = patientResult.data ? fromDatabase<{ id: string; name: string; ownerId: string }>(patientResult.data) : null;
  let patient: { name: string; owner: { fullName: string } } | null = null;
  if (patientRow) {
    const { data, error } = await client.from("owners").select("full_name")
      .eq("organization_id", session.organizationId).eq("id", patientRow.ownerId).maybeSingle();
    throwDatabaseError(error);
    if (data) {
      const owner = fromDatabase<{ fullName: string }>(data);
      patient = { name: patientRow.name, owner };
    }
  }
  const symbol = settings?.currencySymbol ?? "$";
  const payment = payments[0];
  const a4 = query.format === "a4";
  return (
    <div>
      <div className="receipt-actions no-print">
        <Link className="btn btn-quiet" href="/pos"><ArrowLeft size={18} aria-hidden="true" />Back to POS</Link>
        <PrintButton kind="receipt" entityId={sale.id} />
        <Link className="receipt-format-link" href={a4 ? `/receipts/${sale.id}` : `/receipts/${sale.id}?format=a4`}>{a4 ? "Thermal receipt" : "A4 receipt"}</Link>
        {!a4 ? <p className="receipt-printer-hint">Choose your paired 58 mm printer in the device print dialog.</p> : null}
      </div>
      <article className={a4 ? "receipt a4" : "receipt"}>
        <img src="/logo.png" alt="" style={{ width: 88, display: "block", margin: "0 auto 8px" }} />
        <h1 className="center" style={{ fontSize: a4 ? "1.4rem" : "1rem" }}>{settings?.clinicName}</h1>
        <p className="center">{settings?.address}{settings?.phone ? ` · ${settings.phone}` : ""}</p>
        <p>{sale.receiptNumber}<br />{formatDateTime(sale.createdAt)}</p>
        {patient ? <p>{patient.owner.fullName}<br />{patient.name}</p> : null}
        <hr />
        {items.map((item) => (
          <div className="split" key={item.id}>
            <span>{item.name} × {item.quantity}</span>
            <span>{item.lineTotal === 0 ? "" : formatMoney(item.lineTotal, symbol)}</span>
          </div>
        ))}
        <hr />
        <div className="split"><strong>Total</strong><strong>{formatMoney(sale.total, symbol)}</strong></div>
        {payment ? (
          <p>
            {payment.method}
            {payment.received != null ? payment.method === "Cash"
              ? <><br />Received {formatMoney(payment.received, symbol)}<br />Change {formatMoney(payment.changeGiven ?? 0, symbol)}</>
              : <><br />Paid {formatMoney(payment.received, symbol)}</>
              : null}
            {payment.reference ? <><br />Ref {payment.reference}</> : null}
          </p>
        ) : null}
        <p>Served by {staff?.name}</p>
        <p>{settings?.receiptFooter}</p>
      </article>
    </div>
  );
}
