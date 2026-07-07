import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/tools -> the org's enabled downstream tools, for the gateway to proxy.
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();
  const admin = createAdminClient();
  const { data } = await admin
    .from("connected_tools")
    .select("name, transport, target, auth, enabled")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("name");
  return NextResponse.json({ tools: data ?? [] });
}
