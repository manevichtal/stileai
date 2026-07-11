// Data-access for "employees" — billing seats, each tied to one user. A seat is
// provisioned either by generating a raw API key (for API/gateway tools) or by
// inviting a user, whose browser extension redeems a one-time connect link (the
// seat's key is minted at redeem). Either way the raw key is shown exactly once;
// only its hash is stored. Billing is per user: inviting consumes a seat.
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/apiKeys";

function newKey(): { raw: string; prefix: string } {
  const raw = generateApiKey();
  return { raw, prefix: keyPrefix(raw) };
}

// One-time token that goes in a connect link. Redeeming it mints the seat's key.
function newInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString("hex");
  return { raw, hash: hashApiKey(raw) };
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

// Invite a user by email: reserve a seat now (consumes billing), and return a
// one-time connect token. The seat has NO working key until the user's extension
// redeems the token — so an invited-but-not-connected seat can't call the API yet,
// but it still counts against the plan (you pay per invited user).
export async function inviteEmployee(
  orgId: string,
  label: string,
  email: string | null,
): Promise<{ id: string; inviteToken: string }> {
  const admin = createAdminClient();
  const { raw, hash } = newInviteToken();
  const { data, error } = await admin
    .from("employees")
    .insert({
      org_id: orgId,
      label,
      email: email || null,
      invite_token_hash: hash,
      invited_at: new Date().toISOString(),
      status: "active",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not invite user");
  return { id: data.id as string, inviteToken: raw };
}

// Re-issue a connect link for an existing seat (lost link / new device). Redeeming
// it rotates the seat's key, so any previously-connected browser stops working.
export async function reissueInvite(orgId: string, employeeId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { raw, hash } = newInviteToken();
  const { data } = await admin
    .from("employees")
    .update({ invite_token_hash: hash })
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  return data ? raw : null;
}

// Redeem a connect token: mint the seat's key, mark it connected, and consume the
// token (one-time). Returns the raw key exactly once for the extension to store.
export async function redeemInvite(
  rawToken: string,
): Promise<{ key: string; label: string | null } | null> {
  if (!rawToken) return null;
  const admin = createAdminClient();
  const { data: emp } = await admin
    .from("employees")
    .select("id, org_id, label")
    .eq("invite_token_hash", hashApiKey(rawToken))
    .eq("status", "active")
    .maybeSingle();
  if (!emp) return null;
  const { raw, prefix } = newKey();
  const { error } = await admin
    .from("employees")
    .update({
      key_hash: hashApiKey(raw),
      key_prefix: prefix,
      connected_at: new Date().toISOString(),
      invite_token_hash: null, // consume the one-time token
    })
    .eq("id", emp.id)
    .eq("org_id", emp.org_id);
  if (error) return null;
  return { key: raw, label: (emp.label as string) ?? null };
}

export async function listEmployees(orgId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("employees")
    .select("id, label, email, key_prefix, status, created_at, last_used_at, connected_at, invite_token_hash")
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
  // Track activity per user (best-effort) so admins can see who's actually using it.
  void admin.from("employees").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { orgId: data.org_id as string, employeeId: data.id as string };
}
