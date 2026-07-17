// Shared gate used by both proxy formats (OpenAI /v1/chat/completions and
// Anthropic /v1/messages): resolve the org from the StileAI key, run the prompt
// through the org's policies, log the decision, and queue an approval if needed.
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";
import { checkPrompt, redactSensitive, redactTerms, matchCustomTerms, BALANCED_RULES, decisionFromEffect, type Category, type CheckResult, type CustomTerm, type Decision } from "@/lib/promptCheck";
import { escalateIfNeeded } from "@/lib/deepInspect";
import { effectiveMode } from "@/lib/enforcementMode";
import { resolveEmployeeByKey, listEmployees } from "@/lib/employees";
import { seatedIds, isActiveStatus } from "@/lib/seats";
import { isPlatformAdmin } from "@/lib/platformAdmin";

export type { CheckResult } from "@/lib/promptCheck";

const AI_CATEGORIES = new Set<Category>(["secrets", "pii", "client_data", "financial", "legal", "phi", "source_code"]);
const DSEV: Record<Decision, number> = { approved: 0, admin_approval: 1, denied: 2 };

// Custom terms are stored as ordinary policy rows with a reserved action; the term
// text lives in `resource`. This keeps them org-scoped and RLS-protected with no
// separate table. A term tagged to a category (actor "cat:<category>") follows that
// category's live outcome; a standalone term carries its own effect.
type PolicyRow = { action?: string | null; effect?: string | null; resource?: string | null; actor?: string | null };
export function customTermsFromPolicies(pols: PolicyRow[], rules: Record<Category, Decision> | Partial<Record<Category, Decision>>): CustomTerm[] {
  return (pols ?? [])
    .filter((p) => p.action === "custom_term" && typeof p.resource === "string" && p.resource.trim().length >= 2)
    .map((p) => {
      const actor = String(p.actor ?? "");
      if (actor.startsWith("cat:")) {
        const cat = actor.slice(4) as Category;
        const dec = AI_CATEGORIES.has(cat) ? (rules[cat] ?? decisionFromEffect(String(p.effect))) : decisionFromEffect(String(p.effect));
        return { term: String(p.resource), decision: dec };
      }
      return { term: String(p.resource), decision: decisionFromEffect(String(p.effect)) };
    });
}

// The platform-owner's OWN tenant gets unlimited free seats and never needs a
// paid subscription. An org counts as the platform org when one of its members'
// emails is in PLATFORM_ADMIN_EMAILS (server-side env; a tenant can't set this).
async function isPlatformOrg(admin: ReturnType<typeof createAdminClient>, orgId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("email").eq("org_id", orgId);
  return (data ?? []).some((p) => isPlatformAdmin(p.email as string | null));
}

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
  const platformOrg = await isPlatformOrg(admin, orgId);
  // Platform org: always active, every seat free — never gated by plan/subscription.
  const subscriptionActive = platformOrg || isActiveStatus(org?.subscription_status);
  if (!emp) return { orgId, employeeId: null as string | null, isAdmin: true, subscriptionActive, seated: true };
  if (platformOrg) return { orgId, employeeId: emp.employeeId as string | null, isAdmin: false, subscriptionActive, seated: true };
  const actives = (await listEmployees(orgId)).filter((e) => e.status === "active");
  const seated = seatedIds(actives, org?.plan_seats ?? 0).has(emp.employeeId);
  return { orgId, employeeId: emp.employeeId as string | null, isAdmin: false, subscriptionActive, seated };
}

// Records a proxy request refused by the caller gate (no active seat, or the org's
// subscription is inactive) — this happens BEFORE any policy check, so gate() never
// runs for it. Mirrors gate()'s audit row so blocked seat/billing attempts still
// leave a trail. No prompt content is stored.
export async function auditCallerBlock(orgId: string, employeeId: string | null, model: string, reason: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    org_id: orgId, decision_id: "ai-" + crypto.randomUUID(), ts: new Date().toISOString(),
    actor: "employee", action: "ai.request", resource: model,
    params: { categories: [], preview: "(blocked before policy check)" },
    effect: "deny", matched_policy: null, reason, status: "denied", employee_id: employeeId ?? null,
  });
}

// The decision-maker: the org's enabled Policies drive the outcome per content
// category; unset categories fall back to safe defaults. Logs to the audit trail
// and, for admin-approval, to the Approvals queue. Never stores restricted content.
export async function gate(orgId: string, promptText: string, model: string, employeeId?: string | null): Promise<CheckResult> {
  const admin = createAdminClient();
  // Load the org's policies AND its enforcement posture in parallel.
  const [{ data: pols }, { data: settings }] = await Promise.all([
    admin.from("policies").select("action, effect, resource, actor").eq("org_id", orgId).eq("enabled", true),
    admin.from("org_policy_settings").select("enforcement_mode, monitor_until").eq("org_id", orgId).maybeSingle(),
  ]);
  const rules = { ...BALANCED_RULES };
  for (const p of pols ?? []) {
    if (AI_CATEGORIES.has(p.action as Category)) rules[p.action as Category] = decisionFromEffect(p.effect as string);
  }
  const customTerms = customTermsFromPolicies(pols ?? [], rules);
  // Free deterministic layer first, then an AI second opinion on the gray zone
  // (allowed-but-risky prompts). escalateIfNeeded applies THIS org's own rules and
  // can only tighten the decision; it never crosses tenants and never fails open.
  const free = checkPrompt(promptText, rules);
  const result = await escalateIfNeeded(orgId, promptText, rules, free);

  // Company-specific custom terms are checked on top of the built-in categories.
  // They can only tighten the decision, matching the "when in doubt, block" stance.
  const cm = matchCustomTerms(promptText, customTerms);
  if (cm.matched && DSEV[cm.decision] > DSEV[result.decision]) {
    result.decision = cm.decision;
    result.reason =
      cm.decision === "denied"
        ? "This request was blocked because it contains a term your company restricts."
        : "This request needs admin approval because it contains a term your company restricts.";
  }

  const decisionId = "ai-" + crypto.randomUUID();
  const wouldEffect = result.decision === "approved" ? "allow" : result.decision === "denied" ? "deny" : "require_approval";
  const categories: string[] = result.hits.map((h) => h.category);
  const evidence: { category: string; label: string; why: string }[] = result.hits.map((h) => ({ category: h.category, label: h.label, why: h.evidence }));
  if (cm.matched) {
    categories.push("custom");
    evidence.push({ category: "custom", label: "Custom term", why: "contains a term your company restricts" });
  }
  // Allowed: nothing sensitive was detected, so a plain preview is safe. Blocked/held:
  // store a REDACTED preview (sensitive spans + custom terms masked) — context, no raw secrets.
  const preview =
    result.decision === "approved" ? promptText.slice(0, 280) : redactTerms(redactSensitive(promptText), customTerms);

  // Monitor mode: observe-only. Log what WOULD have happened, pass the request
  // through unblocked, and never queue an approval. Enforce mode: today's behavior.
  const mode = effectiveMode(
    settings?.enforcement_mode as string | undefined,
    settings?.monitor_until as string | undefined,
    Date.now(),
  );

  if (mode === "monitor" && result.decision !== "approved") {
    await admin.from("audit_log").insert({
      org_id: orgId, decision_id: decisionId, ts: new Date().toISOString(),
      actor: "employee", action: "ai.request", resource: model,
      params: { categories, evidence, preview, monitor: true, would_effect: wouldEffect, would_reason: result.reason,
                ai_verified: result.unverified ? false : undefined },
      effect: "allow", matched_policy: result.hits[0]?.label ?? (cm.matched ? "Custom term" : null),
      reason: "Monitor mode: reported only, not blocked. " + result.reason,
      status: "monitored", employee_id: employeeId ?? null,
    });
    // Pass through: the caller gets an allow, so nothing is blocked or held.
    return {
      decision: "approved",
      reason: "Allowed. StileAI is in monitor mode (reporting only, not blocking).",
      hits: [],
      profile: result.profile,
      monitored: true,
      wouldDecision: result.decision,
    };
  }

  // Enforce mode (or a monitored-but-already-allowed request): log the real outcome.
  const effect = wouldEffect;
  const status = result.decision === "approved" ? "allowed" : result.decision === "denied" ? "denied" : "pending";
  await admin.from("audit_log").insert({
    org_id: orgId, decision_id: decisionId, ts: new Date().toISOString(),
    actor: "employee", action: "ai.request", resource: model,
    params: { categories, evidence, preview, ai_verified: result.unverified ? false : undefined },
    effect, matched_policy: result.hits[0]?.label ?? (cm.matched ? "Custom term" : null),
    reason: result.reason, status, employee_id: employeeId ?? null,
  });
  if (result.decision === "admin_approval") {
    await admin.from("approvals").insert({
      org_id: orgId, decision_id: decisionId, actor: "employee", action: "ai.request",
      resource: model, params: { categories, preview: "(restricted content hidden)" },
      reason: result.reason, matched_policy: result.hits[0]?.label ?? (cm.matched ? "Custom term" : null),
      approvals_required: 1, status: "pending", approvals: [],
    });
  }
  return result;
}

// Read-only decision for the in-dashboard Policy Tester and demos: runs the org's
// policies over a sample prompt and returns the verdict WITHOUT logging to the audit
// trail or queuing an approval. Same detection + rules as gate(), no side effects.
export async function previewDecision(orgId: string, promptText: string): Promise<CheckResult> {
  const admin = createAdminClient();
  const { data: pols } = await admin.from("policies").select("action, effect, resource, actor").eq("org_id", orgId).eq("enabled", true);
  const rules = { ...BALANCED_RULES };
  for (const p of pols ?? []) {
    if (AI_CATEGORIES.has(p.action as Category)) rules[p.action as Category] = decisionFromEffect(p.effect as string);
  }
  const result = checkPrompt(promptText, rules);
  const cm = matchCustomTerms(promptText, customTermsFromPolicies(pols ?? [], rules));
  if (cm.matched && DSEV[cm.decision] > DSEV[result.decision]) {
    result.decision = cm.decision;
    result.reason =
      cm.decision === "denied"
        ? "This request was blocked because it contains a term your company restricts."
        : "This request needs admin approval because it contains a term your company restricts.";
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
