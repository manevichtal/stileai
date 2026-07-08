"use client";

import { useState } from "react";
import Link from "next/link";
import { inputCls } from "@/components/ui";
import { addEmployeeAction, disableEmployeeAction } from "./actions";

export type EmployeeRow = {
  id: string;
  label: string | null;
  key_prefix: string | null;
  status: string;
  created_at: string;
  last_used_at: string | null;
};

export function TeamClient({
  employees,
  used,
  seats,
  isAdmin,
}: {
  employees: EmployeeRow[];
  used: number;
  seats: number;
  isAdmin: boolean;
}) {
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshKey, setFreshKey] = useState<{ key: string; prefix: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function add() {
    setBusy(true);
    setError(null);
    const res = await addEmployeeAction(label);
    setBusy(false);
    if (res.ok) {
      setFreshKey({ key: res.key, prefix: res.prefix });
      setLabel("");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="px-6 lg:px-8 pb-10 flex flex-col gap-6 max-w-[900px]">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[12.5px] text-ink2">
          {used} of {seats} seats used
        </span>
        <Link href="/billing" className="font-sans text-[12px] text-blue hover:underline">
          Add seats from Billing
        </Link>
      </div>

      {isAdmin && (
        <div className="bg-bg2 border border-line rounded-[14px] p-4 flex items-end gap-3">
          <label className="flex-1 flex flex-col gap-1">
            <span className="font-sans text-[11px] text-ink2 font-medium">Add employee</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls("w-full")}
              placeholder="name or email"
            />
          </label>
          <button
            onClick={add}
            disabled={busy}
            className="bg-blue text-white font-sans font-semibold text-[12.5px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add employee"}
          </button>
        </div>
      )}
      {error && (
        <div className="font-sans text-[11.5px] text-slate bg-bg3 border border-line2 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {freshKey && (
        <div className="border border-blue/40 bg-bluedim rounded-[14px] p-4">
          <div className="font-sans text-[11.5px] text-ink2 mb-2">
            Copy this key now — it won&apos;t be shown again. Put it in this employee&apos;s AI tool.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-sans text-[12px] text-ink bg-card border border-line rounded-lg px-3 py-2 break-all">
              {freshKey.key}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(freshKey.key);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="font-sans text-[11.5px] text-blue border border-blue/40 rounded-lg px-3 py-2 hover:bg-card"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => {
                setFreshKey(null);
                location.reload();
              }}
              className="font-sans text-[11.5px] text-ink3 px-2"
            >
              done
            </button>
          </div>
        </div>
      )}

      <div className="border border-line rounded-[14px] overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg2 border-b border-line">
              {["Label", "Key", "Status", "Added", ""].map((h) => (
                <th
                  key={h}
                  className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="font-sans text-[12.5px] text-ink3 text-center py-10">
                  No employees yet. Add one to give them a personal key.
                </td>
              </tr>
            )}
            {employees.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0">
                <td className="px-3.5 py-3 font-sans text-[12px] text-ink">{e.label}</td>
                <td className="px-3.5 py-3 font-sans text-[12px] text-ink3">{e.key_prefix}…</td>
                <td className="px-3.5 py-3 font-sans text-[11px]">
                  {e.status === "active" ? (
                    <span className="text-blue font-medium">active</span>
                  ) : (
                    <span className="inline-block font-sans text-[10.5px] text-ink3 bg-bg2 border border-line2 rounded px-1.5 py-0.5">
                      disabled
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-3 font-sans text-[11px] text-ink3">
                  {new Date(e.created_at).toLocaleDateString()}
                </td>
                <td className="px-3.5 py-3 text-right">
                  {isAdmin && e.status === "active" && <DisableButton id={e.id} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
      <button onClick={() => setConfirming(false)} className="text-ink3">
        no
      </button>
    </span>
  );
}
