"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui";
import { CATALOG, CATEGORIES, type CatalogTool } from "@/lib/toolCatalog";
import { addFromCatalog, addDemoTool } from "./actions";

export type CustomPrefill = { url?: string; command?: string };

export function ToolCatalog({ onUseCustomForm }: { onUseCustomForm: (prefill: CustomPrefill) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openTool, setOpenTool] = useState<CatalogTool | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q ? CATALOG.filter((t) => t.name.toLowerCase().includes(q)) : CATALOG;
    return CATEGORIES.map((cat) => ({
      cat,
      tools: matches.filter((t) => t.category === cat.key),
    })).filter((g) => g.tools.length > 0);
  }, [query]);

  async function addDemo() {
    setDemoBusy(true); setDemoError(null); setDemoMessage(null);
    const res = await addDemoTool();
    setDemoBusy(false);
    if (res.ok) { setDemoMessage("Demo tool added."); router.refresh(); }
    else setDemoError(res.error);
  }

  return (
    <div className="bg-bg2 border border-line rounded-[14px] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-mono text-[11px] text-ink2 font-medium">Add a tool from the catalog</span>
        <div className="flex items-center gap-3">
          <button
            onClick={addDemo}
            disabled={demoBusy}
            className="font-mono text-[11.5px] text-blue border border-blue/40 bg-bluedim rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {demoBusy ? "Adding…" : "Add the demo tool"}
          </button>
          <span className="font-mono text-[10.5px] text-ink4">Try it instantly — no setup needed.</span>
        </div>
      </div>
      {demoMessage && <div className="font-mono text-[11.5px] text-blue">{demoMessage}</div>}
      {demoError && <div className="font-mono text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{demoError}</div>}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={inputCls("w-full")}
        placeholder="Search tools — Slack, GitHub, Stripe…"
      />

      <div className="flex flex-col gap-5 max-h-[520px] overflow-y-auto pr-1">
        {groups.length === 0 && (
          <div className="font-mono text-[12px] text-ink3 py-6 text-center">No tools match &quot;{query}&quot;.</div>
        )}
        {groups.map(({ cat, tools }) => (
          <div key={cat.key} className="flex flex-col gap-2">
            <span className="font-mono text-[10.5px] text-ink3 uppercase tracking-wide">{cat.label}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setOpenTool(tool)}
                  className="text-left bg-card border border-line rounded-[10px] px-3.5 py-3 hover:border-blue/50 hover:bg-bluedim/30 transition-colors flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans font-semibold text-[13px] text-ink">{tool.name}</span>
                    <span
                      className={`font-mono text-[9.5px] uppercase tracking-wide rounded-[4px] px-1.5 py-0.5 border ${
                        tool.official
                          ? "text-blue border-blue/30 bg-bluedim"
                          : "text-ink3 border-line bg-bg2"
                      }`}
                    >
                      {tool.official ? "Official" : "Community"}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-ink3 leading-snug">{tool.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {openTool && (
        <SetupPanel
          tool={openTool}
          onClose={() => setOpenTool(null)}
          onAdded={() => { setOpenTool(null); router.refresh(); }}
          onUseCustomForm={(prefill) => { setOpenTool(null); onUseCustomForm(prefill); }}
        />
      )}
    </div>
  );
}

function SetupPanel({
  tool,
  onClose,
  onAdded,
  onUseCustomForm,
}: {
  tool: CatalogTool;
  onClose: () => void;
  onAdded: () => void;
  onUseCustomForm: (prefill: CustomPrefill) => void;
}) {
  const [name, setName] = useState(tool.name);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetForPrefill = (): CustomPrefill =>
    tool.transport === "stdio"
      ? { command: Array.isArray(tool.target) ? tool.target.join(" ") : String(tool.target) }
      : { url: typeof tool.target === "string" ? tool.target : "" };

  async function connect() {
    setBusy(true); setError(null);
    const res = await addFromCatalog(tool.id, name, creds);
    setBusy(false);
    if (res.ok) onAdded();
    else setError(res.error);
  }

  return (
    <div className="fixed inset-0 bg-[rgba(24,27,30,.35)] flex items-center justify-center z-50 p-5" onClick={onClose}>
      <div
        className="bg-card border border-line rounded-[14px] w-full max-w-[480px] max-h-[88vh] overflow-y-auto shadow-[0_30px_60px_-24px_rgba(16,24,40,.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-line flex items-start justify-between gap-3">
          <div>
            <h2 className="font-sans font-bold text-[15px] text-ink">{tool.name}</h2>
            <p className="font-mono text-[11px] text-ink3 mt-0.5">{tool.blurb}</p>
          </div>
          <button onClick={onClose} className="font-mono text-[13px] text-ink3 hover:text-ink">✕</button>
        </div>

        {tool.reuseExisting ? (
          <div className="p-5 flex flex-col gap-3">
            <div className="font-mono text-[11.5px] text-ink2 bg-bg2 border border-line rounded-lg px-3 py-2.5">
              This tool uses a one-time sign-in (OAuth), so StileAI can&apos;t take a pasteable key for it.
              Connect the {tool.name} connector you&apos;ve already set up in your environment by pointing the
              custom tool form at it.
            </div>
            <button
              onClick={() => onUseCustomForm(targetForPrefill())}
              className="bg-ink text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 self-start"
            >
              Use the custom tool form
            </button>
          </div>
        ) : (
          <div className="p-5 flex flex-col gap-3.5">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10.5px] text-ink3">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls("w-full")} placeholder={tool.name} />
            </label>

            {tool.credentials.length === 0 ? (
              <p className="font-mono text-[11px] text-ink4">No key needed for this one — just connect.</p>
            ) : (
              tool.credentials.map((cred) => (
                <label key={cred.key} className="flex flex-col gap-1">
                  <span className="font-mono text-[10.5px] text-ink3">
                    {cred.label}{cred.optional ? " (optional)" : ""}
                  </span>
                  <input
                    type="password"
                    value={creds[cred.key] ?? ""}
                    onChange={(e) => setCreds((c) => ({ ...c, [cred.key]: e.target.value }))}
                    className={inputCls("w-full")}
                    placeholder="••••••••"
                  />
                  <span className="font-mono text-[10px] text-ink4">{cred.where}</span>
                </label>
              ))
            )}

            {error && <div className="font-mono text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{error}</div>}

            <button
              onClick={connect}
              disabled={busy}
              className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50 self-start"
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
