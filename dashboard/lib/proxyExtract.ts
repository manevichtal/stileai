// Prompt extraction for the AI gateway proxy routes. Turns an incoming OpenAI-
// or Anthropic-shaped request body into the plain text that gate() inspects.
//
// Factored out (like the extension's extractors.js) so the parsing is unit-tested
// against real request shapes rather than trusted blind: if a tool packages the
// prompt in a way we do not read, gate() would see empty text and wave a secret
// through. These tests fail if that ever regresses.

// OpenAI /v1/chat/completions: { messages: [{ role, content }] }, where content
// is a string or an array of parts ({ text }). Cursor and most OpenAI-API tools
// use this shape.
export function extractOpenAIPrompt(messages: unknown): string {
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

// Anthropic /v1/messages: { system?, messages: [{ role, content }] }, where
// system/content are strings or arrays of blocks ({ text } or { content }).
// Claude Code uses this shape.
export function extractAnthropicPrompt(body: { system?: unknown; messages?: unknown }): string {
  const parts: string[] = [];
  const sys = body?.system;
  if (typeof sys === "string") parts.push(sys);
  else if (Array.isArray(sys)) parts.push(sys.map((b) => (b as { text?: string })?.text ?? "").join(" "));
  for (const m of Array.isArray(body?.messages) ? body.messages : []) {
    const c = (m as { content?: unknown })?.content;
    if (typeof c === "string") parts.push(c);
    else if (Array.isArray(c)) {
      for (const b of c) {
        const block = b as { text?: string; content?: unknown };
        if (typeof block?.text === "string") parts.push(block.text);
        else if (typeof block?.content === "string") parts.push(block.content);
      }
    }
  }
  return parts.join("\n");
}
