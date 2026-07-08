// Data-access for "employees" — billing seats, each with its own personal API
// key (`sk_live_...`). Mirrors the org-level api_keys pattern in apiKeys.ts /
// keys/actions.ts, but scoped per-seat for monetization. The raw key is
// returned exactly once at creation; only its hash is ever stored.
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/apiKeys";

function newKey(): { raw: string; prefix: string } {
  const raw = generateApiKey();
  return { raw, prefix: keyPrefix(raw) };
}

export async function createEmployee(
  orgId: string,
  label: string,
): Promise<{ id: string; key: string; prefix: string }> {
  const admin = createAdminClient();
  const { raw, prefix } = newKey();
  const { data, error } = await admin
    .from("employees")
    .insert({
      org_id: orgId,
      label,
      key_hash: hashApiKey(raw),
      key_prefix: prefix,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not create employee");
  return { id: data.id as string, key: raw, prefix };
}

export async function listEmployees(orgId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("employees")
    .select("id, label, key_prefix, status, created_at, last_used_at")
    .eq("org_id", orgId)
    .order("created_at");
  return data ?? [];
}

export async function activeSeatCount(orgId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");
  return count ?? 0;
}

export async function resolveEmployeeByKey(
  rawKey: string,
): Promise<{ orgId: string; employeeId: string } | null> {
  if (!rawKey) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("employees")
    .select("id, org_id, status")
    .eq("key_hash", hashApiKey(rawKey))
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return { orgId: data.org_id as string, employeeId: data.id as string };
}
