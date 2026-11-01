"use client";

import { useState } from "react";

export function PinPad({
  title,
  subtitle,
  onSubmit,
}: {
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function press(key: string) {
    if (busy) return;
    if (key === "C") {
      setPin("");
      setError("");
      return;
    }
    if (key === "B") {
      setPin((value) => value.slice(0, -1));
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setBusy(true);
      const result = await onSubmit(next);
      if (result && result.ok === false) {
        setError(result.error || "Incorrect PIN");
        setPin("");
      }
      setBusy(false);
    }
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "B"];

  return (
    <div>
      <div className="center">
        <h1>{title}</h1>
        {subtitle ? <p className="sub">{subtitle}</p> : null}
      </div>
      <div className="pin-dots" aria-label="PIN entry">
        {[0, 1, 2, 3].map((index) => (
          <i key={index} className={pin.length > index ? "on" : ""} />
        ))}
      </div>
      {error ? <p className="banner danger">{error}</p> : null}
      <div className="keypad">
        {keys.map((key) => (
          <button key={key} type="button" onClick={() => press(key)} aria-label={key === "B" ? "Delete" : key === "C" ? "Clear" : key}>
            {key === "B" ? "⌫" : key === "C" ? "Clear" : key}
          </button>
        ))}
      </div>
    </div>
  );
}
