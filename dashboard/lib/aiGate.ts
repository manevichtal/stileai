// Shared gate used by both proxy formats (OpenAI /v1/chat/completions and
// Anthropic /v1/messages): resolve the org from the StileAI key, run the prompt
// through the org's policies, log the decision, and queue an approval if needed.
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";
import { checkPrompt, BALANCED_RULES, decisionFromEffect, type Category, type CheckResult } from "@/lib/promptCheck";
import { resolveEmployeeByKey, listEmployees } from "@/lib/employees";
import { seatedIds } from "@/lib/seats";

export type { CheckResult } from "@/lib/promptCheck";

const AI_CATEGORIES = new Set<Category>(["secrets", "pii", "client_data", "financial", "legal", "phi", "source_code"]);

export async function orgForKey(rawKey: string): Promise<string | null> {
  if (!rawKey) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("api_keys").select("org_id").eq("key_hash", hashApiKey(rawKey)).maybeSingle();
  return (data?.org_id as string) ?? null;
}

// Resolves the caller (employee seat, or admin/legacy org key) behind a raw
// StileAI key, plus the org's subscription/seat status needed to gate access.
// Fails closed: returns null if the key doesn't resolve to any org at all.
export async function resolveCaller(rawKey: string): Promise<{
  orgId: string;
  employeeId: string | null;
  isAdmin: boolean;
  subscriptionActive: boolean;
  seated: boolean;
} | null> {
  const admin = createAdminClient();
  const emp = await resolveEmployeeByKey(rawKey);
  const orgId = emp?.orgId ?? (await orgForKey(rawKey)); // admin/legacy key fallback
  if (!orgId) return null;
  const { data: org } = await admin.from("organizations").select("subscription_status, plan_seats").eq("id", orgId).maybeSingle();
  const subscriptionActive = (org?.subscription_status ?? "") === "active";
  if (!emp) return { orgId, employeeId: null as string | null, isAdmin: true, subscriptionActive, seated: true };
  const actives = (await listEmployees(orgId)).filter((e) => e.status === "active");
  const seated = seatedIds(actives, org?.plan_seats ?? 0).has(emp.employeeId);
  return { orgId, employeeId: emp.employeeId as string | null, isAdmin: false, subscriptionActive, seated };
}

// The decision-maker: the org's enabled Policies drive the outcome per content
// category; unset categories fall back to safe defaults. Logs to the audit trail
// and, for admin-approval, to the Approvals queue. Never stores restricted content.
export async function gate(orgId: string, promptText: string, model: string, employeeId?: string | null): Promise<CheckResult> {
  const admin = createAdminClient();
  const { data: pols } = await admin.from("policies").select("action, effect").eq("org_id", orgId).eq("enabled", true);
  const rules = { ...BALANCED_RULES };
  for (const p of pols ?? []) {
    if (AI_CATEGORIES.has(p.action as Category)) rules[p.action as Category] = decisionFromEffect(p.effect as string);
  }
  const result = checkPrompt(promptText, rules);

  const decisionId = "ai-" + crypto.randomUUID();
  const effect = result.decision === "approved" ? "allow" : result.decision === "denied" ? "deny" : "require_approval";
  const status = result.decision === "approved" ? "allowed" : result.decision === "denied" ? "denied" : "pending";
  const categories = result.hits.map((h) => h.category);
  const preview = result.decision === "approved" ? promptText.slice(0, 80) : "(restricted content hidden)";
  await admin.from("audit_log").insert({
    org_id: orgId, decision_id: decisionId, ts: new Date().toISOString(),
    actor: "employee", action: "ai.request", resource: model,
    params: { categories, preview }, effect, matched_policy: result.hits[0]?.label ?? null,
    reason: result.reason, status, employee_id: employeeId ?? null,
  });
  if (result.decision === "admin_approval") {
    await admin.from("approvals").insert({
      org_id: orgId, decision_id: decisionId, actor: "employee", action: "ai.request",
      resource: model, params: { categories, preview: "(restricted content hidden)" },
      reason: result.reason, matched_policy: result.hits[0]?.label ?? null,
      approvals_required: 1, status: "pending", approvals: [],
    });
  }
  return result;
}

// The message StileAI returns (as the AI's reply) when a request is blocked/held.
export function blockMessage(result: CheckResult): string {
  const mark = result.decision === "denied" ? "⛔" : "🟠";
  const head =
    result.decision === "denied"
      ? "Blocked by your company's AI policy."
      : "This request needs approval from your admin before it can be sent to the AI.";
  return `${mark} ${head}\n\n${result.reason}`;
}
