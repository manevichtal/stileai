import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrgId, unauthorized } from "@/lib/apiAuth";
import { apiError } from "@/lib/apiError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/checkpoint  <- { url }
// A checkpoint self-registers its public URL here (authenticated by its API key,
// which maps to exactly one org). The dashboard then shows that tenant its own
// ready-to-paste connect URL. Admins can also set it from Settings.
export async function POST(req: Request) {
  const orgId = await resolveOrgId(req);
  if (!orgId) return unauthorized();

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  if (!/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: "url must be a valid http(s) URL" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ checkpoint_url: url })
    .eq("id", orgId);
  if (error) {
    return apiError(error);
  }
  return NextResponse.json({ ok: true });
}
