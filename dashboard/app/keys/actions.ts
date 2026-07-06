"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileContext } from "@/lib/getProfile";
import { generateApiKey, hashApiKey, keyPrefix } from "@/lib/apiKeys";

export async function createApiKey(
  label: string,
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };

  const raw = generateApiKey();
  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    org_id: ctx.orgId,
    label: label.trim() || "default",
    key_hash: hashApiKey(raw),
    key_prefix: keyPrefix(raw),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/keys");
  // The raw key is returned exactly once — we only ever store its hash.
  return { ok: true, key: raw };
}

export async function revokeApiKey(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").delete().eq("id", id).eq("org_id", ctx.orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/keys");
  return { ok: true };
}
