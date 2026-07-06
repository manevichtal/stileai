"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui";
import { updateOrgName } from "./actions";

export function SettingsClient({ orgName, origin }: { orgName: string; origin: string }) {
  const router = useRouter();
  const [name, setName] = useState(orgName);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snippet = `INTERLOCK_STORE=api
INTERLOCK_TRANSPORT=http
INTERLOCK_DASHBOARD_URL=${origin}
INTERLOCK_API_KEY=<paste a key from the API keys page>`;

  const [copied, setCopied] = useState(false);

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const res = await updateOrgName(name);
    setBusy(false);
    if (res.ok) { setSaved(true); router.refresh(); setTimeout(() => setSaved(false), 1500); }
    else setError(res.error);
  }

  return (
    <div className="p-7 flex flex-col gap-6 max-w-[720px]">
      <div className="border border-line rounded-[14px] bg-card p-5">
        <h2 className="font-sans font-semibold text-[13px] text-ink mb-3">Organization</h2>
        <label className="flex flex-col gap-1.5 max-w-[380px]">
          <span className="font-mono text-[11px] text-ink2 font-medium">Name</span>
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls("flex-1")} />
            <button onClick={save} disabled={busy || name === orgName} className="bg-blue text-white font-sans font-semibold text-[12px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
              {busy ? "…" : saved ? "Saved" : "Save"}
            </button>
          </div>
        </label>
        {error && <div className="font-mono text-[11px] text-slate mt-2">{error}</div>}
      </div>

      <div className="border border-line rounded-[14px] bg-card p-5">
        <h2 className="font-sans font-semibold text-[13px] text-ink mb-1">Connect your checkpoint</h2>
        <p className="font-mono text-[11.5px] text-ink3 mb-3 leading-relaxed">
          Set these environment variables on the machine or host running the
          Interlock MCP server. It will pull your policies from this dashboard and
          send its audit trail back — no restarts needed when you edit rules.
        </p>
        <div className="relative">
          <pre className="font-mono text-[12px] text-ink bg-bg2 border border-line rounded-lg p-3.5 overflow-x-auto whitespace-pre">{snippet}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="absolute top-2.5 right-2.5 font-mono text-[11px] text-blue border border-blue/40 bg-card rounded-md px-2.5 py-1 hover:bg-bluedim"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="font-mono text-[10.5px] text-ink4 mt-2">
          Generate the key on the API keys page. Keep it secret — anyone with it can query your policies.
        </p>
      </div>
    </div>
  );
}
