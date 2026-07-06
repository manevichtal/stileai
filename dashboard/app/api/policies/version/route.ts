import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/policies/version -> a cheap value that changes whenever any policy
// (or the org's defaults) changes. The DB trigger bumps organizations.policy_version
// on every policy/settings write, so the MCP polls this and only refetches
// /api/policies when it moves.
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("policy_version")
    .eq("id", orgId)
    .maybeSingle();

  return NextResponse.json({ version: String(data?.policy_version ?? 0) });
}
