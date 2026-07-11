"use server";

import { requireProfileContext } from "@/lib/getProfile";
import { previewDecision } from "@/lib/aiGate";

export type TestVerdict = {
  effect: "allow" | "deny" | "require_approval";
  reason: string;
  categories: { category: string; label: string }[];
};

// Runs a sample prompt through the caller's org policies and returns the verdict.
// Read-only — nothing is logged, so admins can experiment freely.
export async function checkTextAction(text: string): Promise<TestVerdict> {
  const ctx = await requireProfileContext();
  const result = await previewDecision(ctx.orgId, text ?? "");
  const effect =
    result.decision === "approved" ? "allow" : result.decision === "denied" ? "deny" : "require_approval";
  return {
    effect,
    reason: result.reason,
    categories: result.hits.map((h) => ({ category: h.category, label: h.label })),
  };
}
