"use server";

import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createEmployee,
  inviteEmployee,
  reissueInvite,
  activeSeatCount,
  listEmployees,
} from "@/lib/employees";
import { seatedIds } from "@/lib/seats";

// Both actions use the service-role admin client (bypasses RLS), so each one
// enforces its own auth: caller must be an org admin, and every employee
// query/update is scoped by org_id so a crafted id can never touch another
// org's row.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stileai.com";

function connectUrl(token: string): string {
  return `${APP_URL.replace(/\/+$/, "")}/extension/connect?token=${token}`;
}

// Shared seat-cap guard: an org can provision at most `plan_seats` active seats.
// Returns an error string if there's no seat available, else null.
async function seatGuard(orgId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("plan_seats")
    .eq("id", orgId)
    .maybeSingle();
  const seats = org?.plan_seats ?? 0;
  if ((await activeSeatCount(orgId)) >= seats) {
    return "You're using all your seats. Add seats from Billing to invite more people.";
  }
  return null;
}

// Post-insert race guard: if a concurrent add pushed us past the cap, the new seat
// wouldn't be among the oldest-N seated by the proxy, so roll it back.
async function rollbackIfOverCap(orgId: string, newId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("plan_seats").eq("id", orgId).maybeSingle();
  const seats = org?.plan_seats ?? 0;
  const actives = (await listEmployees(orgId)).filter((e) => e.status === "active") as { id: string; created_at: string }[];
  if (!seatedIds(actives, seats).has(newId)) {
    await admin.from("employees").update({ status: "disabled" }).eq("id", newId).eq("org_id", orgId);
    return true;
  }
  return false;
}

// Invite a user by email → returns a one-time connect link to send them. Consumes
// a seat (billing is per user). The user's extension redeems the link to connect.
export async function inviteUserAction(
  label: string,
  email: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can invite users." };
  const cleanEmail = (email ?? "").trim();
  const cleanLabel = (label ?? "").trim() || cleanEmail;
  if (!cleanLabel) return { ok: false, error: "Enter the person's name or email." };

  // Platform-owner's own tenant: unlimited free seats, skip the plan cap entirely.
  if (!ctx.isPlatformAdmin) {
    const capErr = await seatGuard(ctx.orgId);
    if (capErr) return { ok: false, error: capErr };
  }

  const { id, inviteToken } = await inviteEmployee(ctx.orgId, cleanLabel, cleanEmail || null);
  if (!ctx.isPlatformAdmin && (await rollbackIfOverCap(ctx.orgId, id))) {
    return { ok: false, error: "You're using all your seats. Add seats from Billing to invite more people." };
  }
  return { ok: true, url: connectUrl(inviteToken) };
}

// Re-issue a connect link for an existing seat (lost link / new device).
export async function reissueInviteAction(
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can re-issue links." };
  const token = await reissueInvite(ctx.orgId, id);
  if (!token) return { ok: false, error: "Seat not found." };
  return { ok: true, url: connectUrl(token) };
}

// Advanced: generate a raw key directly (for API/gateway tools like Cursor or
// Claude Code, where there's no browser extension to redeem a link).
export async function addEmployeeAction(
  label: string,
): Promise<{ ok: true; key: string; prefix: string } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can add seats." };
  const clean = (label ?? "").trim();
  if (!clean) return { ok: false, error: "Enter a name or email for the user." };

  if (!ctx.isPlatformAdmin) {
    const capErr = await seatGuard(ctx.orgId);
    if (capErr) return { ok: false, error: capErr };
  }

  const emp = await createEmployee(ctx.orgId, clean);
  if (!ctx.isPlatformAdmin && (await rollbackIfOverCap(ctx.orgId, emp.id))) {
    return { ok: false, error: "You're using all your seats. Add seats from Billing to add more people." };
  }
  return { ok: true, key: emp.key, prefix: emp.prefix };
}

// IMPORTANT: scope the disable to the caller's org to prevent cross-tenant tampering.
export async function disableEmployeeAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can remove seats." };
  const admin = createAdminClient();
  const { data: emp } = await admin
    .from("employees")
    .select("id")
    .eq("id", id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!emp) return { ok: false, error: "Not found." }; // do NOT disable an employee that isn't in your org
  await admin.from("employees").update({ status: "disabled" }).eq("id", id).eq("org_id", ctx.orgId);
  return { ok: true };
}
