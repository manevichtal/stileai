"use client";

import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";

type Plan = "starter" | "business";

const PLANS: Record<Plan, { label: string; priceLabel: string; minSeats: number }> = {
  starter: { label: "Starter", priceLabel: "$25/seat", minSeats: 5 },
  business: { label: "Business", priceLabel: "$59/seat", minSeats: 1 },
};

export function CompleteSetup({
  email,
  orgName,
  hasBilling,
}: {
  email: string | null;
  orgName: string;
  hasBilling: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan>("business");
  const [seats, setSeats] = useState(PLANS.business.minSeats);
  const redirected = useRef(false);

  function selectPlan(next: Plan) {
    setPlan(next);
    setSeats(PLANS[next].minSeats);
  }

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

  async function startCheckout() {
    setError(null);
    setBusy(true);
    try {
      const co = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, seats }),
      }).then((r) => r.json());
      if (co.url) {
        location.href = co.url;
        return;
      }
      setError(co.error ?? "Could not start checkout.");
    } catch {
      setError("Could not start checkout.");
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

            {!hasBilling && (
              <div className="flex flex-col gap-1.5">
                <span className="font-sans text-[11.5px] text-ink2 font-medium">Plan</span>
                <div className="flex gap-2">
                  {(Object.keys(PLANS) as Plan[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectPlan(id)}
                      aria-pressed={plan === id}
                      className={`flex-1 flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors ${
                        plan === id
                          ? "border-blue bg-bluedim"
                          : "border-line bg-bg2 hover:border-line2"
                      }`}
                    >
                      <span
                        className={`font-sans text-[12.5px] font-semibold ${
                          plan === id ? "text-blue" : "text-ink"
                        }`}
                      >
                        {PLANS[id].label}
                      </span>
                      <span className="font-sans text-[10.5px] text-ink4">
                        {PLANS[id].priceLabel}
                        {PLANS[id].minSeats > 1 ? ` · min ${PLANS[id].minSeats} seats` : ""}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1.5 mt-1.5">
                  <span className="font-sans text-[11.5px] text-ink2 font-medium">Seats</span>
                  <input
                    type="number"
                    value={seats}
                    min={PLANS[plan].minSeats}
                    onChange={(e) =>
                      setSeats(Math.max(PLANS[plan].minSeats, Number(e.target.value) || PLANS[plan].minSeats))
                    }
                    className="font-sans text-[13px] text-ink bg-bg2 border border-line rounded-lg px-3 py-2 outline-none focus:border-blue focus:bg-card transition-colors"
                  />
                  <span className="font-sans text-[10.5px] text-ink4">
                    Minimum {PLANS[plan].minSeats} for {PLANS[plan].label}.
                  </span>
                </label>
              </div>
            )}

            {error && (
              <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {hasBilling ? (
              <button
                type="button"
                onClick={completePayment}
                disabled={busy}
                className="mt-1 bg-blue text-white font-sans font-semibold text-[13px] rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy ? "Working…" : "Complete payment"}
              </button>
            ) : (
              <button
                type="button"
                onClick={startCheckout}
                disabled={busy}
                className="mt-1 bg-blue text-white font-sans font-semibold text-[13px] rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {busy ? "Working…" : "Continue to payment"}
              </button>
            )}

            <div className="flex items-center justify-end">
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
