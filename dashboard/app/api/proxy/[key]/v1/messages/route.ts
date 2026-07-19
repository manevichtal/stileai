import { resolveCaller, gate, blockMessage, auditCallerBlock } from "@/lib/aiGate";
import { callerDecision } from "@/lib/seats";
import { rateLimit, keyBucket } from "@/lib/rateLimit";
import { extractAnthropicPrompt } from "@/lib/proxyExtract";

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

// Anthropic-compatible interception (for Claude Code, the Claude SDK, and any tool
// that speaks the Anthropic Messages API). Point ANTHROPIC_BASE_URL at:
//   https://<this-host>/api/proxy/<YOUR_STILEAI_KEY>
// and keep your ANTHROPIC_API_KEY set. Every request is checked against your
// policies first; approved ones are forwarded to Anthropic, the rest are answered
// with a policy message and never reach the model.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

function anthropicMessage(model: string, text: string) {
  return {
    id: "msg_stileai_" + crypto.randomUUID(),
    type: "message",
    role: "assistant",
    model: model || "stileai-policy",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  };
}

// A valid Anthropic streaming response carrying just the policy message.
function anthropicSSE(model: string, text: string): ReadableStream {
  const enc = new TextEncoder();
  const id = "msg_stileai_" + crypto.randomUUID();
  const ev = (event: string, data: object) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(ev("message_start", { type: "message_start", message: { id, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } })));
      c.enqueue(enc.encode(ev("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })));
      c.enqueue(enc.encode(ev("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })));
      c.enqueue(enc.encode(ev("content_block_stop", { type: "content_block_stop", index: 0 })));
      c.enqueue(enc.encode(ev("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 0 } })));
      c.enqueue(enc.encode(ev("message_stop", { type: "message_stop" })));
      c.close();
    },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const caller = await resolveCaller(key);
  if (!caller) {
    return new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "Invalid StileAI key." } }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const rl = await rateLimit(keyBucket("proxy", key), 240, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "Rate limit exceeded for this StileAI key." } }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) } });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Request body too large." } }), { status: 413, headers: { "Content-Type": "application/json" } });
  }

  let body: { model?: string; system?: unknown; messages?: unknown; stream?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "Invalid JSON body." } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const model = body?.model ?? "claude";

  // Caller gate: over-seat employees and orgs without an active subscription are
  // blocked here, before any policy check runs or the request is forwarded.
  const gatePass = callerDecision(caller);
  if (!gatePass.allowed) {
    await auditCallerBlock(caller.orgId, caller.employeeId, model, gatePass.reason);
    if (body?.stream) {
      return new Response(anthropicSSE(model, gatePass.reason), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }
    return new Response(JSON.stringify(anthropicMessage(model, gatePass.reason)), { headers: { "Content-Type": "application/json" } });
  }

  const promptText = extractAnthropicPrompt(body);
  let result;
  try {
    result = await gate(caller.orgId, promptText, model, caller.employeeId);
  } catch {
    // Fail closed: if the policy check itself errors, NEVER forward to Anthropic.
    const content = "🟠 StileAI could not verify this request, so it was held to protect company data. Please try again in a moment.";
    if (body?.stream) {
      return new Response(anthropicSSE(model, content), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }
    return new Response(JSON.stringify(anthropicMessage(model, content)), { headers: { "Content-Type": "application/json" } });
  }

  if (result.decision === "approved") {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    for (const h of ["x-api-key", "authorization", "anthropic-version", "anthropic-beta"]) {
      const v = req.headers.get(h);
      if (v) headers[h] = v;
    }
    if (!headers["anthropic-version"]) headers["anthropic-version"] = "2023-06-01";
    try {
      const upstream = await fetch(ANTHROPIC_URL, { method: "POST", headers, body: JSON.stringify(body) });
      return new Response(upstream.body, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" } });
    } catch {
      return new Response(JSON.stringify({ type: "error", error: { message: "StileAI could not reach Anthropic." } }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
  }

  const msg = blockMessage(result);
  if (body?.stream) {
    return new Response(anthropicSSE(model, msg), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }
  return new Response(JSON.stringify(anthropicMessage(model, msg)), { headers: { "Content-Type": "application/json" } });
}
