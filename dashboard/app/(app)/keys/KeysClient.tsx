"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui";
import { createApiKey, revokeApiKey } from "./actions";

export type KeyRow = {
  id: string;
  label: string | null;
  key_prefix: string | null;
  created_at: string;
  last_used_at: string | null;
};

export function KeysClient({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true); setError(null);
    const res = await createApiKey(label);
    setBusy(false);
    if (res.ok) { setFreshKey(res.key); setLabel(""); router.refresh(); }
    else setError(res.error);
  }

  return (
    <div className="p-7 flex flex-col gap-6 max-w-[820px]">
      <div className="bg-bg2 border border-line rounded-[14px] p-4 flex items-end gap-3">
        <label className="flex-1 flex flex-col gap-1">
          <span className="font-sans text-[11px] text-ink2 font-medium">Create a key</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls("w-full")} placeholder="label (e.g. production-checkpoint)" />
        </label>
        <button onClick={generate} disabled={busy} className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
          {busy ? "Generating…" : "Generate key"}
        </button>
      </div>
      {error && <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{error}</div>}

      {freshKey && (
        <div className="border border-blue/40 bg-bluedim rounded-[14px] p-4">
          <div className="font-sans text-[11.5px] text-ink2 mb-2">
            Copy this key now — it&apos;s shown <span className="font-semibold text-ink">only once</span>. We store only a hash and can&apos;t show it again.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-sans text-[12px] text-ink bg-card border border-line rounded-lg px-3 py-2 break-all">{freshKey}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="font-sans text-[11.5px] text-blue border border-blue/40 rounded-lg px-3 py-2 hover:bg-card"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={() => setFreshKey(null)} className="font-sans text-[11.5px] text-ink3 px-2">dismiss</button>
          </div>

          {/* Ready-to-paste one-liner with this key already filled in. */}
          <div className="mt-4 pt-4 border-t border-blue/20">
            <div className="font-sans text-[11.5px] text-ink2 mb-2">
              <span className="font-semibold text-ink">Connect your terminal AI tools in one line.</span>{" "}
              Paste this into your Terminal — it wires up Claude Code and any OpenAI/Anthropic-SDK agent at once.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-[11.5px] text-ink bg-card border border-line rounded-lg px-3 py-2 break-all">
                curl -fsSL https://stileai.com/connect.sh | sh -s -- {freshKey}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`curl -fsSL https://stileai.com/connect.sh | sh -s -- ${freshKey}`);
                  setCopiedCmd(true);
                  setTimeout(() => setCopiedCmd(false), 1500);
                }}
                className="font-sans text-[11.5px] text-blue border border-blue/40 rounded-lg px-3 py-2 hover:bg-card whitespace-nowrap"
              >
                {copiedCmd ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="font-sans text-[10.5px] text-ink4 mt-1.5">
              Never used the Terminal? <a href="/connect-guide" className="text-blue hover:underline">Step-by-step guide with pictures →</a>
            </div>
          </div>
        </div>
      )}

      <div className="border border-line rounded-[14px] overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg2 border-b border-line">
              {["Label", "Key", "Created", "Last used", ""].map((h) => (
                <th key={h} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.length === 0 && (
              <tr><td colSpan={5} className="font-sans text-[12.5px] text-ink3 text-center py-10">No keys yet. Generate one to connect your checkpoint.</td></tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="border-b border-line last:border-0">
                <td className="px-3.5 py-3 font-sans text-[12px] text-ink">{k.label}</td>
                <td className="px-3.5 py-3 font-sans text-[12px] text-ink3">{k.key_prefix}…</td>
                <td className="px-3.5 py-3 font-sans text-[11px] text-ink3">{new Date(k.created_at).toLocaleDateString()}</td>
                <td className="px-3.5 py-3 font-sans text-[11px] text-ink3">{k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}</td>
                <td className="px-3.5 py-3 text-right"><RevokeButton id={k.id} onDone={() => router.refresh()} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RevokeButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return <button onClick={() => setConfirming(true)} className="font-sans text-[11.5px] text-ink3 hover:text-slate">Revoke</button>;
  return (
    <span className="font-sans text-[11px]">
      <span className="text-ink3 mr-1">revoke?</span>
      <button onClick={async () => { await revokeApiKey(id); onDone(); }} className="text-slate font-semibold mr-2">yes</button>
      <button onClick={() => setConfirming(false)} className="text-ink3">no</button>
    </span>
  );
}
