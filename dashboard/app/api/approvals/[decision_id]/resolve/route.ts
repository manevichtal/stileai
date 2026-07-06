import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";
import { resolveApproval } from "@/lib/resolveApproval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/approvals/{decision_id}/resolve <- { approver, approved, note }
// Records a vote and returns the updated approval object with its new status.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ decision_id: string }> },
) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  const { decision_id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await resolveApproval(
    admin,
    orgId,
    decision_id,
    String(body.approver ?? "unknown"),
    Boolean(body.approved),
    String(body.note ?? ""),
  );

  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
