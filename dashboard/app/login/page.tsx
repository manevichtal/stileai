"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUpAction } from "./actions";
import { Brand } from "@/components/Brand";

type Mode = "signin" | "signup";
type Plan = "starter" | "business";

const PLANS: Record<Plan, { label: string; priceLabel: string; minSeats: number }> = {
  starter: { label: "Starter", priceLabel: "$25/seat", minSeats: 5 },
  business: { label: "Business", priceLabel: "$59/seat", minSeats: 1 },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(
    searchParams.get("mode") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [plan, setPlan] = useState<Plan>("business");
  const [seats, setSeats] = useState(PLANS.business.minSeats);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function selectPlan(next: Plan) {
    setPlan(next);
    setSeats(PLANS[next].minSeats);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const res = await signUpAction(email, password, orgName);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        // establish a session so the app can load after payment returns
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInErr) {
          setError(signInErr.message);
          return;
        }
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
        return;
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        setError(signInErr.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
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
          <div className="flex border-b border-line">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className={`flex-1 py-3 font-sans text-[12.5px] transition-colors ${
                mode === "signin"
                  ? "text-blue bg-bluedim font-semibold"
                  : "text-ink3 hover:text-ink"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(null); }}
              className={`flex-1 py-3 font-sans text-[12.5px] border-l border-line transition-colors ${
                mode === "signup"
                  ? "text-blue bg-bluedim font-semibold"
                  : "text-ink3 hover:text-ink"
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={onSubmit} className="p-6 flex flex-col gap-4">
            {mode === "signup" && (
              <Field
                label="Organization name"
                hint="Your company. Becomes your isolated tenant."
                value={orgName}
                onChange={setOrgName}
                placeholder="Acme Inc."
                autoFocus
              />
            )}
            <Field
              label="Work email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              autoFocus={mode === "signin"}
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            />

            {mode === "signup" && (
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
                <span className="font-sans text-[10.5px] text-ink4">
                  Enterprise?{" "}
                  <a href="mailto:sales@stileai.com" className="text-blue hover:underline">
                    contact sales
                  </a>
                </span>
              </div>
            )}

            {mode === "signup" && (
              <Field
                label="Seats"
                hint={`Minimum ${PLANS[plan].minSeats} for ${PLANS[plan].label}.`}
                type="number"
                value={String(seats)}
                onChange={(v) => setSeats(Math.max(PLANS[plan].minSeats, Number(v) || PLANS[plan].minSeats))}
                min={PLANS[plan].minSeats}
              />
            )}

            {error && (
              <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-1 bg-blue text-white font-sans font-semibold text-[13px] rounded-lg py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {busy
                ? "Working…"
                : mode === "signup"
                  ? "Continue to payment"
                  : "Sign in"}
            </button>
          </form>
        </div>

        <p className="font-sans text-[11px] text-ink4 mt-5 text-center leading-relaxed">
          Each organization is fully isolated. Admins only ever see their own
          org&apos;s policies, audit trail, and approvals.
        </p>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
  min,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-[11.5px] text-ink2 font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        min={min}
        required
        className="font-sans text-[13px] text-ink bg-bg2 border border-line rounded-lg px-3 py-2 outline-none focus:border-blue focus:bg-card transition-colors"
      />
      {hint && <span className="font-sans text-[10.5px] text-ink4">{hint}</span>}
    </label>
  );
}
