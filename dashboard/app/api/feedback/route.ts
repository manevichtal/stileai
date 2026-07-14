import { NextResponse } from "next/server";
import { getProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFeedback, isFeedbackKind } from "@/lib/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024; // a decision id + a short note; nothing large.

// POST /api/feedback  <- { decision_id, kind, note? }
//
// A logged-in admin flags one of THEIR org's decisions as wrong. Session-based
// (not API-key): the org is taken from the caller's profile, never from the body,
// so a report can only ever attach to the reporter's own org. Purely additive —
// this endpoint never affects a live allow/deny decision.
export async function POST(req: Request) {
  const ctx = await getProfileContext();
  if (!ctx || !ctx.orgId) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const decisionId = typeof body.decision_id === "string" ? body.decision_id : "";
  if (!decisionId || !isFeedbackKind(body.kind)) {
    return NextResponse.json({ error: "decision_id and a valid kind are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await recordFeedback(admin, ctx.orgId, {
    decisionId,
    kind: body.kind,
    note: typeof body.note === "string" ? body.note : "",
    reportedBy: ctx.email,
  });

  if (result.ok) return NextResponse.json({ ok: true });

  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "decision not found" }, { status: 404 });
    case "not_enabled":
      // Migration not applied in this environment yet — degrade cleanly, don't 500.
      return NextResponse.json({ error: "feedback is not enabled yet" }, { status: 503 });
    case "invalid":
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    default:
      return NextResponse.json({ error: "could not record feedback" }, { status: 500 });
  }
}
