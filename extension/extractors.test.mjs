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

describe("siteFor", () => {
  it("returns null for a non-AI host even if the path matches", () => {
    expect(siteFor("https://evil.com/backend-api/conversation", "evil.com")).toBe(null);
  });
});
