"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileContext } from "@/lib/getProfile";
import { packByKey } from "@/lib/policyTemplates";
import { packAllowed } from "@/lib/tiers";
import { isEnforcementMode, monitorUntilFrom } from "@/lib/enforcementMode";
import {
  CATEGORY_META,
  PROTECTION_LEVELS,
  COMPLIANCE_PRESETS,
  type Effect,
} from "@/lib/protection";
import type { Category } from "@/lib/promptCheck";

export type Condition = { field: string; op: string; value: unknown };
export type PolicyInput = {
  id?: string; // db uuid when editing
  policy_id: string;
  effect: string;
  priority: number;
  actor: string;
  action: string;
  resource: string;
  approvals_required: number;
  conditions: Condition[];
  description: string;
  enabled: boolean;
};

type Result = { ok: true } | { ok: false; error: string };

// Coerce condition values: numeric strings -> numbers, "true"/"false" -> bool,
// comma lists for in/not_in -> arrays. Keeps the engine's comparisons meaningful.
function coerceValue(op: string, raw: unknown): unknown {
  if (op === "exists") return raw === true || raw === "true";
  if (op === "in" || op === "not_in") {
    if (Array.isArray(raw)) return raw;
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (/^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s));
  }
  if (typeof raw === "string") {
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  return raw;
}

function clean(input: PolicyInput) {
  return {
    policy_id: input.policy_id.trim(),
    effect: input.effect,
    priority: Number(input.priority) || 100,
    actor: input.actor.trim() || "*",
    action: input.action.trim() || "*",
    resource: input.resource.trim() || "*",
    approvals_required: Math.max(1, Number(input.approvals_required) || 1),
    conditions: (input.conditions || [])
      .filter((c) => c.field && c.op)
      .map((c) => ({ field: c.field.trim(), op: c.op, value: coerceValue(c.op, c.value) })),
    description: input.description.trim(),
    enabled: input.enabled,
  };
}

export async function savePolicy(input: PolicyInput): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  if (!input.policy_id.trim())
    return { ok: false, error: "Give the rule a short id (e.g. approve-large-payments)." };
  if (!["allow", "deny", "require_approval"].includes(input.effect))
    return { ok: false, error: "Effect must be allow, deny, or require_approval." };

  const supabase = await createClient();
  const row = { org_id: ctx.orgId, ...clean(input) };

  const { error } = input.id
    ? await supabase.from("policies").update(row).eq("id", input.id).eq("org_id", ctx.orgId)
    : await supabase.from("policies").insert(row);

  if (error) {
    if (error.code === "23505")
      return { ok: false, error: `A rule with id "${row.policy_id}" already exists.` };
    return { ok: false, error: error.message };
  }
  revalidatePath("/policies");
  return { ok: true };
}

export async function deletePolicy(id: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase.from("policies").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  return { ok: true };
}

// Delete several policies at once. Scoped to the caller's org (RLS also enforces
// this) so a stray id from another org can never be deleted here.
export async function deletePolicies(ids: string[]): Promise<Result & { deleted?: number }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const clean = (ids || []).filter((x): x is string => typeof x === "string" && x.length > 0);
  if (clean.length === 0) return { ok: true, deleted: 0 };
  const supabase = await createClient();
  const { error } = await supabase.from("policies").delete().in("id", clean).eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  return { ok: true, deleted: clean.length };
}

// Enable a whole policy pack (compliance or recommended). Upserts every template
// in the pack for the org, so it's idempotent and re-adding just refreshes them.
export async function addPack(packKey: string): Promise<Result & { added?: number }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const pack = packByKey(packKey);
  if (!pack) return { ok: false, error: "Unknown pack." };
  if (!packAllowed(ctx.plan, packKey))
    return { ok: false, error: "This pack is on the Business plan. Upgrade in Billing to enable it." };

  const supabase = await createClient();
  const rows = pack.templates.map((t) => ({
    org_id: ctx.orgId,
    policy_id: t.policy_id,
    effect: t.effect,
    priority: t.priority,
    actor: t.actor ?? "*",
    action: t.action,
    resource: t.resource ?? "*",
    conditions: t.conditions ?? [],
    approvals_required: t.approvals_required ?? 1,
    description: t.description,
    enabled: true,
  }));

  const { error } = await supabase
    .from("policies")
    .upsert(rows, { onConflict: "org_id,policy_id" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true, added: rows.length };
}

export async function updateDefaults(
  defaultEffect: string,
  defaultReason: string,
): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("org_policy_settings")
    .upsert(
      { org_id: ctx.orgId, default_effect: defaultEffect, default_reason: defaultReason },
      { onConflict: "org_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  return { ok: true };
}

// Enforcement posture: "enforce" (block for real, default) or "monitor"
// (observe-only for a window: logs what would happen but blocks nothing).
// Switching to monitor sets a window (default 14 days); switching to enforce
// clears it. Kept server-side; days is clamped by monitorUntilFrom.
export async function updateEnforcementMode(mode: string, days = 14): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  if (!isEnforcementMode(mode)) return { ok: false, error: "Unknown mode." };
  const supabase = await createClient();
  const patch: { org_id: string; enforcement_mode: string; monitor_until: string | null } =
    mode === "monitor"
      ? { org_id: ctx.orgId, enforcement_mode: "monitor", monitor_until: monitorUntilFrom(Date.now(), days) }
      : { org_id: ctx.orgId, enforcement_mode: "enforce", monitor_until: null };
  const { error } = await supabase.from("org_policy_settings").upsert(patch, { onConflict: "org_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---- Simple "Protection" model -------------------------------------------
// The redesigned Policies page edits the seven content categories directly.
// Each category compiles to one `policies` row (action = category), which is
// exactly what lib/aiGate.ts reads to decide a prompt. policy_id is shared with
// the ai-usage pack so writes are idempotent, never duplicated.

const EFFECTS = new Set<Effect>(["allow", "require_approval", "deny"]);

function describeCategory(category: Category, effect: Effect): string {
  const meta = CATEGORY_META[category];
  const verb = effect === "deny" ? "Block" : effect === "allow" ? "Allow" : "Ask an admin to approve";
  return `${verb} AI requests that contain ${meta.short.toLowerCase()}.`;
}

// Upsert the given category -> effect choices as policy rows for the org.
async function writeCategoryMap(
  orgId: string,
  map: Partial<Record<Category, Effect>>,
): Promise<Result> {
  const rows = (Object.entries(map) as [Category, Effect][])
    .filter(([cat, eff]) => cat in CATEGORY_META && EFFECTS.has(eff))
    .map(([cat, eff]) => ({
      org_id: orgId,
      policy_id: CATEGORY_META[cat].policyId,
      effect: eff,
      priority: 10,
      actor: "*",
      action: cat,
      resource: "*",
      conditions: [],
      approvals_required: 1,
      description: describeCategory(cat, eff),
      enabled: true,
    }));
  if (rows.length === 0) return { ok: true };

  const supabase = await createClient();
  const { error } = await supabase.from("policies").upsert(rows, { onConflict: "org_id,policy_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Set a single content category's outcome (Allow / Ask an admin / Block).
export async function setCategoryEffect(category: string, effect: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  if (!(category in CATEGORY_META)) return { ok: false, error: "Unknown category." };
  if (!EFFECTS.has(effect as Effect)) return { ok: false, error: "Choose Allow, Ask an admin, or Block." };
  return writeCategoryMap(ctx.orgId, { [category as Category]: effect as Effect });
}

// Apply a one-click protection level: sets all seven categories AND the
// enforcement mode (Watch only = monitor; Balanced/Strict = enforce).
export async function applyProtectionLevel(levelKey: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const level = PROTECTION_LEVELS.find((l) => l.key === levelKey);
  if (!level) return { ok: false, error: "Unknown protection level." };

  const wrote = await writeCategoryMap(ctx.orgId, level.map);
  if (!wrote.ok) return wrote;

  const supabase = await createClient();
  const patch: { org_id: string; enforcement_mode: string; monitor_until: string | null } =
    level.enforcement === "monitor"
      ? { org_id: ctx.orgId, enforcement_mode: "monitor", monitor_until: monitorUntilFrom(Date.now(), 14) }
      : { org_id: ctx.orgId, enforcement_mode: "enforce", monitor_until: null };
  const { error } = await supabase.from("org_policy_settings").upsert(patch, { onConflict: "org_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Apply a compliance preset (SOC 2 / HIPAA / PCI / GDPR / ISO 27001): sets the
// seven categories to that framework's posture and switches to enforcing.
export async function applyCompliancePreset(presetKey: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const preset = COMPLIANCE_PRESETS.find((p) => p.key === presetKey);
  if (!preset) return { ok: false, error: "Unknown compliance preset." };

  const wrote = await writeCategoryMap(ctx.orgId, preset.map);
  if (!wrote.ok) return wrote;

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_policy_settings")
    .upsert({ org_id: ctx.orgId, enforcement_mode: "enforce", monitor_until: null }, { onConflict: "org_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---- Custom terms ----------------------------------------------------------
// Company-specific words to Block or Ask-an-admin on (codenames, internal
// domains, client names). Stored as ordinary policy rows: action "custom_term",
// the term in `resource`. No separate table, so no migration. Org-scoped by RLS.

function termSlug(term: string): string {
  const base = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "term";
  // Short deterministic suffix so two different terms never collide on the same slug.
  let h = 5381;
  for (let i = 0; i < term.length; i++) h = ((h << 5) + h + term.charCodeAt(i)) >>> 0;
  return `term-${base}-${h.toString(36)}`;
}

export async function addCustomTerm(term: string, effect: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const clean = (term ?? "").trim();
  if (clean.length < 2) return { ok: false, error: "Enter a term of at least 2 characters." };
  if (clean.length > 80) return { ok: false, error: "Keep the term under 80 characters." };
  if (effect !== "deny" && effect !== "require_approval")
    return { ok: false, error: "A custom term can Block or Ask an admin." };

  const supabase = await createClient();
  const { error } = await supabase.from("policies").upsert(
    {
      org_id: ctx.orgId,
      policy_id: termSlug(clean),
      effect,
      priority: 5,
      actor: "*",
      action: "custom_term",
      resource: clean,
      conditions: [],
      approvals_required: 1,
      description: `${effect === "deny" ? "Block" : "Ask an admin about"} messages that contain "${clean}".`,
      enabled: true,
    },
    { onConflict: "org_id,policy_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

// Add an org-specific trigger word to one of the built-in categories. It "counts
// as" that category, so it inherits the category's Allow / Ask / Block outcome
// (resolved live at check time; the stored effect is just a fallback). Stored as a
// custom_term row tagged with actor "cat:<category>".
export async function addCategoryTrigger(category: string, term: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  if (!(category in CATEGORY_META)) return { ok: false, error: "Unknown category." };
  const clean = (term ?? "").trim();
  if (clean.length < 2) return { ok: false, error: "Enter a word of at least 2 characters." };
  if (clean.length > 80) return { ok: false, error: "Keep it under 80 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("policies").upsert(
    {
      org_id: ctx.orgId,
      policy_id: `catterm-${category}-${termSlug(clean).replace(/^term-/, "")}`,
      effect: "require_approval",
      priority: 5,
      actor: `cat:${category}`,
      action: "custom_term",
      resource: clean,
      conditions: [],
      approvals_required: 1,
      description: `Counts as ${CATEGORY_META[category as keyof typeof CATEGORY_META].label}.`,
      enabled: true,
    },
    { onConflict: "org_id,policy_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  revalidatePath("/dashboard");
  return { ok: true };
}

// How this org handles a gray-zone request when the AI verification step can't run.
export async function updateFallbackMode(mode: string): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  if (!["availability", "hold", "flag"].includes(mode))
    return { ok: false, error: "Unknown mode." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("org_policy_settings")
    .upsert({ org_id: ctx.orgId, ai_fallback_mode: mode }, { onConflict: "org_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/policies");
  return { ok: true };
}
