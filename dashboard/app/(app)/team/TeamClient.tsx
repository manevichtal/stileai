"use client";

import { useState } from "react";
import Link from "next/link";
import { inputCls } from "@/components/ui";
import {
  inviteUserAction,
  reissueInviteAction,
  addEmployeeAction,
  disableEmployeeAction,
} from "./actions";

export type EmployeeRow = {
  id: string;
  label: string | null;
  email: string | null;
  key_prefix: string | null;
  status: string;
  created_at: string;
  last_used_at: string | null;
  connected_at: string | null;
};

function seatStatus(e: EmployeeRow): "connected" | "invited" | "disabled" {
  if (e.status !== "active") return "disabled";
  return e.connected_at ? "connected" : "invited";
}

export function TeamClient({
  employees,
  used,
  seats,
  connected,
  isAdmin,
}: {
  employees: EmployeeRow[];
  used: number;
  seats: number;
  connected: number;
  isAdmin: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; who: string } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  async function invite() {
    setBusy(true);
    setError(null);
    const res = await inviteUserAction(name, email);
    setBusy(false);
    if (res.ok) {
      setLink({ url: res.url, who: name || email });
      setName("");
      setEmail("");
    } else {
      setError(res.error);
    }
  }

  async function generateKey() {
    setBusy(true);
    setError(null);
    const res = await addEmployeeAction(name || email);
    setBusy(false);
    if (res.ok) {
      setFreshKey(res.key);
      setName("");
      setEmail("");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="px-6 lg:px-8 pb-10 flex flex-col gap-6 max-w-[900px]">
      {/* Seat usage — this is the per-user billing view */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-sans text-[12.5px] text-ink">
          <b>{used}</b> of <b>{seats}</b> seats used
        </span>
        <span className="font-sans text-[12px] text-ink3">{connected} connected · {used - connected} invited</span>
        <Link href="/billing" className="font-sans text-[12px] text-blue hover:underline ml-auto">
          Add seats from Billing
        </Link>
      </div>

      {isAdmin && (
        <div className="bg-bg2 border border-line rounded-[14px] p-4 flex flex-col gap-3">
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex-1 min-w-[140px] flex flex-col gap-1">
              <span className="font-sans text-[11px] text-ink2 font-medium">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls("w-full")} placeholder="Jordan Lee" />
            </label>
            <label className="flex-1 min-w-[160px] flex flex-col gap-1">
              <span className="font-sans text-[11px] text-ink2 font-medium">Work email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls("w-full")} placeholder="jordan@company.com" />
            </label>
            <button
              onClick={invite}
              disabled={busy}
              className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "…" : "Invite user"}
            </button>
          </div>
          <button
            onClick={() => setAdvanced((v) => !v)}
            className="self-start font-sans text-[11px] text-ink3 hover:text-slate"
          >
            {advanced ? "– hide" : "+ advanced:"} generate a raw key for API tools (Cursor, Claude Code)
          </button>
          {advanced && (
            <button
              onClick={generateKey}
              disabled={busy}
              className="self-start font-sans text-[11.5px] text-blue border border-blue/40 rounded-lg px-3 py-1.5 hover:bg-card disabled:opacity-50"
            >
              Generate raw key (uses a seat)
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">{error}</div>
      )}

      {/* Connect link produced by an invite */}
      {link && (
        <CopyCard
          title={`Send this connect link to ${link.who}`}
          hint="They install the StileAI extension, then open this link — their browser connects automatically. One-time use."
          value={link.url}
          onDone={() => setLink(null)}
        />
      )}

      {/* Raw key produced by the advanced path */}
      {freshKey && (
        <CopyCard
          title="Copy this key now — it won't be shown again"
          hint="Paste it into the user's AI tool (base URL setup) or the extension's advanced field."
          value={freshKey}
          onDone={() => {
            setFreshKey(null);
            location.reload();
          }}
        />
      )}

      <div className="border border-line rounded-[14px] overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg2 border-b border-line">
              {["User", "Status", "Last active", ""].map((h) => (
                <th key={h} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="font-sans text-[12.5px] text-ink3 text-center py-10">
                  No users yet. Invite someone to give them a protected browser.
                </td>
              </tr>
            )}
            {employees.map((e) => {
              const st = seatStatus(e);
              return (
                <tr key={e.id} className="border-b border-line last:border-0">
                  <td className="px-3.5 py-3">
                    <div className="font-sans text-[12px] text-ink">{e.label}</div>
                    {e.email && <div className="font-sans text-[11px] text-ink3">{e.email}</div>}
                  </td>
                  <td className="px-3.5 py-3 font-sans text-[11px]">
                    {st === "connected" && <span className="text-blue font-medium">● connected</span>}
                    {st === "invited" && <span className="font-medium" style={{ color: "#b8791a" }}>○ invited</span>}
                    {st === "disabled" && (
                      <span className="inline-block text-[10.5px] text-ink3 bg-bg2 border border-line2 rounded px-1.5 py-0.5">disabled</span>
                    )}
                  </td>
                  <td className="px-3.5 py-3 font-sans text-[11px] text-ink3">
                    {e.last_used_at ? new Date(e.last_used_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3.5 py-3 text-right whitespace-nowrap">
                    {isAdmin && st === "invited" && <ReissueButton id={e.id} />}
                    {isAdmin && e.status === "active" && <DisableButton id={e.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CopyCard({ title, hint, value, onDone }: { title: string; hint: string; value: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="border border-blue/40 bg-bluedim rounded-[14px] p-4">
      <div className="font-sans text-[12px] text-ink font-medium mb-1">{title}</div>
      <div className="font-sans text-[11px] text-ink2 mb-2">{hint}</div>
      <div className="flex items-center gap-2">
        <code className="flex-1 font-sans text-[12px] text-ink bg-card border border-line rounded-lg px-3 py-2 break-all">{value}</code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="font-sans text-[11.5px] text-blue border border-blue/40 rounded-lg px-3 py-2 hover:bg-card"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button onClick={onDone} className="font-sans text-[11.5px] text-ink3 px-2">done</button>
      </div>
    </div>
  );
}

function ReissueButton({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  if (url) {
    return (
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="font-sans text-[11px] text-blue mr-3"
      >
        {copied ? "link copied" : "copy link"}
      </button>
    );
  }
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await reissueInviteAction(id);
        setBusy(false);
        if (res.ok) setUrl(res.url);
      }}
      className="font-sans text-[11px] text-ink3 hover:text-slate mr-3 disabled:opacity-50"
    >
      {busy ? "…" : "get link"}
    </button>
  );
}

function DisableButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming)
    return (
      <button onClick={() => setConfirming(true)} className="font-sans text-[11.5px] text-ink3 hover:text-slate">
        Disable
      </button>
    );
  return (
    <span className="font-sans text-[11px]">
      <span className="text-ink3 mr-1">disable?</span>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await disableEmployeeAction(id);
          location.reload();
        }}
        className="text-slate font-semibold mr-2 disabled:opacity-50"
      >
        yes
      </button>
      <button onClick={() => setConfirming(false)} className="text-ink3">no</button>
    </span>
  );
}
