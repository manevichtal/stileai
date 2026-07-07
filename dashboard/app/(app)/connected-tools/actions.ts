"use server";

import { revalidatePath } from "next/cache";
import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";

const TRANSPORTS = new Set(["stdio", "http"]);

export async function addTool(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const name = String(formData.get("name") ?? "").trim();
  const transport = String(formData.get("transport") ?? "").trim();
  const target = String(formData.get("target") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!TRANSPORTS.has(transport)) return { ok: false, error: "Transport must be stdio or http." };
  if (!target) return { ok: false, error: "Target is required." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("connected_tools").insert({
    org_id: ctx.orgId,
    name,
    transport,
    target,
    enabled: true,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/connected-tools");
  return { ok: true };
}

export async function setToolEnabled(
  id: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("connected_tools")
    .update({ enabled })
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/connected-tools");
  return { ok: true };
}

export async function deleteTool(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("connected_tools")
    .delete()
    .eq("id", id)
    .eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/connected-tools");
  return { ok: true };
}
