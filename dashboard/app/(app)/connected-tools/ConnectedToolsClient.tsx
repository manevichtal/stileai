"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls } from "@/components/ui";
import { addTool, setToolEnabled, deleteTool } from "./actions";

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
  const [transport, setTransport] = useState("stdio");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("transport", transport);
    fd.set("target", target);
    const res = await addTool(fd);
    setBusy(false);
    if (res.ok) { setName(""); setTarget(""); router.refresh(); }
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
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls("w-[180px]")} placeholder="sample-tools" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10.5px] text-ink3">Transport</span>
            <select value={transport} onChange={(e) => setTransport(e.target.value)} className={inputCls()}>
              <option value="stdio">stdio</option>
              <option value="http">http</option>
            </select>
          </label>
          <label className="flex-1 flex flex-col gap-1 min-w-[280px]">
            <span className="font-mono text-[10.5px] text-ink3">Target</span>
            <input value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls("w-full")} placeholder='["python","-m","sample_tools.server"]' />
          </label>
          <button onClick={add} disabled={busy} className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
            {busy ? "Adding…" : "Add tool"}
          </button>
        </div>
        <p className="font-mono text-[10.5px] text-ink4">
          stdio → a JSON array like [&quot;python&quot;, &quot;-m&quot;, &quot;server&quot;]; http → a URL.
        </p>
        {error && <div className="font-mono text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{error}</div>}
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
