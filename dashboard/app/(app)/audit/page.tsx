import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/AppShell";
import { EffectBadge, StatusBadge, Empty } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { AuditFilters } from "./AuditFilters";
import { auditFloorISO, capabilitiesFor } from "@/lib/tiers";
import { listEmployees } from "@/lib/employees";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; effect?: string; since?: string }>;
}) {
  const ctx = await requireProfileContext();
  const { actor, effect, since } = await searchParams;
  const supabase = await createClient();

  const showEmployee = capabilitiesFor(ctx.plan).perEmployeeAudit;
  const floor = auditFloorISO(ctx.plan, Date.now());

  let q = showEmployee
    ? supabase
        .from("audit_log")
        .select("decision_id, ts, actor, action, resource, params, effect, matched_policy, reason, status, employee_id")
        .eq("org_id", ctx.orgId)
        .order("ts", { ascending: false })
        .limit(200)
    : supabase
        .from("audit_log")
        .select("decision_id, ts, actor, action, resource, params, effect, matched_policy, reason, status")
        .eq("org_id", ctx.orgId)
        .order("ts", { ascending: false })
        .limit(200);
  if (actor) q = q.eq("actor", actor);
  if (effect) q = q.eq("effect", effect);
  if (since) q = q.gte("ts", new Date(since).toISOString());
  // Retention floor applies IN ADDITION to any `since` filter — a plan may never
  // see rows older than its floor, no matter what it asks for. Two .gte("ts", …)
  // calls AND together, which is equivalent to using the stricter (later) bound.
  if (floor) q = q.gte("ts", floor);

  const [{ data: rows }, employees] = await Promise.all([
    q,
    showEmployee ? listEmployees(ctx.orgId) : Promise.resolve([]),
  ]);
  const employeeLabel = new Map(employees.map((e) => [e.id, e.label]));

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every decision the checkpoint has made. Secrets are redacted." />
      <div className="p-7 flex flex-col gap-4 max-w-[1000px]">
        <AuditFilters />
        <div className="border border-line rounded-[14px] overflow-hidden bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-bg2 border-b border-line">
                {[
                  "Time",
                  "Actor",
                  ...(showEmployee ? ["Employee"] : []),
                  "Action",
                  "Resource",
                  "Effect",
                  "Status",
                  "Rule",
                ].map((h) => (
                  <th key={h} className="text-left font-sans text-[10.5px] text-ink3 uppercase tracking-wide px-3.5 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={showEmployee ? 8 : 7}><Empty>No decisions yet. Once your checkpoint is live, they appear here.</Empty></td></tr>
              )}
              {(rows ?? []).map((r) => (
                <tr key={r.decision_id + r.ts} className="border-b border-line last:border-0 align-top">
                  <td className="px-3.5 py-2.5 font-sans text-[11px] text-ink3 whitespace-nowrap"><LocalTime ts={r.ts} /></td>
                  <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">{r.actor}</td>
                  {showEmployee && (
                    <td className="px-3.5 py-2.5 font-sans text-[11.5px] text-ink2">
                      {(() => {
                        const employeeId = (r as { employee_id?: string | null }).employee_id;
                        return employeeId ? (employeeLabel.get(employeeId) ?? "—") : "admin key";
                      })()}
                    </td>
                  )}
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
