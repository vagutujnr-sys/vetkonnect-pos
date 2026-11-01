"use client";

export function LockButton() {
  return (
    <button className="btn" type="button" onClick={() => window.dispatchEvent(new Event("ap-lock"))}>
      Lock
    </button>
  );
}
