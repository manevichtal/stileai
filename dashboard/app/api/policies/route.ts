import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/policies -> the full active ruleset in exactly the shape the engine's
// load_policies_from_dict consumes (see interlock-mcp/DASHBOARD_API.md).
export async function GET(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  const admin = createAdminClient();

  const [{ data: rows }, { data: settings }] = await Promise.all([
    admin
      .from("policies")
      .select(
        "policy_id, effect, priority, actor, action, resource, conditions, approvals_required, description",
      )
      .eq("org_id", orgId)
      .eq("enabled", true)
      .order("priority", { ascending: true }),
    admin
      .from("org_policy_settings")
      .select("default_effect, default_reason")
      .eq("org_id", orgId)
      .maybeSingle(),
  ]);

  const policies = (rows ?? []).map((p) => ({
    id: p.policy_id,
    effect: p.effect,
    priority: p.priority,
    actor: p.actor,
    action: p.action,
    resource: p.resource,
    approvals_required: p.approvals_required,
    conditions: p.conditions ?? [],
    description: p.description ?? "",
  }));

  return NextResponse.json({
    default_effect: settings?.default_effect ?? "require_approval",
    default_reason:
      settings?.default_reason ??
      "No policy matched — defaulting to human approval.",
    policies,
  });
}
