"use server";

import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEmployee, activeSeatCount, listEmployees } from "@/lib/employees";
import { seatedIds } from "@/lib/seats";

// Both actions use the service-role admin client (bypasses RLS), so each one
// enforces its own auth: caller must be an org admin, and every employee
// query/update is scoped by org_id so a crafted id can never touch another
// org's row.

export async function addEmployeeAction(
  label: string,
): Promise<{ ok: true; key: string; prefix: string } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Only an admin can add seats." };
  const clean = (label ?? "").trim();
  if (!clean) return { ok: false, error: "Enter a name or email for the employee." };
  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("plan_seats")
    .eq("id", ctx.orgId)
    .maybeSingle();
  const seats = org?.plan_seats ?? 0;
  if ((await activeSeatCount(ctx.orgId)) >= seats) {
    return { ok: false, error: "You're using all your seats. Add seats from Billing to add more employees." };
  }
  const emp = await createEmployee(ctx.orgId, clean);
  // Close the check-then-act race: if a concurrent add pushed us past the cap,
  // this new employee wouldn't be seated by the proxy (oldest-N wins), so roll it
  // back instead of leaving a dead, unusable seat.
  const actives = (await listEmployees(ctx.orgId)).filter((e) => e.status === "active") as { id: string; created_at: string }[];
  if (!seatedIds(actives, seats).has(emp.id)) {
    await admin.from("employees").update({ status: "disabled" }).eq("id", emp.id).eq("org_id", ctx.orgId);
    return { ok: false, error: "You're using all your seats. Add seats from Billing to add more employees." };
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
