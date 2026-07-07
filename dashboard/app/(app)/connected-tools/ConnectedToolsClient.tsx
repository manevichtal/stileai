"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui";
import { addWebTool, addLocalTool, addDemoTool, setToolEnabled, deleteTool } from "./actions";

export type ToolRow = {
  id: string;
  name: string;
  transport: string;
  target: string;
  enabled: boolean;
  created_at: string;
};

export function ConnectedToolsClient({ tools, isAdmin }: { tools: ToolRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  async function addWeb() {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("url", url);
    fd.set("token", token);
    const res = await addWebTool(fd);
    setBusy(false);
    if (res.ok) { setName(""); setUrl(""); setToken(""); router.refresh(); }
    else setError(res.error);
  }

  async function addLocal() {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("command", command);
    const res = await addLocalTool(fd);
    setBusy(false);
    if (res.ok) { setName(""); setCommand(""); router.refresh(); }
    else setError(res.error);
  }

  async function addDemo() {
    setDemoBusy(true); setError(null); setDemoMessage(null);
    const res = await addDemoTool();
    setDemoBusy(false);
    if (res.ok) { setDemoMessage("Demo tool added."); router.refresh(); }
    else setError(res.error);
  }

  if (!isAdmin) {
    return (
      <div className="p-7 max-w-[820px]">
        <div className="font-mono text-[12.5px] text-ink3 bg-bg2 border border-line rounded-[14px] px-4 py-3">
          Only org admins can manage connected tools. Ask an admin to add or remove tools here.
        </div>
        <ToolsTable tools={tools} isAdmin={false} onDone={() => router.refresh()} />
      </div>
    );
  }

  return (
    <div className="p-7 flex flex-col gap-6 max-w-[820px]">
      <div className="bg-bg2 border border-line rounded-[14px] p-4 flex flex-col gap-3">
        <span className="font-mono text-[11px] text-ink2 font-medium">Add a tool</span>
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10.5px] text-ink3">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls("w-[180px]")} placeholder="my-tool" />
          </label>
          <label className="flex-1 flex flex-col gap-1 min-w-[280px]">
            <span className="font-mono text-[10.5px] text-ink3">Tool web address</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls("w-full")} placeholder="https://tools.example.com/mcp" />
          </label>
          <button onClick={addWeb} disabled={busy} className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
            {busy ? "Adding…" : "Add tool"}
          </button>
        </div>
        <label className="flex flex-col gap-1 max-w-[320px]">
          <span className="font-mono text-[10.5px] text-ink3">Access token (optional)</span>
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} className={inputCls("w-full")} placeholder="••••••••" />
        </label>
        <p className="font-mono text-[10.5px] text-ink4">
          Paste the web address your tool provider gave you. If your tool needs an API key or bearer token, paste it here — it&apos;s stored encrypted.
        </p>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={addDemo}
            disabled={demoBusy}
            className="font-mono text-[11.5px] text-blue border border-blue/40 bg-bluedim rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
          >
            {demoBusy ? "Adding…" : "Add the demo tool"}
          </button>
          <span className="font-mono text-[10.5px] text-ink4">Try it instantly — no setup needed.</span>
        </div>
        {demoMessage && <div className="font-mono text-[11.5px] text-blue">{demoMessage}</div>}

        {error && <div className="font-mono text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{error}</div>}

        <div className="pt-1 border-t border-line">
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="font-mono text-[10.5px] text-ink3 hover:text-ink2 pt-2"
          >
            {advancedOpen ? "▾ Advanced (local command)" : "▸ Advanced (local command)"}
          </button>
          {advancedOpen && (
            <div className="flex items-end gap-3 flex-wrap pt-3">
              <label className="flex-1 flex flex-col gap-1 min-w-[280px]">
                <span className="font-mono text-[10.5px] text-ink3">Command</span>
                <input value={command} onChange={(e) => setCommand(e.target.value)} className={inputCls("w-full")} placeholder="python -m sample_tools.server" />
              </label>
              <button onClick={addLocal} disabled={busy} className="bg-ink text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
                {busy ? "Adding…" : "Add local tool"}
              </button>
              <p className="font-mono text-[10.5px] text-ink4 w-full">
                Type the command as you&apos;d run it, e.g. <code>python -m sample_tools.server</code>. Quotes and complex arguments aren&apos;t supported yet.
              </p>
            </div>
          )}
        </div>
      </div>

      <ToolsTable tools={tools} isAdmin={isAdmin} onDone={() => router.refresh()} />
    </div>
  );
}

function ToolsTable({ tools, isAdmin, onDone }: { tools: ToolRow[]; isAdmin: boolean; onDone: () => void }) {
  return (
    <div className="border border-line rounded-[14px] overflow-hidden bg-card">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-bg2 border-b border-line">
            {["Name", "Transport", "Target", "Enabled", ""].map((h) => (
              <th key={h} className="text-left font-mono text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tools.length === 0 && (
            <tr><td colSpan={5} className="font-mono text-[12.5px] text-ink3 text-center py-10">No tools yet. Add one to let your checkpoint guard it.</td></tr>
          )}
          {tools.map((t) => (
            <tr key={t.id} className="border-b border-line last:border-0">
              <td className="px-3.5 py-3 font-mono text-[12px] text-ink">{t.name}</td>
              <td className="px-3.5 py-3 font-mono text-[12px] text-ink3">{t.transport}</td>
              <td className="px-3.5 py-3 font-mono text-[11.5px] text-ink3 break-all max-w-[280px]">{t.target}</td>
              <td className="px-3.5 py-3">
                {isAdmin ? (
                  <EnabledToggle id={t.id} enabled={t.enabled} onDone={onDone} />
                ) : (
                  <span className="font-mono text-[11.5px] text-ink3">{t.enabled ? "yes" : "no"}</span>
                )}
              </td>
              <td className="px-3.5 py-3 text-right">
                {isAdmin && <DeleteButton id={t.id} onDone={onDone} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnabledToggle({ id, enabled, onDone }: { id: string; enabled: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => { setBusy(true); await setToolEnabled(id, !enabled); setBusy(false); onDone(); }}
      disabled={busy}
      className={`font-mono text-[11.5px] rounded-md px-2 py-1 border ${
        enabled
          ? "text-blue border-blue/40 bg-bluedim"
          : "text-ink3 border-line bg-bg2"
      } disabled:opacity-50`}
    >
      {enabled ? "enabled" : "disabled"}
    </button>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming)
    return <button onClick={() => setConfirming(true)} className="font-mono text-[11.5px] text-ink3 hover:text-slate">Delete</button>;
  return (
    <span className="font-mono text-[11px]">
      <span className="text-ink3 mr-1">delete?</span>
      <button onClick={async () => { await deleteTool(id); onDone(); }} className="text-slate font-semibold mr-2">yes</button>
      <button onClick={() => setConfirming(false)} className="text-ink3">no</button>
    </span>
  );
}
