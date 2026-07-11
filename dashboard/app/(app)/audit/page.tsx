import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/AppShell";
import { AuditFilters } from "./AuditFilters";
import { AuditTable, type AuditRow } from "./AuditTable";
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
  const employeeLabels: Record<string, string | null> = {};
  for (const e of employees) employeeLabels[e.id] = e.label;

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every decision the checkpoint has made. Click any row for the full detail; secrets stay masked." />
      <div className="p-7 flex flex-col gap-4 max-w-[1000px]">
        <AuditFilters />
        <AuditTable
          rows={(rows ?? []) as AuditRow[]}
          employeeLabels={employeeLabels}
          showEmployee={showEmployee}
        />
        {rows && rows.length === 200 && (
          <p className="font-sans text-[11px] text-ink4">Showing the most recent 200 entries. Narrow with the filters above.</p>
        )}
      </div>
    </>
  );
}
