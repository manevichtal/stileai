"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signUpAction } from "./actions";
import { Brand } from "@/components/Brand";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      }
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        setError(signInErr.message);
        return;
      }
      router.push("/");
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
          <p className="font-mono text-[12.5px] text-ink3 mt-2.5 text-center">
            The checkpoint for agentic AI.
          </p>
        </div>

        <div className="bg-card border border-line rounded-[14px] shadow-[0_1px_2px_rgba(16,24,40,.04),0_30px_60px_-34px_rgba(16,24,40,.28)] overflow-hidden">
          <div className="flex border-b border-line">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); }}
              className={`flex-1 py-3 font-mono text-[12.5px] transition-colors ${
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
              className={`flex-1 py-3 font-mono text-[12.5px] border-l border-line transition-colors ${
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

            {error && (
              <div className="font-mono text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">
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
                  ? "Create account & sign in"
                  : "Sign in"}
            </button>
          </form>
        </div>

        <p className="font-mono text-[11px] text-ink4 mt-5 text-center leading-relaxed">
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
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11.5px] text-ink2 font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required
        className="font-mono text-[13px] text-ink bg-bg2 border border-line rounded-lg px-3 py-2 outline-none focus:border-blue focus:bg-card transition-colors"
      />
      {hint && <span className="font-mono text-[10.5px] text-ink4">{hint}</span>}
    </label>
  );
}
