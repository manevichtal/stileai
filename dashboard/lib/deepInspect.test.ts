import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isGrayZone, escalateIfNeeded } from "./deepInspect";
import { BALANCED_RULES, type CheckResult } from "./promptCheck";

const approved: CheckResult = {
  decision: "approved",
  reason: "Allowed under your current policies.",
  hits: [],
  profile: "your policies",
};

describe("gray-zone routing (keeps the AI on a small slice of traffic)", () => {
  it("skips short, plainly-casual prompts", () => {
    expect(isGrayZone("write me a haiku about the sea")).toBe(false);
    expect(isGrayZone("what's a good name for a cat?")).toBe(false);
  });

  it("escalates a long prompt that references sensitive-sounding material", () => {
    const p =
      "Please rewrite the following note so it reads more professionally. " +
      "It concerns our internal customer account records and the revenue we booked last quarter, " +
      "and I want to make sure the tone is right before I share it with the wider company team.";
    expect(isGrayZone(p)).toBe(true);
  });

  it("escalates a long prompt carrying lots of numbers or tabular data", () => {
    const csv =
      "Clean up this export for me and summarize it:\n" +
      "id,name,plan,mrr\n1,Acme,pro,1200\n2,Volt,team,880\n3,Cedar,pro,1500\n4,Meridian,ent,4200\n";
    expect(isGrayZone(csv)).toBe(true);
  });
});

describe("fail-safe: never runs, never loosens without the model", () => {
  const prev = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY; // deep inspection disabled
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prev;
  });

  it("returns the free decision unchanged when disabled", async () => {
    const risky =
      "Rewrite this to be clearer: our internal customer account list and payroll revenue figures for the whole company.";
    const out = await escalateIfNeeded("org-1", risky, BALANCED_RULES, approved);
    expect(out).toBe(approved);
  });

  it("never second-guesses a prompt the free layer already blocked", async () => {
    const denied: CheckResult = { decision: "denied", reason: "blocked", hits: [], profile: "your policies" };
    const out = await escalateIfNeeded("org-1", "anything", BALANCED_RULES, denied);
    expect(out).toBe(denied);
  });
});
