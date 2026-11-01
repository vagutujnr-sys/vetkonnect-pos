import Link from "next/link";
import { medicationCatalog } from "@/server/queries";

export default async function PharmacyPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const meds = await medicationCatalog();
  const query = q.trim().toLowerCase();
  const rows = meds.filter((med) => !query || med.name.toLowerCase().includes(query) || (med.genericName ?? "").toLowerCase().includes(query));
  return (
    <div>
      <h1>Pharmacy</h1>
      <form>
        <label className="field"><span>Search medicine</span><input name="q" defaultValue={q} /></label>
      </form>
      <div className="list">
        {rows.map((med) => {
          const soon = med.batches.find((batch) => batch.onHand > 0);
          return (
            <Link key={med.id} href={`/pharmacy/${med.id}`}>
              <span className="stack">
                <span className="row-title">{med.name}</span>
                <span className="row-meta">{med.onHand} {med.unit} · {soon ? `Next batch ${soon.batchNumber}` : "No stock"}</span>
              </span>
              <span className={`tag ${med.onHand <= med.reorderLevel ? "warn" : ""}`}>{med.onHand <= 0 ? "OUT" : med.onHand <= med.reorderLevel ? "LOW" : "IN STOCK"}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
