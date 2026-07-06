"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileContext } from "@/lib/getProfile";
import { resolveApproval } from "@/lib/resolveApproval";

type Result = { ok: true; status: string } | { ok: false; error: string };

// Approve or reject a pending decision from the dashboard. Uses the admin's
// RLS-scoped session (so it can only touch their own org) and the shared
// resolveApproval logic the MCP route also uses.
export async function resolveFromDashboard(
  decisionId: string,
  approved: boolean,
  note: string,
): Promise<Result> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const updated = await resolveApproval(
    supabase,
    ctx.orgId,
    decisionId,
    ctx.email ? `user:${ctx.email}` : "user:admin",
    approved,
    note,
  );
  if (!updated) return { ok: false, error: "Could not resolve — it may already be decided." };

  revalidatePath("/approvals");
  return { ok: true, status: updated.status };
}
