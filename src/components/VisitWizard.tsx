"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioSoon } from "./AudioSoon";
import { formatMoney } from "@/lib/money";
import {
  addDiagnosisAction,
  addMedicationAction,
  confirmVaccinationAction,
  payVisitAction,
  removeMedicationAction,
  saveVisitAction,
  setServicesAction,
} from "@/server/actions";

const STEPS = ["Patient", "Service", "Exam", "Treat", "Meds", "Pay"] as const;

type Batch = { id: string; batchNumber: string; expiry: string; onHand: number; expired: boolean; expiring: boolean };
type Medicine = {
  id: string;
  name: string;
  unit: string;
  strength: string | null;
  sellingPrice: number;
  category: string;
  onHand: number;
  batches: Batch[];
};

export function VisitWizard({
  symbol,
  vets,
  methods,
  services,
  medicines,
  suggestions,
  visit,
}: {
  symbol: string;
  vets: { id: string; name: string }[];
  methods: string[];
  services: { id: string; name: string; category: string; price: number }[];
  medicines: Medicine[];
  suggestions: { serviceId: string; medicationId: string }[];
  visit: {
    id: string;
    step: string;
    veterinarianId: string | null;
    presentingComplaint: string;
    history: string;
    weight: string;
    temperature: string;
    examination: string;
    treatmentNotes: string;
    clinicalNotes: string;
    followUpDate: string;
    patient: {
      name: string;
      species: string;
      breed: string;
      sex: string;
      age: string;
      weight: string;
      alerts: string;
      allergies: string;
      owner: string;
      mobile: string;
    };
    services: { serviceId: string; name: string; price: number; quantity: number }[];
    medications: {
      id: string;
      medicationId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      dispensed: boolean;
      category: string;
    }[];
    diagnoses: { id: string; label: string }[];
  };
}) {
  const router = useRouter();
  const initial = STEPS.includes(visit.step as (typeof STEPS)[number]) ? visit.step : "Service";
  const [step, setStep] = useState(initial === "Patient" ? "Patient" : initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(visit.services.map((service) => service.serviceId));
  const [fields, setFields] = useState({
    veterinarianId: visit.veterinarianId ?? "",
    presentingComplaint: visit.presentingComplaint,
    history: visit.history,
    weight: visit.weight,
    temperature: visit.temperature,
    examination: visit.examination,
    treatmentNotes: visit.treatmentNotes,
    clinicalNotes: visit.clinicalNotes,
    followUpDate: visit.followUpDate,
  });
  const [medId, setMedId] = useState(medicines[0]?.id ?? "");
  const medicine = medicines.find((item) => item.id === medId);
  const openBatches = medicine?.batches.filter((batch) => !batch.expired && batch.onHand > 0) ?? [];
  const [batchId, setBatchId] = useState(openBatches[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [dose, setDose] = useState("1 dose");
  const [diagnosis, setDiagnosis] = useState("");
  const [method, setMethod] = useState(methods.includes("Cash") ? "Cash" : methods.find((item) => item !== "VKWallet") ?? "Cash");
  const [received, setReceived] = useState("");
  const [reference, setReference] = useState("");
  const [nextDue, setNextDue] = useState(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  });
  const [disease, setDisease] = useState("Rabies");
  const mounted = useRef(false);

  useEffect(() => {
    const next = medicines.find((item) => item.id === medId);
    const batch = next?.batches.find((item) => !item.expired && item.onHand > 0);
    setBatchId(batch?.id ?? "");
    if (next?.category === "Vaccine") setDisease(next.name.replace(" Vaccine", ""));
  }, [medId, medicines]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void saveVisitAction({
        visitId: visit.id,
        ...fields,
        veterinarianId: fields.veterinarianId || null,
        weight: fields.weight ? Number(fields.weight) : null,
        temperature: fields.temperature ? Number(fields.temperature) : null,
        followUpDate: fields.followUpDate || null,
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [fields, visit.id]);

  const serviceTotal = services
    .filter((service) => selected.includes(service.id))
    .reduce((sum, service) => sum + service.price, 0);
  const medTotal = visit.medications.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const total = serviceTotal + medTotal;
  const change = method === "Cash" ? Number(received || 0) - total : 0;
  const suggested = useMemo(
    () => medicines.filter((item) => suggestions.some((link) => selected.includes(link.serviceId) && link.medicationId === item.id)),
    [medicines, selected, suggestions],
  );

  async function go(next: string) {
    setError("");
    await saveVisitAction({
      visitId: visit.id,
      step: next,
      ...fields,
      veterinarianId: fields.veterinarianId || null,
      weight: fields.weight ? Number(fields.weight) : null,
      temperature: fields.temperature ? Number(fields.temperature) : null,
      followUpDate: fields.followUpDate || null,
    });
    setStep(next);
  }

  async function toggleService(serviceId: string) {
    const next = selected.includes(serviceId) ? selected.filter((id) => id !== serviceId) : [...selected, serviceId];
    setSelected(next);
    const result = await setServicesAction(visit.id, next);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <div>
      <div className="patient-hero">
        <div>
          <h1>{visit.patient.name}</h1>
          <p className="sub">
            {visit.patient.breed || visit.patient.species} · {visit.patient.sex} · {visit.patient.age}
            {visit.patient.weight ? ` · ${visit.patient.weight}kg` : ""}
          </p>
        </div>
      </div>
      {visit.patient.alerts ? <p className="banner danger">{visit.patient.alerts}</p> : null}
      {visit.patient.allergies ? <p className="banner">Allergy: {visit.patient.allergies}</p> : null}
      <div className="steps">
        {STEPS.map((item) => (
          <button key={item} className={step === item ? "on" : ""} type="button" onClick={() => go(item)}>
            {item}
          </button>
        ))}
      </div>
      {error ? <p className="banner danger">{error}</p> : null}

      {step === "Patient" ? (
        <div className="list">
          <div className="row">
            <span className="stack">
              <span className="row-title">{visit.patient.owner}</span>
              <span className="row-meta">{visit.patient.mobile}</span>
            </span>
          </div>
        </div>
      ) : null}

      {step === "Service" ? (
        <div className="list">
          {services.map((service) => (
            <button key={service.id} className="row" type="button" onClick={() => toggleService(service.id)}>
              <span className="stack">
                <span className="row-title">{service.name}</span>
                <span className="row-meta">{service.category}</span>
              </span>
              <span>
                {formatMoney(service.price, symbol)} {selected.includes(service.id) ? "· Added" : ""}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {step === "Exam" || step === "Treat" ? (
        <div>
          <label className="field">
            <span>Veterinarian</span>
            <select value={fields.veterinarianId} onChange={(event) => setFields({ ...fields, veterinarianId: event.target.value })}>
              <option value="">Select</option>
              {vets.map((vet) => (
                <option key={vet.id} value={vet.id}>{vet.name}</option>
              ))}
            </select>
          </label>
          {step === "Exam" ? (
            <>
              <div className="grid-2">
                <label className="field"><span>Weight (kg)</span><input inputMode="decimal" value={fields.weight} onChange={(event) => setFields({ ...fields, weight: event.target.value })} /></label>
                <label className="field"><span>Temperature (°C)</span><input inputMode="decimal" value={fields.temperature} onChange={(event) => setFields({ ...fields, temperature: event.target.value })} /></label>
              </div>
              <label className="field"><span>Presenting complaint</span><textarea value={fields.presentingComplaint} onChange={(event) => setFields({ ...fields, presentingComplaint: event.target.value })} /></label>
              <label className="field"><span>History</span><textarea value={fields.history} onChange={(event) => setFields({ ...fields, history: event.target.value })} /></label>
              <label className="field"><span>Examination</span><textarea value={fields.examination} onChange={(event) => setFields({ ...fields, examination: event.target.value })} /></label>
            </>
          ) : (
            <>
              <div className="list" style={{ marginBottom: 12 }}>
                {visit.diagnoses.map((item) => (
                  <div key={item.id} className="row"><span className="row-title">{item.label}</span></div>
                ))}
              </div>
              <div className="btn-row">
                <input value={diagnosis} placeholder="Add diagnosis" onChange={(event) => setDiagnosis(event.target.value)} />
                <button className="btn" type="button" onClick={async () => {
                  const result = await addDiagnosisAction(visit.id, diagnosis);
                  if (!result.ok) setError(result.error);
                  else {
                    setDiagnosis("");
                    router.refresh();
                  }
                }}>Add</button>
              </div>
              <label className="field"><span>Treatment</span><textarea value={fields.treatmentNotes} onChange={(event) => setFields({ ...fields, treatmentNotes: event.target.value })} /></label>
              <label className="field"><span>Clinical notes</span><textarea value={fields.clinicalNotes} onChange={(event) => setFields({ ...fields, clinicalNotes: event.target.value })} /></label>
              <label className="field"><span>Follow-up</span><input type="date" value={fields.followUpDate} onChange={(event) => setFields({ ...fields, followUpDate: event.target.value })} /></label>
              <AudioSoon label="Audio clinical note" />
            </>
          )}
        </div>
      ) : null}

      {step === "Meds" ? (
        <div>
          {suggested.length ? <p className="sub">Suggested from the selected service. Confirm what was actually given.</p> : null}
          <label className="field">
            <span>Medicine</span>
            <select value={medId} onChange={(event) => setMedId(event.target.value)}>
              {medicines.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · {item.onHand} {item.unit}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Batch · first expiry first</span>
            <select value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              {medicine?.batches.map((batch) => (
                <option key={batch.id} value={batch.id} disabled={batch.expired || batch.onHand <= 0}>
                  {batch.batchNumber} · {batch.onHand} left · exp {batch.expiry}{batch.expired ? " · EXPIRED" : batch.expiring ? " · soon" : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="grid-2">
            <label className="field"><span>Quantity</span><input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
            <label className="field"><span>Dose</span><input value={dose} onChange={(event) => setDose(event.target.value)} /></label>
          </div>
          <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={async () => {
            setBusy(true);
            const result = await addMedicationAction({ visitId: visit.id, medicationId: medId, batchId, quantity: Number(qty) || 1, dose });
            setBusy(false);
            if (!result.ok) setError(result.error);
            else router.refresh();
          }}>Add to visit</button>
          <div className="list" style={{ marginTop: 12 }}>
            {visit.medications.map((line) => (
              <div key={line.id} className="row">
                <span className="stack">
                  <span className="row-title">{line.name}</span>
                  <span className="row-meta">{line.quantity} · {line.unitPrice === 0 ? "Included in service" : formatMoney(line.unitPrice * line.quantity, symbol)}{line.dispensed ? " · Confirmed" : ""}</span>
                </span>
                {line.dispensed ? null : (
                  <button className="btn" type="button" onClick={async () => {
                    const result = await removeMedicationAction(visit.id, line.id);
                    if (!result.ok) setError(result.error);
                    else router.refresh();
                  }}>Remove</button>
                )}
              </div>
            ))}
          </div>
          {visit.medications.filter((line) => !line.dispensed && (line.category === "Vaccine" || /vaccine/i.test(line.name))).map((line) => (
            <div key={line.id} className="sheet">
              <h2>Confirm vaccination</h2>
              <p className="sub">{line.name}</p>
              <label className="field"><span>Disease</span><input value={disease} onChange={(event) => setDisease(event.target.value)} /></label>
              <label className="field"><span>Next due</span><input type="date" value={nextDue} onChange={(event) => setNextDue(event.target.value)} /></label>
              <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={async () => {
                setBusy(true);
                const result = await confirmVaccinationAction({ visitId: visit.id, lineId: line.id, disease, dose, nextDue });
                setBusy(false);
                if (!result.ok) setError(result.error);
                else router.refresh();
              }}>Confirm vaccination</button>
            </div>
          ))}
        </div>
      ) : null}

      {step === "Pay" ? (
        <div>
          <div className="list">
            {services.filter((service) => selected.includes(service.id)).map((service) => (
              <div key={service.id} className="row"><span>{service.name}</span><span>{formatMoney(service.price, symbol)}</span></div>
            ))}
            {visit.medications.map((line) => (
              <div key={line.id} className="row"><span>{line.name}</span><span>{line.unitPrice === 0 ? "Included" : formatMoney(line.unitPrice * line.quantity, symbol)}</span></div>
            ))}
          </div>
          <div className="sheet">
            <div className="totals"><span>Total</span><span>{formatMoney(total, symbol)}</span></div>
            <div className="seg" style={{ margin: "10px 0" }}>
              {methods.map((item) => (
                <button key={item} type="button" className={`${method === item ? "on" : ""}${item === "VKWallet" ? " disabled-method" : ""}`} disabled={item === "VKWallet"} aria-label={item === "VKWallet" ? "VKWallet, coming soon" : item} onClick={() => setMethod(item)}>
                  {item}{item === "VKWallet" ? <small>Coming soon</small> : null}
                </button>
              ))}
            </div>
            <label className="field">
              <span>{method === "Cash" ? "Amount received" : "Amount paid"}</span>
              <input type="number" inputMode="decimal" min={total} step="0.01" value={received} onChange={(event) => setReceived(event.target.value)} required />
            </label>
            {method !== "Cash" ? (
              <>
                <label className="field"><span>{method} reference (optional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} /></label>
                <p className="payment-note">Record the EcoCash payment here. VetKonnect does not process the funds.</p>
              </>
            ) : <p>Change {formatMoney(Math.max(0, change), symbol)}</p>}
            <button className="btn btn-primary btn-block" type="button" disabled={busy} onClick={async () => {
              if (!Number.isFinite(Number(received)) || Number(received) < total) {
                setError(`${method === "Cash" ? "Amount received" : "Amount paid"} must cover the total.`);
                return;
              }
              setBusy(true);
              setError("");
              try {
                const result = await payVisitAction({
                  visitId: visit.id,
                  method,
                  received: Number(received),
                  reference,
                });
                if (result && result.ok === false) setError(result.error);
              } catch (error) {
                setError(error instanceof Error ? error.message : "Payment was not completed.");
              } finally {
                setBusy(false);
              }
            }}>Pay {formatMoney(total, symbol)}</button>
          </div>
        </div>
      ) : null}

      {step !== "Pay" ? (
        <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} type="button" onClick={() => {
          const index = STEPS.indexOf(step as (typeof STEPS)[number]);
          go(STEPS[Math.min(STEPS.length - 1, index + 1)]);
        }}>Continue</button>
      ) : null}
    </div>
  );
}
