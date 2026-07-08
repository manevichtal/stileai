"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StatusBadge, inputCls } from "@/components/ui";
import { resolveFromDashboard } from "./actions";

export type Approval = {
  decision_id: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  params: Record<string, unknown> | null;
  reason: string | null;
  matched_policy: string | null;
  approvals_required: number;
  status: string;
  approvals: { approver: string; approved: boolean; note?: string }[];
  created_at: string;
};

export function ApprovalsClient({ pending, recent }: { pending: Approval[]; recent: Approval[] }) {
  return (
    <div className="p-7 flex flex-col gap-7 max-w-[900px]">
      <section>
        <h2 className="font-sans font-semibold text-[13px] text-ink mb-3">
          Awaiting a human · {pending.length}
        </h2>
        {pending.length === 0 ? (
          <div className="font-sans text-[12.5px] text-ink3 border border-line rounded-[14px] bg-card py-10 text-center">
            Nothing waiting. Decisions needing approval will queue here.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((a) => <PendingCard key={a.decision_id} a={a} />)}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-sans font-semibold text-[13px] text-ink mb-3">Recently resolved</h2>
          <div className="border border-line rounded-[14px] overflow-hidden bg-card">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-bg2 border-b border-line">
                  {["Actor", "Action", "Resource", "Outcome"].map((h) => (
                    <th key={h} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((a) => (
                  <tr key={a.decision_id} className="border-b border-line last:border-0">
                    <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{a.actor}</td>
                    <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink">{a.action}</td>
                    <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{a.resource}</td>
                    <td className="px-3.5 py-2.5"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function PendingCard({ a }: { a: Approval }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approved: boolean) {
    setBusy(approved ? "approve" : "reject");
    setError(null);
    const res = await resolveFromDashboard(a.decision_id, approved, note);
    setBusy(null);
    if (res.ok) router.refresh();
    else setError(res.error);
  }

  return (
    <div className="border border-line rounded-[14px] bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-sans text-[13px] text-ink">
            <span className="text-ink2">{a.actor}</span> wants to{" "}
            <span className="font-semibold">{a.action}</span>{" "}
            <span className="text-ink2">on {a.resource}</span>
          </div>
          {a.reason && <div className="font-sans text-[11.5px] text-ink3 mt-1">{a.reason}</div>}
          {a.matched_policy && <div className="font-sans text-[10.5px] text-ink4 mt-0.5">rule: {a.matched_policy} · needs {a.approvals_required} approval(s)</div>}
          {a.params && Object.keys(a.params).length > 0 && (
            <div className="mt-2 bg-bg2 border border-line rounded-lg px-3 py-2 font-sans text-[11px] text-ink2 max-w-[520px] overflow-x-auto">
              {Object.entries(a.params).map(([k, v]) => (
                <span key={k} className="mr-3"><span className="text-ink3">{k}</span> {String(v)}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5 mt-3">
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls("flex-1")} placeholder="optional note (recorded with your decision)" />
        <button onClick={() => decide(true)} disabled={!!busy} className="bg-blue text-white font-sans font-semibold text-[12px] rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-50">
          {busy === "approve" ? "…" : "Approve"}
        </button>
        <button onClick={() => decide(false)} disabled={!!busy} className="border border-line2 text-slate font-sans font-semibold text-[12px] rounded-lg px-4 py-2 hover:bg-bg3 disabled:opacity-50">
          {busy === "reject" ? "…" : "Reject"}
        </button>
      </div>
      {error && <div className="font-sans text-[11px] text-slate mt-2">{error}</div>}
    </div>
  );
}
