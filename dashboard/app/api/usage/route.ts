import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/usage?actor=<actor> -> prior-activity counters for velocity policies.
// audit_log's timestamp column is `ts` (see schema.sql), not `timestamp`.
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();
  const actor = new URL(req.url).searchParams.get("actor") || "";
  const admin = createAdminClient();

  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  // count of this actor's actions in the last hour
  let countQ = admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .gte("ts", hourAgo);
  if (actor) countQ = countQ.eq("actor", actor);
  const { count } = await countQ;

  // sum of amount over the org's last 24h (money velocity)
  const { data: rows } = await admin
    .from("audit_log")
    .select("params")
    .eq("org_id", orgId)
    .gte("ts", dayAgo)
    .limit(5000);
  let dailyTotal = 0;
  for (const r of rows ?? []) {
    const amt = Number((r.params as Record<string, unknown> | null)?.amount);
    if (Number.isFinite(amt)) dailyTotal += amt;
  }

  return NextResponse.json({
    actor_action_count_1h: count ?? 0,
    daily_total: dailyTotal,
  });
}
