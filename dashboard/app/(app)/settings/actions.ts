"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfileContext } from "@/lib/getProfile";

export async function updateOrgName(
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  if (!name.trim()) return { ok: false, error: "Name can't be empty." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ name: name.trim() })
    .eq("id", ctx.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateCheckpointUrl(
  url: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getProfileContext();
  if (!ctx) return { ok: false, error: "Not signed in." };
  url = url.trim();
  if (url && !/^https?:\/\/.+/i.test(url)) {
    return { ok: false, error: "Enter a full URL, e.g. https://your-checkpoint.onrender.com/mcp" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ checkpoint_url: url || null })
    .eq("id", ctx.orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
