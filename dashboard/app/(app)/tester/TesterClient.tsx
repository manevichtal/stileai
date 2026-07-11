"use client";

import { useState } from "react";
import { inputCls } from "@/components/ui";
import { checkTextAction, type TestVerdict } from "./actions";

const SAMPLES = [
  "Here's our AWS key AKIAIOSFODNN7EXAMPLE, help me rotate it",
  "Draft a reply to patient John Doe about his diagnosis and treatment plan",
  "Summarize our customer list: Acme Corp, contact jane@acme.com, $42k ARR",
  "Write a haiku about coffee",
];

const STYLE: Record<TestVerdict["effect"], { label: string; bg: string; fg: string; border: string }> = {
  allow: { label: "✓ Allowed — sent to the AI", bg: "#e8f6ee", fg: "#0f7a3d", border: "#b8e2c6" },
  require_approval: { label: "🟠 Needs admin approval", bg: "#fef4e2", fg: "#9a6206", border: "#f4dca6" },
  deny: { label: "⛔ Blocked — never leaves", bg: "#fdeaec", fg: "#b02a37", border: "#f3c4ca" },
};

export function TesterClient() {
  const [text, setText] = useState(SAMPLES[0]);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<TestVerdict | null>(null);

  async function run() {
    setBusy(true);
    setVerdict(null);
    const v = await checkTextAction(text);
    setVerdict(v);
    setBusy(false);
  }

  return (
    <div className="px-6 lg:px-8 pb-10 flex flex-col gap-4 max-w-[760px]">
      <p className="font-sans text-[12.5px] text-ink2">
        Paste anything an employee might send to ChatGPT, Claude, or Gemini and see exactly what your policy does with
        it. This runs your live engine — nothing here is logged.
      </p>

      <div className="flex flex-wrap gap-2">
        {SAMPLES.map((s, i) => (
          <button
            key={i}
            onClick={() => setText(s)}
            className="font-sans text-[11px] text-ink2 bg-bg2 border border-line rounded-full px-3 py-1 hover:bg-card"
          >
            {["Secret", "Health record", "Customer data", "Harmless"][i]}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className={inputCls("w-full font-mono text-[12.5px]")}
        placeholder="Type or paste a prompt…"
      />

      <button
        onClick={run}
        disabled={busy || !text.trim()}
        className="self-start bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-5 py-2.5 hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Checking…" : "Check against my policy"}
      </button>

      {verdict && (
        <div
          className="rounded-[14px] p-4 border"
          style={{ background: STYLE[verdict.effect].bg, borderColor: STYLE[verdict.effect].border }}
        >
          <div className="font-sans font-semibold text-[14px]" style={{ color: STYLE[verdict.effect].fg }}>
            {STYLE[verdict.effect].label}
          </div>
          <div className="font-sans text-[12.5px] text-ink2 mt-1.5">{verdict.reason}</div>
          {verdict.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {verdict.categories.map((c) => (
                <span key={c.category} className="font-sans text-[10.5px] text-ink2 bg-card border border-line rounded px-1.5 py-0.5">
                  {c.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
