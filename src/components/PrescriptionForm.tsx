"use client";

import { useState } from "react";
import { AudioSoon } from "./AudioSoon";
import { prescriptionAction } from "@/server/actions";

const empty = { medicationName: "", strength: "", dose: "", route: "Oral", frequency: "", duration: "", quantity: "", instructions: "", repeats: 0 };

export function PrescriptionForm({ patientId, patientName }: { patientId: string; patientName: string }) {
  const [items, setItems] = useState([{ ...empty }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function update(index: number, key: string, value: string) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  return (
    <form onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      const result = await prescriptionAction({ patientId, notes, items });
      setBusy(false);
      if (result && result.ok === false) setError(result.error);
    }}>
      <h1>Prescription</h1>
      <p className="sub">{patientName}. This stays on the patient record. It does not dispense stock by itself.</p>
      {error ? <p className="banner danger">{error}</p> : null}
      {items.map((item, index) => (
        <div key={index} className="list" style={{ padding: 12, marginBottom: 10 }}>
          <label className="field"><span>Medicine</span><input value={item.medicationName} onChange={(event) => update(index, "medicationName", event.target.value)} /></label>
          <div className="grid-2">
            <label className="field"><span>Strength</span><input value={item.strength} onChange={(event) => update(index, "strength", event.target.value)} /></label>
            <label className="field"><span>Dose</span><input value={item.dose} onChange={(event) => update(index, "dose", event.target.value)} /></label>
            <label className="field"><span>Route</span><input value={item.route} onChange={(event) => update(index, "route", event.target.value)} /></label>
            <label className="field"><span>Frequency</span><input value={item.frequency} onChange={(event) => update(index, "frequency", event.target.value)} /></label>
            <label className="field"><span>Duration</span><input value={item.duration} onChange={(event) => update(index, "duration", event.target.value)} /></label>
            <label className="field"><span>Quantity</span><input value={item.quantity} onChange={(event) => update(index, "quantity", event.target.value)} /></label>
          </div>
          <label className="field"><span>Instructions</span><input value={item.instructions} onChange={(event) => update(index, "instructions", event.target.value)} /></label>
        </div>
      ))}
      <button className="btn btn-block" type="button" onClick={() => setItems((rows) => [...rows, { ...empty }])}>Add medicine</button>
      <label className="field"><span>Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <AudioSoon label="Dictate prescription" />
      <button className="btn btn-primary btn-block" disabled={busy} type="submit">Sign and preview</button>
    </form>
  );
}
