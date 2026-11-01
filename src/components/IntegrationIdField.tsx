"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function IntegrationIdField({ integrationId }: { integrationId?: string | null }) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyIntegrationId() {
    if (!integrationId) {
      setCopyStatus("Integration ID is unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(integrationId);
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Copy failed. Select and copy the ID.");
    }
  }

  return (
    <div className="integration-id-field">
      <label className="field">
        <span>VetConnect Integration ID</span>
        <input aria-label="VetConnect Integration ID" value={integrationId ?? "Unavailable"} readOnly />
      </label>
      <button className="btn" type="button" onClick={copyIntegrationId} disabled={!integrationId}>
        {copyStatus === "Copied." ? <Check size={16} /> : <Copy size={16} />}
        {copyStatus === "Copied." ? "Copied" : "Copy ID"}
      </button>
      <small>This identifies your practice for external integrations. It is not an API key or access credential.</small>
      {copyStatus && copyStatus !== "Copied." ? <span role="status">{copyStatus}</span> : null}
    </div>
  );
}
