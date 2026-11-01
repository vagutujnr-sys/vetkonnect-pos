import Link from "next/link";
import { endOfDay, formatDate, formatDateTime, startOfDay, toDateInput } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getClinicSettings } from "@/lib/clinic";
import { reportData } from "@/server/queries";

const types = [
  ["daily", "Daily sales"],
  ["staff", "Sales by staff"],
  ["service", "Sales by service"],
  ["payments", "Payments by method"],
  ["consultations", "Consultations"],
  ["vaccinations", "Vaccinations"],
  ["usage", "Medication usage"],
  ["stock", "Stock"],
  ["low", "Low stock"],
  ["expiring", "Expiring medication"],
  ["adjustments", "Stock adjustments"],
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ type?: string; from?: string; to?: string }> }) {
  const params = await searchParams;
  const type = params.type || "daily";
  const from = startOfDay(params.from ? new Date(params.from) : new Date());
  const to = endOfDay(params.to ? new Date(params.to) : new Date());
  const data = await reportData(type, from, to);
  const settings = await getClinicSettings();
  const symbol = settings?.currencySymbol ?? "$";
  return (
    <div>
      <h1>Reports</h1>
      <div className="seg">
        {types.map(([id, label]) => (
          <Link key={id} className={type === id ? "on" : ""} href={`/reports?type=${id}&from=${toDateInput(from)}&to=${toDateInput(to)}`}>{label}</Link>
        ))}
      </div>
      <form className="grid-2" style={{ marginTop: 12 }}>
        <input type="hidden" name="type" value={type} />
        <label className="field"><span>From</span><input type="date" name="from" defaultValue={toDateInput(from)} /></label>
        <label className="field"><span>To</span><input type="date" name="to" defaultValue={toDateInput(to)} /></label>
        <button className="btn" type="submit">Apply</button>
      </form>
      <ReportBody type={type} data={data} symbol={symbol} />
    </div>
  );
}

function ReportBody({ type, data, symbol }: { type: string; data: unknown; symbol: string }) {
  if (type === "staff" || type === "service" || type === "payments") {
    const rows = data as { name: string; count: number; total: number }[];
    return (
      <div className="list">
        {rows.map((row) => (
          <div key={row.name} className="row"><span>{row.name} · {row.count}</span><span>{formatMoney(row.total, symbol)}</span></div>
        ))}
      </div>
    );
  }
  if (type === "consultations") {
    const rows = data as { id: string; presentingComplaint: string | null; patient: { name: string; owner: { fullName: string } } }[];
    return <div className="list">{rows.map((row) => <div key={row.id} className="row"><span className="stack"><span className="row-title">{row.patient.name}</span><span className="row-meta">{row.patient.owner.fullName} · {row.presentingComplaint || "Consultation"}</span></span></div>)}</div>;
  }
  if (type === "vaccinations") {
    const rows = data as { id: string; vaccineName: string; batchNumber: string | null; administeredAt: Date; patient: { name: string } }[];
    return <div className="list">{rows.map((row) => <div key={row.id} className="row"><span className="stack"><span className="row-title">{row.patient.name} · {row.vaccineName}</span><span className="row-meta">{formatDate(row.administeredAt)} · {row.batchNumber}</span></span></div>)}</div>;
  }
  if (type === "usage" || type === "adjustments") {
    const rows = data as { id: string; itemId: string; quantity: number; movementType: string; reason: string | null; createdAt: Date }[];
    return <div className="list">{rows.map((row) => <div key={row.id} className="row"><span className="stack"><span className="row-title">{row.movementType} {row.quantity}</span><span className="row-meta">{formatDateTime(row.createdAt)} · {row.reason}</span></span></div>)}</div>;
  }
  if (type === "stock" || type === "low" || type === "expiring") {
    const rows = data as { key: string; name: string; batch?: string; stock: number; status: string; unit: string }[];
    return <div className="list">{rows.map((row) => <div key={row.key} className="row"><span className="stack"><span className="row-title">{row.name}</span><span className="row-meta">{row.batch || ""} · {row.stock} {row.unit}</span></span><span className="tag">{row.status}</span></div>)}</div>;
  }
  const sales = data as { id: string; receiptNumber: string; total: number; createdAt: Date; status: string }[];
  const total = sales.filter((sale) => sale.status === "COMPLETED").reduce((sum, sale) => sum + sale.total, 0);
  return (
    <div>
      <p className="totals"><span>Completed</span><span>{formatMoney(total, symbol)}</span></p>
      <div className="list">
        {sales.map((sale) => (
          <Link key={sale.id} href={`/sales/${sale.id}`}>
            <span className="stack"><span className="row-title">{sale.receiptNumber}</span><span className="row-meta">{formatDateTime(sale.createdAt)} · {sale.status}</span></span>
            <span>{formatMoney(sale.total, symbol)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
