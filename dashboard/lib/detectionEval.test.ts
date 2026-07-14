import { describe, it, expect } from "vitest";
import { CORPUS, evaluate, summarize, classify } from "@/lib/detectionEval";

// These lock in detection quality against the labeled corpus. If a future change
// to the fast layer or the gray-zone router regresses coverage, this fails.
describe("detection coverage", () => {
  const rows = evaluate(CORPUS);
  const summary = summarize(rows);

  it("never lets a sensitive sample slip past BOTH the fast layer and the AI router", () => {
    const misses = rows.filter((r) => r.outcome === "miss");
    expect(misses, `misses: ${misses.map((m) => m.sample.id).join(", ")}`).toHaveLength(0);
    expect(summary.miss).toBe(0);
  });

  it("catches every hard-signal leak in the fast layer itself (no AI needed)", () => {
    for (const id of ["secret-apikey", "secret-privkey", "pii-card", "pii-ssn", "pii-email-list"]) {
      const r = rows.find((x) => x.sample.id === id)!;
      expect(r.decision, id).not.toBe("approved");
    }
  });

  it("routes the reworded and non-English leaks to the AI (gray zone)", () => {
    for (const id of ["reworded-confidential", "nonenglish-phi"]) {
      const r = rows.find((x) => x.sample.id === id)!;
      expect(r.gray, id).toBe(true);
    }
  });

  it("keeps clearly-casual prompts clean (no block, no AI call)", () => {
    for (const id of ["benign-poem", "benign-recipe", "benign-explain"]) {
      const r = rows.find((x) => x.sample.id === id)!;
      expect(r.outcome, id).toBe("clean");
    }
  });

  // Known, accepted for now: the fast layer over-flags a couple of harmless
  // trigger-word prompts. The AI can't undo a fast-layer hold (it only tightens),
  // so this is a separate design decision (see docs/phase-2-plan.md). We ASSERT the
  // current count so it can't silently grow while we decide how to handle it.
  it("tracks the known false-positive count so it can't creep up unnoticed", () => {
    expect(summary.false_positive).toBeLessThanOrEqual(2);
  });
});

describe("classify()", () => {
  it("labels a fresh benign one-liner as clean", () => {
    const r = classify({ id: "adhoc", label: "benign", note: "", text: "hi, can you help me write a haiku?" });
    expect(r.outcome).toBe("clean");
  });
});
