"use client";

import { useState } from "react";

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not open billing portal.");
    } catch {
      setError("Could not open billing portal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={manage}
        disabled={busy}
        className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Opening…" : "Manage billing"}
      </button>
      {error && (
        <div className="mt-2 font-sans text-[11.5px] text-slate">{error}</div>
      )}
    </div>
  );
}
