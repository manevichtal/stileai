import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/AppShell";
import { EffectBadge, StatusBadge, Empty } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { AuditFilters } from "./AuditFilters";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; effect?: string; since?: string }>;
}) {
  const ctx = await requireProfileContext();
  const { actor, effect, since } = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("audit_log")
    .select("decision_id, ts, actor, action, resource, params, effect, matched_policy, reason, status")
    .eq("org_id", ctx.orgId)
    .order("ts", { ascending: false })
    .limit(200);
  if (actor) q = q.eq("actor", actor);
  if (effect) q = q.eq("effect", effect);
  if (since) q = q.gte("ts", new Date(since).toISOString());

  const { data: rows } = await q;

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every decision the checkpoint has made. Secrets are redacted." />
      <div className="p-7 flex flex-col gap-4 max-w-[1000px]">
        <AuditFilters />
        <div className="border border-line rounded-[14px] overflow-hidden bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg2 border-b border-line">
                {["Time", "Actor", "Action", "Resource", "Effect", "Status", "Rule"].map((h) => (
                  <th key={h} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={7}><Empty>No decisions yet. Once your checkpoint is live, they appear here.</Empty></td></tr>
              )}
              {(rows ?? []).map((r) => (
                <tr key={r.decision_id + r.ts} className="border-b border-line last:border-0 align-top">
                  <td className="px-3.5 py-2.5 font-sans text-[11px] text-ink3 whitespace-nowrap"><LocalTime ts={r.ts} /></td>
                  <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{r.actor}</td>
                  <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink">{r.action}</td>
                  <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{r.resource}</td>
                  <td className="px-3.5 py-2.5"><EffectBadge effect={r.effect} /></td>
                  <td className="px-3.5 py-2.5">{r.status ? <StatusBadge status={r.status} /> : null}</td>
                  <td className="px-3.5 py-2.5 font-sans text-[11px] text-ink3">{r.matched_policy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length === 200 && (
          <p className="font-sans text-[11px] text-ink4">Showing the most recent 200 entries. Narrow with the filters above.</p>
        )}
      </div>
    </>
  );
}
