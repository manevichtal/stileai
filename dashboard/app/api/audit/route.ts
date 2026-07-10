import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";
import { apiError } from "@/lib/apiError";
import { auditFloorISO } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/audit <- one decision entry (params already redacted by the MCP).
// Append-only; a 2xx is all the MCP needs.
export async function POST(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    org_id: orgId,
    decision_id: String(body.decision_id ?? ""),
    ts: (body.timestamp as string) ?? new Date().toISOString(),
    actor: body.actor ?? null,
    action: body.action ?? null,
    resource: body.resource ?? null,
    params: body.params ?? {},
    effect: body.effect ?? null,
    matched_policy: body.matched_policy ?? null,
    reason: body.reason ?? null,
    status: body.status ?? null,
  });

  if (error) {
    return apiError(error);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/audit?limit=&actor=&effect= -> recent rows, newest first, in the same
// shape the MCP posted (ts is returned as `timestamp`).
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 1),
    500,
  );
  const actor = url.searchParams.get("actor");
  const effect = url.searchParams.get("effect");

  const admin = createAdminClient();

  // Fail closed: if we can't read the org's plan, we cannot safely compute the
  // retention floor, so refuse rather than default to unlimited history.
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .maybeSingle();
  if (orgErr) return apiError(orgErr);
  const floor = auditFloorISO(org?.plan ?? null, Date.now());

  let q = admin
    .from("audit_log")
    .select(
      "decision_id, ts, actor, action, resource, params, effect, matched_policy, reason, status",
    )
    .eq("org_id", orgId)
    .order("ts", { ascending: false })
    .limit(limit);
  if (actor) q = q.eq("actor", actor);
  if (effect) q = q.eq("effect", effect);
  // Retention floor: a Starter org's API key must never be able to read rows
  // older than its plan allows, regardless of `limit`.
  if (floor) q = q.gte("ts", floor);

  const { data, error } = await q;
  if (error) {
    return apiError(error);
  }

  const rows = (data ?? []).map((r) => ({
    decision_id: r.decision_id,
    timestamp: r.ts,
    actor: r.actor,
    action: r.action,
    resource: r.resource,
    params: r.params,
    effect: r.effect,
    matched_policy: r.matched_policy,
    reason: r.reason,
    status: r.status,
  }));
  return NextResponse.json(rows);
}
