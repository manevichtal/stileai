import { createAdminClient } from "@/lib/supabase/admin";
import { checkPrompt, BALANCED_RULES, decisionFromEffect, type Category } from "@/lib/promptCheck";
import { resolveCaller, auditCallerBlock } from "@/lib/aiGate";
import { callerDecision } from "@/lib/seats";
import { rateLimit, keyBucket } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB: prompts + tool context can be large

// StileAI's real interception point. A company points its AI tool (anything that
// speaks the OpenAI API — a custom app, Cursor, an SDK, etc.) at:
//   base URL:  https://<this-host>/api/proxy/<YOUR_STILEAI_KEY>/v1
//   api key:   the tool's own AI-provider key (e.g. your OpenAI key)
// Every request passes through here FIRST: StileAI checks the prompt against the
// org's policy, then forwards it to the AI provider (approved), or returns a
// policy message instead of ever calling the AI (denied / needs admin approval).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER_URL = "https://api.openai.com/v1/chat/completions";

function extractPrompt(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  return messages
    .map((m) => {
      const c = (m as { content?: unknown })?.content;
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((p) => (p as { text?: string })?.text ?? "").join(" ");
      return "";
    })
    .join("\n");
}

function completion(model: string, content: string) {
  return {
    id: "stileai-" + crypto.randomUUID(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || "stileai-policy",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

// A one-message SSE stream so tools that requested streaming still show the message.
function sseBlock(model: string, content: string): ReadableStream {
  const id = "stileai-" + crypto.randomUUID();
  const enc = new TextEncoder();
  const chunk = (delta: object, finish: string | null = null) =>
    `data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(chunk({ role: "assistant", content })));
      c.enqueue(enc.encode(chunk({}, "stop")));
      c.enqueue(enc.encode("data: [DONE]\n\n"));
      c.close();
    },
  });
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const caller = await resolveCaller(key);
  if (!caller) return json({ error: { message: "Invalid StileAI key.", type: "stileai_auth" } }, 401);

  const rl = await rateLimit(keyBucket("proxy", key), 240, 60);
  if (!rl.allowed) {
    return json({ error: { message: "Rate limit exceeded for this StileAI key.", type: "stileai_rate_limit" } }, 429);
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return json({ error: { message: "Request body too large." } }, 413);
  }

  let body: { messages?: unknown; model?: string; stream?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: { message: "Invalid JSON body." } }, 400);
  }

  const model = body?.model ?? "gpt-4o-mini";

  // Caller gate: over-seat employees and orgs without an active subscription are
  // blocked here, before any policy check runs or the request is forwarded.
  const gatePass = callerDecision(caller);
  if (!gatePass.allowed) {
    await auditCallerBlock(caller.orgId, caller.employeeId, model, gatePass.reason);
    if (body?.stream) {
      return new Response(sseBlock(model, gatePass.reason), {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }
    return json(completion(model, gatePass.reason));
  }

  const orgId = caller.orgId;
  const promptText = extractPrompt(body?.messages);

  // The Policies page is the decision-maker: load the org's enabled policies and
  // map each restricted-content category to its configured effect. Categories with
  // no policy fall back to the recommended defaults, so it's safe out of the box.
  const admin = createAdminClient();
  const AI_CATEGORIES = new Set<Category>(["secrets", "pii", "client_data", "financial", "legal", "phi", "source_code"]);
  const { data: pols } = await admin.from("policies").select("action, effect").eq("org_id", orgId).eq("enabled", true);
  const rules = { ...BALANCED_RULES };
  for (const p of pols ?? []) {
    if (AI_CATEGORIES.has(p.action as Category)) rules[p.action as Category] = decisionFromEffect(p.effect as string);
  }
  const result = checkPrompt(promptText, rules);

  // Record the decision. We never store restricted prompt content — only the
  // detected categories + reason (and a short preview for SAFE requests).
  const decisionId = "ai-" + crypto.randomUUID();
  const effect = result.decision === "approved" ? "allow" : result.decision === "denied" ? "deny" : "require_approval";
  const status = result.decision === "approved" ? "allowed" : result.decision === "denied" ? "denied" : "pending";
  const categories = result.hits.map((h) => h.category);
  const safePreview = result.decision === "approved" ? promptText.slice(0, 80) : "(restricted content hidden)";
  await admin.from("audit_log").insert({
    org_id: orgId, decision_id: decisionId, ts: new Date().toISOString(),
    actor: "employee", action: "ai.request", resource: model,
    params: { categories, preview: safePreview },
    effect, matched_policy: result.hits[0]?.label ?? null, reason: result.reason, status,
    employee_id: caller.employeeId,
  });

  // Approved → forward to the AI provider with the caller's own key (flows through).
  if (result.decision === "approved") {
    try {
      const upstream = await fetch(PROVIDER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") ?? "" },
        body: JSON.stringify(body),
      });
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
      });
    } catch {
      return json({ error: { message: "StileAI could not reach the AI provider." } }, 502);
    }
  }

  // Denied / needs approval → return the policy message AS the AI's reply; the AI
  // provider is never called. For 'needs approval', log it to the Approvals queue.
  if (result.decision === "admin_approval") {
    await admin.from("approvals").insert({
      org_id: orgId, decision_id: decisionId, actor: "employee", action: "ai.request",
      resource: model, params: { categories, preview: "(restricted content hidden)" },
      reason: result.reason, matched_policy: result.hits[0]?.label ?? null,
      approvals_required: 1, status: "pending", approvals: [],
    });
  }

  const mark = result.decision === "denied" ? "⛔" : "🟠";
  const head =
    result.decision === "denied"
      ? "Blocked by your company's AI policy."
      : "This request needs approval from your admin before it can be sent to the AI.";
  const content = `${mark} ${head}\n\n${result.reason}`;

  if (body?.stream) {
    return new Response(sseBlock(model, content), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }
  return json(completion(model, content));
}
