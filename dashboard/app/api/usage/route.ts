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

  // sum of amount over the org's last 24h (money velocity), computed SERVER-SIDE
  // so it can never be truncated by a row cap — otherwise an agent could flood
  // the audit log with cheap calls to hide a large charge under a spend cap.
  const { data: dt } = await admin.rpc("sum_recent_amount", {
    p_org: orgId,
    p_since: dayAgo,
  });
  const dailyTotal = Number(dt) || 0;

  return NextResponse.json({
    actor_action_count_1h: count ?? 0,
    daily_total: dailyTotal,
  });
}
