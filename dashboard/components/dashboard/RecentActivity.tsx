"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { EffectBadge } from "@/components/ui";

export type Decision = {
  decision_id: string;
  ts: string;
  actor: string | null;
  action: string | null;
  resource: string | null;
  effect: string;
  matched_policy: string | null;
};

const TABS = [
  { key: "all", label: "All activity" },
  { key: "require_approval", label: "Needs approval" },
  { key: "deny", label: "Denied" },
] as const;

function actionIcon(action: string | null): string {
  const a = action ?? "";
  if (a.startsWith("payment")) return "payment";
  if (a.startsWith("db") || a.includes("delete") || a.includes("drop")) return "database";
  if (a.startsWith("email") || a.includes("mail")) return "mail";
  if (a.endsWith(".read") || a.includes("read") || a.includes("search")) return "read";
  return "bolt";
}

function ago(ts: string): string {
  const d = new Date(ts).getTime();
  const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function RecentActivity({ decisions }: { decisions: Decision[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const rows = decisions.filter((d) => (tab === "all" ? true : d.effect === tab));

  return (
    <section className="bg-card border border-line rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-sans font-bold text-[16px] text-ink tracking-[-0.01em]">Recent activity</h2>
        <Link href="/audit" className="font-mono text-[11.5px] text-blue hover:underline">View all →</Link>
      </div>

      <div className="flex gap-5 border-b border-line mb-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2.5 -mb-px font-sans text-[12.5px] transition-colors border-b-2 ${
              tab === t.key
                ? "text-ink font-semibold border-blue"
                : "text-ink3 border-transparent hover:text-ink2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col">
        {rows.length === 0 && (
          <div className="font-mono text-[12.5px] text-ink3 py-9 text-center">
            No activity here yet. Decisions from your checkpoint will appear as they happen.
          </div>
        )}
        {rows.slice(0, 7).map((d) => (
          <div key={d.decision_id + d.ts} className="flex items-center gap-3.5 py-3 border-b border-line last:border-0">
            <div className="w-9 h-9 flex-none rounded-xl bg-bg2 border border-line flex items-center justify-center text-ink2">
              <Icon name={actionIcon(d.action)} size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-sans text-[13.5px] text-ink font-medium truncate">{d.action}</div>
              <div className="font-mono text-[11px] text-ink3 truncate">
                {d.actor} · {d.resource}
              </div>
            </div>
            <div className="hidden sm:block font-mono text-[11px] text-ink4 w-16 text-right">{ago(d.ts)}</div>
            <EffectBadge effect={d.effect} />
            <Link
              href="/audit"
              className="font-sans text-[12px] font-medium text-ink2 border border-line rounded-lg px-3 py-1.5 hover:border-line2 hover:text-ink transition-colors"
            >
              View
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
