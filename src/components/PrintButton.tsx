"use client";

import { useEffect, useState } from "react";

export function PrintButton({
  kind,
  entityId,
  auto,
}: {
  kind: "receipt" | "prescription" | "vaccination-certificate";
  entityId: string;
  auto?: boolean;
}) {
  const [error, setError] = useState("");

  async function recordPrint(reprint: boolean) {
    const response = await fetch(`/api/print/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId, reprint }),
    });
    const data = await response.json() as { error?: string; message?: string };
    if (!response.ok) throw new Error(data.error ?? "Could not record this print.");
    if (data.message) window.alert(data.message);
  }

  function print(reprint: boolean) {
    setError("");
    window.print();
    void recordPrint(reprint).catch((printError: unknown) => {
      setError(printError instanceof Error ? printError.message : "Could not record this print.");
    });
  }

  useEffect(() => {
    if (!auto) return;
    setError("");
    void recordPrint(false).then(() => window.print()).catch((printError: unknown) => {
      setError(printError instanceof Error ? printError.message : "Could not record this print.");
    });
    // Print automatically only when the page is opened with an explicit auto-print request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return (
    <>
      <div className="no-print btn-row" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" type="button" onClick={() => print(false)}>Print</button>
        <button className="btn" type="button" onClick={() => print(true)}>Reprint</button>
      </div>
      {error ? <p className="no-print banner danger" role="alert">{error}</p> : null}
    </>
  );
}
