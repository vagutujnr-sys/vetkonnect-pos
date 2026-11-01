"use client";

import { useState } from "react";
import { startVisitAction } from "@/server/actions";

export function PatientPicker({
  query,
  patients,
}: {
  query: string;
  patients: { id: string; name: string; meta: string }[];
}) {
  const [error, setError] = useState("");
  return (
    <div>
      <form>
        <label className="field"><span>Search</span><input name="q" defaultValue={query} placeholder="Pet, owner or mobile" /></label>
      </form>
      {error ? <p className="banner danger">{error}</p> : null}
      <div className="list">
        {patients.map((patient) => (
          <button key={patient.id} className="row" type="button" onClick={async () => {
            const result = await startVisitAction(patient.id);
            if (result && result.ok === false) setError(result.error);
          }}>
            <span className="stack">
              <span className="row-title">{patient.name}</span>
              <span className="row-meta">{patient.meta}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
