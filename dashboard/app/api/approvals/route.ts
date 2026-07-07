import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";
import { toPublicApproval } from "@/lib/approvals";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/approvals <- register a decision awaiting human sign-off.
export async function POST(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body.decision_id) {
    return NextResponse.json({ error: "decision_id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("approvals").upsert(
    {
      org_id: orgId,
      decision_id: String(body.decision_id),
      actor: body.actor ?? null,
      action: body.action ?? null,
      resource: body.resource ?? null,
      params: body.params ?? {},
      reason: body.reason ?? null,
      matched_policy: body.matched_policy ?? null,
      approvals_required: Number(body.approvals_required ?? 1),
      status: (body.status as string) ?? "pending",
      approvals: body.approvals ?? [],
    },
    { onConflict: "org_id,decision_id" },
  );

  if (error) {
    return apiError(error);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

// GET /api/approvals?status=pending -> the queue.
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  const status = new URL(req.url).searchParams.get("status");

  const admin = createAdminClient();
  let q = admin
    .from("approvals")
    .select(
      "decision_id, actor, action, resource, params, reason, matched_policy, approvals_required, status, approvals, created_at",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) {
    return apiError(error);
  }
  return NextResponse.json((data ?? []).map(toPublicApproval));
}
