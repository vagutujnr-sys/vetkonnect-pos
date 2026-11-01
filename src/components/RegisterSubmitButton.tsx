"use client";

import { useFormStatus } from "react-dom";

export function RegisterSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="btn btn-primary btn-block register-wide" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="register-spinner" aria-hidden="true" />
          <span role="status">Processing registration...</span>
        </>
      ) : "Continue · $5/month"}
    </button>
  );
}
