import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isExpired, isExpiringSoon } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSession } from "@/lib/session";
import { fromDatabase, supabaseAdmin, throwDatabaseError } from "@/lib/supabase-admin";
import { quantityOnHand } from "@/server/stock";

export default async function MedicinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) notFound();
  const client = supabaseAdmin();
  const { data: medicineData, error: medicineError } = await client.from("medications").select("*")
    .eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  throwDatabaseError(medicineError);
  if (!medicineData) notFound();
  const medicine = fromDatabase<{
    id: string; name: string; strength: string | null; formulation: string | null; sellingPrice: number;
    reorderLevel: number; prescriptionRequired: boolean; unit: string;
  }>(medicineData);
  const { data: batchData, error: batchError } = await client.from("medication_batches").select("*")
    .eq("organization_id", session.organizationId).eq("medication_id", medicine.id).order("expiry_date");
  throwDatabaseError(batchError);
  const batchRows = fromDatabase<{ id: string; batchNumber: string; expiryDate: Date }[]>(batchData ?? []);
  const batches = await Promise.all(batchRows.map(async (batch) => ({
    ...batch,
    onHand: await quantityOnHand("MEDICATION", medicine.id, batch.id),
  })));
  return (
    <div>
      <h1>{medicine.name}</h1>
      <p className="sub">{medicine.strength} {medicine.formulation} · {formatMoney(medicine.sellingPrice)} · Reorder at {medicine.reorderLevel}</p>
      {medicine.prescriptionRequired ? <p className="banner">Prescription required.</p> : null}
      <div className="list">
        {batches.map((batch) => {
          const expired = isExpired(batch.expiryDate);
          const soon = isExpiringSoon(batch.expiryDate, 60);
          return (
            <div key={batch.id} className="row">
              <span className="stack">
                <span className="row-title">Batch {batch.batchNumber}</span>
                <span className="row-meta">{batch.onHand} {medicine.unit} · Expires {formatDate(batch.expiryDate)}</span>
              </span>
              <span className={`tag ${expired ? "danger" : soon ? "warn" : ""}`}>{expired ? "EXPIRED" : soon ? "EXPIRING" : "OK"}</span>
            </div>
          );
        })}
      </div>
      <p className="sub">Expired batches cannot be dispensed. Use a visit or POS and choose the earliest usable batch.</p>
      <Link className="btn btn-primary btn-block" href="/pos">Sell from POS</Link>
    </div>
  );
}
