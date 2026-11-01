"use client";

import { startVisitAction } from "@/server/actions";
import { useState } from "react";

export function StartVisit({ patientId, label }: { patientId: string; label: string }) {
  const [error, setError] = useState("");
  return (
    <form action={async () => {
      const result = await startVisitAction(patientId);
      if (result && result.ok === false) setError(result.error);
    }} style={{ flex: 1 }}>
      <button className="btn btn-primary btn-block" type="submit">{label}</button>
      {error ? <span className="row-meta">{error}</span> : null}
    </form>
  );
}
