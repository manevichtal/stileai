import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";

// Extracts the API key from a request. Supports the default
// `Authorization: Bearer <key>` and a bare `X-API-Key: <key>` fallback.
function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    return auth.trim(); // tolerate a raw key with no scheme
  }
  const x = req.headers.get("x-api-key");
  return x ? x.trim() : null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "invalid or missing API key" }, { status: 401 });

// Resolves the org_id for the API key on this request, or null if the key is
// missing/unknown. Also stamps last_used_at (best-effort). This is the security
// boundary for every MCP-facing route: the key maps to exactly one org, and all
// subsequent queries MUST filter by that org_id (service role bypasses RLS).
export async function resolveOrgId(req: Request): Promise<string | null> {
  const key = extractKey(req);
  if (!key) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, org_id")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();

  if (error || !data) return null;

  // fire-and-forget usage stamp
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.org_id as string;
}
