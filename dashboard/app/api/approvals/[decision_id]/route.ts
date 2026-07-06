import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";
import { toPublicApproval } from "@/lib/approvals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/approvals/{decision_id} -> one approval object (powers check_status).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ decision_id: string }> },
) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  const { decision_id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("approvals")
    .select(
      "decision_id, actor, action, resource, params, reason, matched_policy, approvals_required, status, approvals",
    )
    .eq("org_id", orgId)
    .eq("decision_id", decision_id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicApproval(data));
}
