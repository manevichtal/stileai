import { resolveCaller, gate, auditCallerBlock } from "@/lib/aiGate";
import { callerDecision } from "@/lib/seats";

// POST /api/inspect  <- { prompt, model?, site? }   (Authorization: Bearer <STILEAI_KEY>)
//
// The decision endpoint for the StileAI browser extension. It runs the SAME engine
// the API proxy uses (resolveCaller -> callerDecision -> gate): resolve the key to a
// caller/org, enforce subscription + seat limits, then check the prompt against the
// org's policies. Returns a small JSON verdict the extension acts on BEFORE the
// prompt is allowed to leave the browser for ChatGPT / Claude / Gemini.
//
// Every call is logged to the org's audit trail by gate()/auditCallerBlock(). No
// restricted prompt content is stored (the engine redacts before writing).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Key",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// The extension may send the key as a Bearer token or an X-API-Key header.
function extractKey(req: Request): string {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    return auth.trim();
  }
  return (req.headers.get("x-api-key") ?? "").trim();
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const key = extractKey(req);

  // Fail closed: an unresolvable key never yields an "allow".
  const caller = await resolveCaller(key);
  if (!caller) {
    return json({ effect: "deny", reason: "This browser isn't linked to an active StileAI workspace. Ask your admin for your StileAI key.", categories: [] }, 401);
  }

  let body: { prompt?: unknown; model?: unknown; site?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ effect: "deny", reason: "StileAI could not read the request.", categories: [] }, 400);
  }

  const promptText = typeof body?.prompt === "string" ? body.prompt : "";
  const site = typeof body?.site === "string" ? body.site : "web";
  // `model` doubles as the audited resource; default to the AI site name.
  const model = typeof body?.model === "string" && body.model ? body.model : site;

  // Seat / subscription gate — mirrors the proxy. Blocked callers are audited here
  // (gate() never runs for them) so over-seat / lapsed attempts still leave a trail.
  const gatePass = callerDecision(caller);
  if (!gatePass.allowed) {
    await auditCallerBlock(caller.orgId, caller.employeeId, model, gatePass.reason);
    return json({ effect: "deny", reason: gatePass.reason, categories: [] });
  }

  // Policy check (logs the decision + queues an approval when required).
  const result = await gate(caller.orgId, promptText, model, caller.employeeId);
  const effect =
    result.decision === "approved" ? "allow" : result.decision === "denied" ? "deny" : "require_approval";

  return json({
    effect,
    reason: result.reason,
    categories: result.hits.map((h) => h.category),
    profile: result.profile,
  });
}
