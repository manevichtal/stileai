"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileContext } from "@/lib/getProfile";
import { packByKey } from "@/lib/policyTemplates";

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

// Enable a whole policy pack (compliance or recommended). Upserts every template
// in the pack for the org, so it's idempotent and re-adding just refreshes them.
export async function addPack(packKey: string): Promise<Result & { added?: number }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const pack = packByKey(packKey);
  if (!pack) return { ok: false, error: "Unknown pack." };

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
  revalidatePath("/");
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
