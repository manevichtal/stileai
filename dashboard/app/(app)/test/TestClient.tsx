"use client";

import { useState } from "react";
import { checkPrompt, PROFILES, type CheckResult, type Decision } from "@/lib/promptCheck";

const EXAMPLES = [
  "Write a cold email for our product",
  "Summarize this customer list with their emails and phone numbers",
  "Review this source code and tell me if there are vulnerabilities",
  "Create a marketing plan for Q3",
  "Upload our client contract and summarize the key terms",
];

const STYLE: Record<Decision, { label: string; bg: string; fg: string; border: string }> = {
  approved: { label: "Approved", bg: "#e8f6ee", fg: "#0f7a3d", border: "#b8e2c6" },
  admin_approval: { label: "Needs admin approval", bg: "#fef4e2", fg: "#9a6206", border: "#f4dca6" },
  denied: { label: "Denied", bg: "#fdeceb", fg: "#b42318", border: "#f4c2bd" },
};

export function TestClient() {
  const [prompt, setPrompt] = useState("");
  const [profileId, setProfileId] = useState(PROFILES[0].id);
  const [result, setResult] = useState<CheckResult | null>(null);

  const profile = PROFILES.find((p) => p.id === profileId) ?? PROFILES[0];

  function run() {
    if (!prompt.trim()) { setResult(null); return; }
    setResult(checkPrompt(prompt, profileId));
  }

  return (
    <div className="p-7 flex flex-col gap-5 max-w-[900px]">
      <div className="bg-bg2 border border-line rounded-[14px] p-4 font-mono text-[11.5px] text-ink3 leading-relaxed">
        Type an AI request the way an employee would, pick a policy profile, and StileAI checks it —
        exactly as it would before the request reached ChatGPT, Claude, Gemini, or Copilot.
      </div>

      {/* Policy profile */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] text-ink3 uppercase tracking-wide">Policy profile</span>
        <div className="flex items-center gap-1 bg-bg2 border border-line rounded-xl p-0.5 flex-wrap self-start">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              onClick={() => { setProfileId(p.id); setResult(null); }}
              className={`font-sans text-[12.5px] rounded-lg px-3 py-1.5 transition-colors ${
                profileId === p.id ? "bg-card text-ink font-semibold shadow-[0_1px_2px_rgba(16,24,40,.06)]" : "text-ink3 hover:text-ink"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-ink4">{profile.description}</p>
      </div>

      {/* Prompt */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] text-ink3 uppercase tracking-wide">The AI request to check</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run(); }}
          rows={4}
          className="w-full bg-card border border-line rounded-[12px] px-3.5 py-3 font-sans text-[13px] text-ink resize-y focus:outline-none focus:border-blue/60"
          placeholder="e.g. Summarize this customer list with their emails and phone numbers"
        />
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={run}
            className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90"
          >
            Check request
          </button>
          <span className="font-mono text-[10.5px] text-ink4">or ⌘/Ctrl + Enter</span>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="border border-line rounded-[14px] bg-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="font-sans font-bold text-[13px] rounded-lg px-3 py-1.5"
              style={{ background: STYLE[result.decision].bg, color: STYLE[result.decision].fg, border: `1px solid ${STYLE[result.decision].border}` }}
            >
              {STYLE[result.decision].label}
            </span>
            <span className="font-mono text-[11px] text-ink4">checked against “{result.profile}”</span>
          </div>
          <p className="font-sans text-[13px] text-ink leading-relaxed">{result.reason}</p>
          {result.hits.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-line">
              <span className="font-mono text-[10.5px] text-ink3 uppercase tracking-wide pt-2">Detected</span>
              {result.hits.map((h) => (
                <span key={h.category} className="font-mono text-[10.5px] text-ink2 bg-bg2 border border-line rounded-md px-2 py-1 mt-2">
                  {h.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Examples */}
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10.5px] text-ink3 uppercase tracking-wide">Try an example</span>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => { setPrompt(ex); setResult(checkPrompt(ex, profileId)); }}
              className="text-left font-mono text-[11.5px] text-ink2 bg-bg2 border border-line rounded-lg px-3 py-2 hover:border-blue/40 hover:text-ink transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
