import { requireProfileContext } from "@/lib/getProfile";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/AppShell";
import { PoliciesClient } from "./PoliciesClient";
import type { PolicyInput } from "./actions";

export const dynamic = "force-dynamic";

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireProfileContext();
  const { tab } = await searchParams;
  const supabase = await createClient();

  const [{ data: rows }, { data: settings }] = await Promise.all([
    supabase
      .from("policies")
      .select("id, policy_id, effect, priority, actor, action, resource, conditions, approvals_required, description, enabled")
      .eq("org_id", ctx.orgId)
      .order("priority", { ascending: true }),
    supabase
      .from("org_policy_settings")
      .select("default_effect, default_reason")
      .eq("org_id", ctx.orgId)
      .maybeSingle(),
  ]);

  const policies: PolicyInput[] = (rows ?? []).map((p) => ({
    id: p.id,
    policy_id: p.policy_id,
    effect: p.effect,
    priority: p.priority,
    actor: p.actor,
    action: p.action,
    resource: p.resource,
    approvals_required: p.approvals_required,
    conditions: Array.isArray(p.conditions) ? p.conditions : [],
    description: p.description ?? "",
    enabled: p.enabled,
  }));

  return (
    <>
      <PageHeader
        title="Policies"
        subtitle="The rules your AI agents must clear before acting."
      />
      <PoliciesClient
        policies={policies}
        defaultEffect={settings?.default_effect ?? "require_approval"}
        defaultReason={settings?.default_reason ?? "No policy matched — defaulting to human approval."}
        existingIds={policies.map((p) => p.policy_id)}
        initialTab={tab === "library" ? "library" : "rules"}
      />
    </>
  );
}
