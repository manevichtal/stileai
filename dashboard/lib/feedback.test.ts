import { describe, it, expect } from "vitest";
import { isFeedbackKind, normalizeNote, recordFeedback, MAX_NOTE } from "@/lib/feedback";

describe("feedback validation", () => {
  it("accepts only the known kinds", () => {
    expect(isFeedbackKind("false_positive")).toBe(true);
    expect(isFeedbackKind("false_negative")).toBe(true);
    expect(isFeedbackKind("other")).toBe(true);
    expect(isFeedbackKind("wrong")).toBe(false);
    expect(isFeedbackKind("")).toBe(false);
    expect(isFeedbackKind(null)).toBe(false);
  });

  it("normalizes and caps the note", () => {
    expect(normalizeNote("  hi  ")).toBe("hi");
    expect(normalizeNote(123)).toBe("");
    expect(normalizeNote("x".repeat(MAX_NOTE + 50)).length).toBe(MAX_NOTE);
  });
});

// A tiny fake Supabase query builder that records the calls and returns a
// preset result. Enough to assert org-scoping and the graceful-degrade paths
// without a real database.
function fakeAdmin(opts: {
  auditRow?: unknown;
  auditError?: { code?: string } | null;
  insertError?: { code?: string } | null;
}) {
  const calls: { table: string; eq: Record<string, unknown> }[] = [];
  return {
    calls,
    from(table: string) {
      const eq: Record<string, unknown> = {};
      const entry = { table, eq };
      calls.push(entry);
      const chain: Record<string, (...a: unknown[]) => unknown> = {};
      chain.select = () => chain;
      chain.eq = (col: string, val: unknown) => {
        eq[col] = val;
        return chain;
      };
      chain.order = () => chain;
      chain.limit = () => chain;
      chain.maybeSingle = async () => ({ data: opts.auditRow ?? null, error: opts.auditError ?? null });
      chain.insert = () => chain;
      chain.single = async () => ({
        data: opts.insertError ? null : { id: "fb-1" },
        error: opts.insertError ?? null,
      });
      return chain;
    },
  };
}

describe("recordFeedback", () => {
  const input = { decisionId: "dec-123", kind: "false_positive" as const, note: "should have passed", reportedBy: "a@b.com" };

  it("rejects a missing org, decision id, or bad kind", async () => {
    const a = fakeAdmin({}) as never;
    expect(await recordFeedback(a, "", input)).toEqual({ ok: false, error: "invalid" });
    expect(await recordFeedback(a, "org1", { ...input, decisionId: "" })).toEqual({ ok: false, error: "invalid" });
    // @ts-expect-error deliberately bad kind
    expect(await recordFeedback(a, "org1", { ...input, kind: "nope" })).toEqual({ ok: false, error: "invalid" });
  });

  it("returns not_found when the decision is not in this org", async () => {
    const a = fakeAdmin({ auditRow: null }) as never;
    const r = await recordFeedback(a, "org1", input);
    expect(r).toEqual({ ok: false, error: "not_found" });
  });

  it("scopes the audit lookup to the caller's org", async () => {
    const a = fakeAdmin({ auditRow: { effect: "deny", reason: "secret", params: { preview: "••••" } } });
    await recordFeedback(a as never, "org-XYZ", input);
    const auditCall = a.calls.find((c) => c.table === "audit_log");
    expect(auditCall?.eq.org_id).toBe("org-XYZ");
    expect(auditCall?.eq.decision_id).toBe("dec-123");
  });

  it("records feedback on a real decision", async () => {
    const a = fakeAdmin({ auditRow: { effect: "deny", reason: "secret", params: { preview: "••••" } } }) as never;
    const r = await recordFeedback(a, "org1", input);
    expect(r).toEqual({ ok: true, id: "fb-1" });
  });

  it("degrades to not_enabled when the table is missing (42P01)", async () => {
    const a = fakeAdmin({ auditError: { code: "42P01" } }) as never;
    const r = await recordFeedback(a, "org1", input);
    expect(r).toEqual({ ok: false, error: "not_enabled" });
  });
});
