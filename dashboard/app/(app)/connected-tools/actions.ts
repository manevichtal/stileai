"use server";

import { revalidatePath } from "next/cache";
import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto";
import { catalogTool } from "@/lib/toolCatalog";

const DEMO_TOOL = {
  name: "sample",
  transport: "stdio",
  target: JSON.stringify(["python", "-m", "sample_tools.server"]),
};

// Web tool: the common, non-technical path — just a name + URL.
export async function addWebTool(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const token = String(formData.get("token") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: "Tool web address must start with http:// or https://." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("connected_tools").insert({
    org_id: ctx.orgId,
    name,
    transport: "http",
    target: url,
    auth: token ? encryptSecret(token) : null,
    enabled: true,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/connected-tools");
  return { ok: true };
}

// Advanced path: a local command line, e.g. "python -m sample_tools.server".
// We convert it to the JSON-array target the gateway expects server-side, so
// the user never has to type JSON or quotes themselves.
export async function addLocalTool(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const name = String(formData.get("name") ?? "").trim();
  const command = String(formData.get("command") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!command) return { ok: false, error: "Command is required." };

  // Simple whitespace split — quoted/complex args aren't supported yet.
  const parts = command.split(/\s+/).filter(Boolean);
  const target = JSON.stringify(parts);

  const supabase = createAdminClient();
  const { error } = await supabase.from("connected_tools").insert({
    org_id: ctx.orgId,
    name,
    transport: "stdio",
    target,
    enabled: true,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/connected-tools");
  return { ok: true };
}

// One-click demo tool — adds the bundled sample without the user typing anything.
export async function addDemoTool(): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("connected_tools").insert({
    org_id: ctx.orgId,
    name: DEMO_TOOL.name,
    transport: DEMO_TOOL.transport,
    target: DEMO_TOOL.target,
    enabled: true,
  });
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      return { ok: false, error: "The demo tool is already added." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/connected-tools");
  return { ok: true };
}

// Catalog path: the admin picks a known tool tile and only supplies the
// credential(s) they already use for it. We fill in the technical connection
// (transport/target) from the catalog and store any secret encrypted.
export async function addFromCatalog(
  toolId: string,
  name: string,
  creds: Record<string, string>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireProfileContext();
  if (ctx.role !== "admin") return { ok: false, error: "Admins only." };

  const tool = catalogTool(toolId);
  if (!tool) return { ok: false, error: "unknown tool" };

  const transport = tool.transport;
  const target = typeof tool.target === "string" ? tool.target : JSON.stringify(tool.target);

  let bundle: Record<string, unknown> | null = null;
  if (tool.transport === "http") {
    const bearer = String(creds.bearer ?? "").trim();
    if (bearer) bundle = { bearer };
  } else if (tool.transport === "stdio" && tool.credentials.length > 0) {
    const env: Record<string, string> = {};
    for (const cred of tool.credentials) {
      const value = String(creds[cred.key] ?? "").trim();
      if (!value) {
        if (cred.optional) continue;
        return { ok: false, error: `${cred.label} is required` };
      }
      env[cred.key] = value;
    }
    bundle = { env };
  }

  const auth = bundle ? encryptSecret(JSON.stringify(bundle)) : null;
  const finalName = name.trim() || tool.name;

  const supabase = createAdminClient();
  const { error } = await supabase.from("connected_tools").insert({
    org_id: ctx.orgId,
    name: finalName,
    transport,
    target,
    auth,
    enabled: true,
  });
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      return { ok: false, error: `${finalName} is already added.` };
    }
    return { ok: false, error: error.message };
  }

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
