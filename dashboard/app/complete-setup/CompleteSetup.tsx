"use client";

import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";

export function CompleteSetup({
  email,
  orgName,
}: {
  email: string | null;
  orgName: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirected = useRef(false);

  useEffect(() => {
    const poll = async () => {
      if (redirected.current) return;
      try {
        const res = await fetch("/api/billing/status", { cache: "no-store" });
        const data = await res.json();
        if (data.active && !redirected.current) {
          redirected.current = true;
          location.href = "/dashboard";
        }
      } catch {
        // ignore transient network errors, next poll will retry
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, []);

  async function completePayment() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        location.href = data.url;
        return;
      }
      setError(data.error ?? "Could not open the billing portal.");
    } catch {
      setError("Could not open the billing portal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-7">
          <Brand />
          <p className="font-sans text-[12.5px] text-ink3 mt-2.5 text-center">
            The checkpoint for agentic AI.
          </p>
        </div>

        <div className="bg-card border border-line rounded-[14px] shadow-[0_1px_2px_rgba(16,24,40,.04),0_30px_60px_-34px_rgba(16,24,40,.28)] overflow-hidden">
          <div className="p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-sans text-[15px] font-semibold text-ink">
                Finishing setup
              </h1>
              <p className="font-sans text-[12.5px] text-ink3 leading-relaxed">
                We&apos;re confirming your subscription — this page updates
                automatically once your payment goes through.
              </p>
            </div>

            <div className="font-sans text-[11.5px] text-ink4 bg-bg2 border border-line rounded-lg px-3 py-2">
              {orgName && <div>Organization: {orgName}</div>}
              {email && <div>Signed in as {email}</div>}
            </div>

            {error && (
              <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={completePayment}
              disabled={busy}
              className="mt-1 bg-blue text-white font-sans font-semibold text-[13px] rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {busy ? "Working…" : "Complete payment"}
            </button>

            <div className="flex items-center justify-between">
              <a
                href="/login?mode=signup"
                className="font-sans text-[11.5px] text-ink3 hover:text-slate transition-colors"
              >
                Start over
              </a>
              <SignOutButton />
            </div>
          </div>
        </div>

        <p className="font-sans text-[11px] text-ink4 mt-5 text-center leading-relaxed">
          Already paid? This page checks automatically every few seconds — no
          need to refresh.
        </p>
      </div>
    </main>
  );
}
