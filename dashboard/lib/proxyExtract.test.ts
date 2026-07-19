// The gateway's job: pull the user's prompt out of a real Cursor / Claude Code
// request so gate() can inspect it. If extraction misses the text, a secret
// sails through. These exercise the shapes those tools actually send.
import { describe, it, expect } from "vitest";
import { extractOpenAIPrompt, extractAnthropicPrompt } from "./proxyExtract";

const SECRET = "AKIAIOSFODNN7EXAMPLE";

describe("extractOpenAIPrompt (Cursor / OpenAI-API tools)", () => {
  it("pulls plain string message content", () => {
    const messages = [
      { role: "system", content: "You are a coding assistant." },
      { role: "user", content: `deploy with aws key ${SECRET}` },
    ];
    expect(extractOpenAIPrompt(messages)).toContain(SECRET);
  });

  it("pulls text out of array/multipart content (vision-style messages)", () => {
    const messages = [
      { role: "user", content: [{ type: "text", text: `the db password is ${SECRET}` }, { type: "text", text: "help" }] },
    ];
    expect(extractOpenAIPrompt(messages)).toContain(SECRET);
  });

  it("returns empty string on a malformed body (no throw, gate sees nothing)", () => {
    expect(extractOpenAIPrompt(undefined)).toBe("");
    expect(extractOpenAIPrompt({} as unknown)).toBe("");
  });
});

describe("extractAnthropicPrompt (Claude Code / Anthropic-API tools)", () => {
  it("pulls a plain string user message", () => {
    const body = { messages: [{ role: "user", content: `here is our stripe key ${SECRET}` }] };
    expect(extractAnthropicPrompt(body)).toContain(SECRET);
  });

  it("pulls text out of content blocks", () => {
    const body = { messages: [{ role: "user", content: [{ type: "text", text: `paste: ${SECRET}` }] }] };
    expect(extractAnthropicPrompt(body)).toContain(SECRET);
  });

  it("also inspects the system prompt (string and array forms)", () => {
    expect(extractAnthropicPrompt({ system: `context: ${SECRET}`, messages: [] })).toContain(SECRET);
    expect(extractAnthropicPrompt({ system: [{ type: "text", text: `context: ${SECRET}` }], messages: [] })).toContain(SECRET);
  });

  it("returns empty string on a malformed body (no throw)", () => {
    expect(extractAnthropicPrompt({})).toBe("");
  });
});
