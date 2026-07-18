// Regression tests for the per-site prompt extractors (extractors.js).
//
// These run the REAL extractor code against saved sample request bodies shaped
// like each AI vendor's actual "send message" payload. If a vendor changes their
// request shape and our extractor stops pulling the prompt out, THIS fails in CI
// rather than a customer's block silently going quiet. Update the samples here
// (and the extractor) deliberately when a vendor changes.
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { SITES, siteFor } = require("./extractors.js");

const byLabel = (label) => SITES.find((s) => s.label === label);

describe("ChatGPT extractor", () => {
  const site = byLabel("ChatGPT");
  const url = "https://chatgpt.com/backend-api/f/conversation";

  it("matches the conversation endpoint and pulls the last user message", () => {
    expect(site.matches(url)).toBe(true);
    const body = JSON.stringify({
      action: "next",
      messages: [
        { author: { role: "system" }, content: { content_type: "text", parts: ["you are helpful"] } },
        { author: { role: "user" }, content: { content_type: "text", parts: ["here is the prod key sk_live_9f2a3c"] } },
      ],
      model: "gpt-4o",
    });
    expect(site.extract(body)).toContain("sk_live_9f2a3c");
  });

  it("joins multi-part user content", () => {
    const body = JSON.stringify({
      messages: [{ author: { role: "user" }, content: { parts: ["line one", "line two"] } }],
    });
    expect(site.extract(body)).toBe("line one\nline two");
  });

  it("resolves via siteFor on chatgpt.com host", () => {
    expect(siteFor(url, "chatgpt.com")).toBe(site);
    expect(siteFor(url, "example.com")).toBe(null);
  });

  it("returns null on a shape it does not understand (does not throw)", () => {
    expect(site.extract("{ not json")).toBe(null);
    expect(site.extract(JSON.stringify({ nope: true }))).toBe(null);
  });

  it("does NOT match ChatGPT's own load-time endpoints (no false blocks)", () => {
    // These fire on page load, before the user types, and carry high-entropy
    // tokens, not user messages. Matching them caused a spurious credential block.
    expect(site.matches("https://chatgpt.com/backend-api/conversation/requirements")).toBe(false);
    expect(site.matches("https://chatgpt.com/backend-api/conversations?offset=0&limit=28")).toBe(false);
    expect(site.matches("https://chatgpt.com/backend-api/conversation/2b3f-uuid")).toBe(false);
    expect(site.matches("https://chatgpt.com/backend-api/conversation/init")).toBe(false);
    // ...but the real send endpoints still match, with or without a query string.
    expect(site.matches("https://chatgpt.com/backend-api/conversation")).toBe(true);
    expect(site.matches("https://chatgpt.com/backend-api/f/conversation")).toBe(true);
    expect(site.matches("https://chatgpt.com/backend-api/conversation?ex=1")).toBe(true);
  });
});

describe("Claude extractor", () => {
  const site = byLabel("Claude");
  const url = "https://claude.ai/api/organizations/x/chat_conversations/abc/completion";

  it("matches the completion endpoint and reads the prompt field", () => {
    expect(site.matches(url)).toBe(true);
    const body = JSON.stringify({ prompt: "summarize our customer list", timezone: "UTC" });
    expect(site.extract(body)).toBe("summarize our customer list");
  });

  it("falls back to the last user message when there is no prompt field", () => {
    const body = JSON.stringify({
      messages: [
        { role: "assistant", content: "hi" },
        { role: "user", content: "paste of source code here" },
      ],
    });
    expect(site.extract(body)).toBe("paste of source code here");
  });

  it("resolves via siteFor on claude.ai host", () => {
    expect(siteFor(url, "claude.ai")).toBe(site);
  });
});

describe("Gemini extractor", () => {
  const site = byLabel("Gemini");
  const url = "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate";

  it("matches StreamGenerate and pulls the longest string out of f.req", () => {
    expect(site.matches(url)).toBe(true);
    const inner = JSON.stringify([[["a", null], null, ["what is our internal revenue for Q3 2026"]]]);
    const body = new URLSearchParams({ "f.req": inner, at: "token" }).toString();
    expect(site.extract(body)).toContain("internal revenue");
  });

  it("resolves via siteFor on gemini.google.com host", () => {
    expect(siteFor(url, "gemini.google.com")).toBe(site);
  });
});

describe("Grok extractor", () => {
  const site = byLabel("Grok");
  const url = "https://grok.com/rest/app-chat/conversations/abc123/responses";

  it("matches a follow-up send and reads the message field", () => {
    expect(site.matches(url)).toBe(true);
    const body = JSON.stringify({
      message: "here is the prod key AKIA5F2KQX8",
      modelName: "grok-3",
      parentResponseId: "b3bcf1a9-57ce-5236-b35d-710afe71e056",
    });
    expect(site.extract(body)).toContain("AKIA5F2KQX8");
  });

  it("matches a new-conversation send", () => {
    expect(site.matches("https://grok.com/rest/app-chat/conversations/new")).toBe(true);
    const body = JSON.stringify({ message: "leak customer john@acme.co", modelName: "grok-3" });
    expect(site.extract(body)).toContain("john@acme.co");
  });

  it("does NOT extract from the sibling fetch that only carries responseIds", () => {
    // grok.com posts {responseIds:[...]} to fetch its own answer back; that is not a
    // user message, so extraction must return null (no spurious check on a UUID).
    const body = JSON.stringify({ responseIds: ["671c12e1-aa24-403c-b6e3-e502f8225be6"] });
    expect(site.extract(body)).toBe(null);
  });

  it("falls back to the longest string when the message is under an unexpected field", () => {
    // Grok has shuffled the user turn between fields across versions. As long as the
    // request carries the user's text somewhere, the longest-string fallback finds it.
    const body = JSON.stringify({
      modelName: "grok-3",
      conversationId: "b3bcf1a9-57ce-5236-b35d-710afe71e056",
      userInput: { kind: "text", value: "here is our aws key AKIA5F2KQX8ZZQEXAMPLE" },
    });
    expect(site.extract(body)).toContain("AKIA5F2KQX8ZZQEXAMPLE");
  });

  it("resolves via siteFor on grok.com host", () => {
    expect(siteFor(url, "grok.com")).toBe(site);
    expect(siteFor(url, "example.com")).toBe(null);
  });
});

describe("Copilot extractor", () => {
  const site = byLabel("Copilot");
  const url = "https://copilot.microsoft.com/c/api/conversations/biGTUmdHjc5PDCgNUQkBW/turns";

  it("matches the conversations API and reads text from the content array", () => {
    expect(site.matches(url)).toBe(true);
    const body = JSON.stringify({
      content: [{ type: "text", text: "here is the prod key AKIA5F2KQX8" }],
      mode: "smart",
    });
    expect(site.extract(body)).toContain("AKIA5F2KQX8");
  });

  it("reads a plain text field when present", () => {
    expect(site.extract(JSON.stringify({ text: "leak customer john@acme.co" }))).toContain("john@acme.co");
  });

  it("pulls the human turn out of a results list", () => {
    const body = JSON.stringify({
      results: [
        { author: { type: "ai" }, content: [{ type: "text", text: "hi there" }] },
        { author: { type: "human" }, content: [{ type: "text", text: "our source is auth/login.ts" }] },
      ],
    });
    expect(site.extract(body)).toContain("auth/login.ts");
  });

  it("resolves via siteFor on copilot.microsoft.com host", () => {
    expect(siteFor(url, "copilot.microsoft.com")).toBe(site);
    expect(siteFor(url, "example.com")).toBe(null);
  });

  it("returns null on an unrelated shape (no false blocks)", () => {
    expect(site.extract(JSON.stringify({ telemetry: true, count: 3 }))).toBe(null);
  });
});

describe("siteFor", () => {
  it("returns null for a non-AI host even if the path matches", () => {
    expect(siteFor("https://evil.com/backend-api/conversation", "evil.com")).toBe(null);
  });
});
