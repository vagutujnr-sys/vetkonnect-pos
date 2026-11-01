"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stockTakeAction } from "@/server/actions";

export function StockTake({
  rows,
  canAdjust,
}: {
  canAdjust: boolean;
  rows: { key: string; name: string; batch?: string; batchId?: string; itemId: string; itemType: "MEDICATION" | "PRODUCT"; stock: number; unit: string }[];
}) {
  const [active, setActive] = useState<string | null>(null);
  const [actual, setActual] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const row = rows.find((item) => item.key === active);

  return (
    <div>
      <h1>Stock take</h1>
      <p className="sub">Count what is on the shelf. A difference records an adjustment. Stock is never overwritten.</p>
      {!canAdjust ? <p className="banner">A veterinarian confirms stock adjustments.</p> : null}
      {message ? <p className="banner ok">{message}</p> : null}
      {error ? <p className="banner danger">{error}</p> : null}
      <div className="list">
        {rows.map((item) => (
          <button key={item.key} className="row" type="button" disabled={busy} onClick={() => { setActive(item.key); setActual(String(item.stock)); setReason(""); setError(""); setMessage(""); }}>
            <span className="stack">
              <span className="row-title">{item.name}</span>
              <span className="row-meta">{item.batch ? `Batch ${item.batch}` : "Retail"} · Expected {item.stock} {item.unit}</span>
            </span>
            <span>Count</span>
          </button>
        ))}
      </div>
      {row && canAdjust ? (
        <form className="sheet" onSubmit={async (event) => {
          event.preventDefault();
          const actualQuantity = Number(actual);
          if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
            setError("Enter a valid actual quantity.");
            return;
          }
          setBusy(true);
          setError("");
          try {
            const result = await stockTakeAction({
              itemType: row.itemType,
              itemId: row.itemId,
              batchId: row.batchId,
              actual: actualQuantity,
              reason,
            });
            if (!result.ok) setError(result.error);
            else {
              setMessage(`${row.name}: expected ${result.expected}, actual ${result.actual}, variance ${result.variance}. Confirmed.`);
              setActive(null);
              router.refresh();
            }
          } catch (error) {
            setError(error instanceof Error ? error.message : "Could not save the stock count.");
          } finally {
            setBusy(false);
          }
        }}>
          <h2>{row.name}</h2>
          <p>Expected {row.stock}</p>
          <label className="field"><span>Actual quantity</span><input type="number" inputMode="decimal" min="0" step="any" value={actual} onChange={(event) => setActual(event.target.value)} required /></label>
          <p>Variance {Number(actual || 0) - row.stock}</p>
          <label className="field"><span>Reason</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Damaged dose" /></label>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? "Saving count..." : "Confirm count"}</button>
        </form>
      ) : null}
    </div>
  );
}
