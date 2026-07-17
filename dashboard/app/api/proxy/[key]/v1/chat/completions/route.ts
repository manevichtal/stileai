import { resolveCaller, auditCallerBlock, gate, blockMessage } from "@/lib/aiGate";
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

  const promptText = extractPrompt(body?.messages);

  // Single decision path, shared with the extension route (/api/inspect): loads the
  // org's policies, runs the free layer + AI gray-zone step, logs the decision,
  // queues an approval when needed, and honors the org's enforcement mode (in
  // monitor mode it logs "would have" and passes through). One source of truth.
  let result;
  try {
    result = await gate(caller.orgId, promptText, model, caller.employeeId);
  } catch {
    // Fail closed: if the policy check itself errors, NEVER forward to the AI.
    const content = "🟠 StileAI could not verify this request, so it was held to protect company data. Please try again in a moment.";
    if (body?.stream) {
      return new Response(sseBlock(model, content), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
    }
    return json(completion(model, content));
  }

  // Approved (or monitor mode) → forward to the AI provider with the caller's own
  // key (flows through untouched).
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
  // provider is never called. (gate() already logged the decision + any approval.)
  const content = blockMessage(result);

  if (body?.stream) {
    return new Response(sseBlock(model, content), {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }
  return json(completion(model, content));
}
