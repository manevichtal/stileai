"use client";

import { useState } from "react";
import { EffectBadge, StatusBadge, Empty } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";

type Evidence = { category: string; label: string; why: string };
export type AuditRow = {
  decision_id: string;
  ts: string;
  actor: string;
  action: string;
  resource: string;
  effect: string;
  status: string | null;
  matched_policy: string | null;
  reason: string | null;
  employee_id?: string | null;
  params?: { categories?: string[]; evidence?: Evidence[]; preview?: string } | null;
};

export function AuditTable({
  rows,
  employeeLabels,
  showEmployee,
}: {
  rows: AuditRow[];
  employeeLabels: Record<string, string | null>;
  showEmployee: boolean;
}) {
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const cols = 5 + (showEmployee ? 1 : 0);

  const who = (r: AuditRow) =>
    r.employee_id ? employeeLabels[r.employee_id] ?? "—" : "admin key";

  return (
    <>
      <div className="border border-line rounded-[14px] overflow-hidden bg-card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-bg2 border-b border-line">
              {["Time", ...(showEmployee ? ["Employee"] : []), "AI tool", "Effect", "Detected", ""].map((h) => (
                <th key={h} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols}>
                  <Empty>No decisions yet. Once your checkpoint is live, they appear here.</Empty>
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const cats = r.params?.evidence?.length
                ? r.params.evidence.map((e) => e.label)
                : (r.params?.categories ?? []).map((c) => c);
              return (
                <tr
                  key={r.decision_id + r.ts}
                  onClick={() => setSelected(r)}
                  className="border-b border-line last:border-0 cursor-pointer hover:bg-bg2 transition-colors"
                >
                  <td className="px-3.5 py-2.5 font-sans text-[11px] text-ink3 whitespace-nowrap"><LocalTime ts={r.ts} /></td>
                  {showEmployee && <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{who(r)}</td>}
                  <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{r.resource}</td>
                  <td className="px-3.5 py-2.5"><EffectBadge effect={r.effect} /></td>
                  <td className="px-3.5 py-2.5 font-sans text-[11px] text-ink2">
                    {cats.length ? (
                      <span className="inline-flex flex-wrap gap-1">
                        {cats.slice(0, 2).map((c, i) => (
                          <span key={i} className="bg-bg2 border border-line2 rounded px-1.5 py-0.5 text-[10.5px]">{c}</span>
                        ))}
                        {cats.length > 2 && <span className="text-ink3">+{cats.length - 2}</span>}
                      </span>
                    ) : (
                      <span className="text-ink4">none</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-sans text-[11px] text-blue">details →</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <DetailDrawer row={selected} who={who(selected)} onClose={() => setSelected(null)} />}
    </>
  );
}

function DetailDrawer({ row, who, onClose }: { row: AuditRow; who: string; onClose: () => void }) {
  const ev = row.params?.evidence ?? [];
  const cats = row.params?.categories ?? [];
  const preview = row.params?.preview ?? "";
  const blocked = row.effect !== "allow";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-[460px] h-full bg-card border-l border-line shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-card">
          <div className="flex items-center gap-2.5">
            <EffectBadge effect={row.effect} />
            {row.status && <StatusBadge status={row.status} />}
          </div>
          <button onClick={onClose} className="text-ink3 hover:text-ink text-[18px] leading-none px-1">×</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <Field label="When"><LocalTime ts={row.ts} /></Field>
          <Field label="Who">{who}{row.actor ? ` · ${row.actor}` : ""}</Field>
          <Field label="AI tool">{row.resource || "—"}</Field>
          <Field label="Action">{row.action || "—"}</Field>
          <Field label="Rule that fired">{row.matched_policy ?? "— (default policy)"}</Field>

          <div>
            <FieldLabel>What was detected</FieldLabel>
            {ev.length ? (
              <div className="flex flex-col gap-2 mt-1.5">
                {ev.map((e, i) => (
                  <div key={i} className="border border-line2 rounded-lg px-3 py-2 bg-bg2">
                    <div className="font-sans text-[12px] text-ink font-medium">{e.label}</div>
                    <div className="font-sans text-[11px] text-ink3 mt-0.5">{e.why}</div>
                  </div>
                ))}
              </div>
            ) : cats.length ? (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {cats.map((c, i) => (
                  <span key={i} className="bg-bg2 border border-line2 rounded px-2 py-0.5 font-sans text-[11px] text-ink2">{c}</span>
                ))}
              </div>
            ) : (
              <div className="font-sans text-[12px] text-ink3 mt-1">Nothing restricted — general AI usage.</div>
            )}
          </div>

          <div>
            <FieldLabel>Reason</FieldLabel>
            <div className="font-sans text-[12.5px] text-ink2 mt-1 leading-relaxed">{row.reason ?? "—"}</div>
          </div>

          <div>
            <FieldLabel>Message preview</FieldLabel>
            <div className="mt-1.5 font-mono text-[12px] text-ink2 bg-bg2 border border-line rounded-lg px-3 py-2.5 whitespace-pre-wrap break-words">
              {preview || <span className="text-ink4">—</span>}
            </div>
            {blocked && (
              <div className="font-sans text-[10.5px] text-ink4 mt-1.5">
                🔒 Sensitive values are masked (••••). StileAI never stores the raw secret or personal data.
              </div>
            )}
          </div>

          <Field label="Decision ID"><span className="font-mono text-[11px]">{row.decision_id}</span></Field>

          <FeedbackSection decisionId={row.decision_id} />
        </div>
      </div>
    </div>
  );
}

// Lets an admin flag a decision as wrong. Purely a report — it never changes the
// decision. The flagged examples help tune detection and seed Phase 3 training.
function FeedbackSection({ decisionId }: { decisionId: string }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function report(kind: "false_positive" | "false_negative" | "other") {
    setState("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision_id: decisionId, kind, note }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="border-t border-line pt-4">
        <div className="font-sans text-[12px] text-blue">✓ Thanks — we logged this to improve detection.</div>
      </div>
    );
  }

  return (
    <div className="border-t border-line pt-4">
      <FieldLabel>Was this decision wrong?</FieldLabel>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional: what should have happened?"
        rows={2}
        className="mt-1.5 w-full resize-none font-sans text-[12px] text-ink bg-bg2 border border-line rounded-lg px-3 py-2 placeholder:text-ink4 focus:outline-none focus:border-blue"
      />
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          onClick={() => report("false_positive")}
          disabled={state === "sending"}
          className="font-sans text-[11.5px] text-ink2 bg-bg2 border border-line2 rounded-lg px-3 py-1.5 hover:border-blue disabled:opacity-50 transition-colors"
        >
          Over-blocked
        </button>
        <button
          onClick={() => report("false_negative")}
          disabled={state === "sending"}
          className="font-sans text-[11.5px] text-ink2 bg-bg2 border border-line2 rounded-lg px-3 py-1.5 hover:border-blue disabled:opacity-50 transition-colors"
        >
          Missed something
        </button>
        <button
          onClick={() => report("other")}
          disabled={state === "sending"}
          className="font-sans text-[11.5px] text-ink2 bg-bg2 border border-line2 rounded-lg px-3 py-1.5 hover:border-blue disabled:opacity-50 transition-colors"
        >
          Other
        </button>
      </div>
      {state === "error" && (
        <div className="font-sans text-[11px] mt-2" style={{ color: "#b02a37" }}>Could not send that report. Please try again.</div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="font-sans text-[10.5px] text-ink3 uppercase tracking-wide font-medium">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="font-sans text-[12.5px] text-ink mt-1">{children}</div>
    </div>
  );
}
