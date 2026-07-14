import { describe, it, expect, vi, beforeEach } from "vitest";

// A fake Supabase admin client: policies + settings are read, inserts are captured.
// Enough to exercise gate()'s enforce vs monitor branch without a real database.
function fakeAdmin(tables: { policies?: unknown[]; settings?: unknown }) {
  const inserts: { table: string; row: Record<string, unknown> }[] = [];
  const make = (table: string) => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.order = () => b;
    b.limit = () => b;
    b.maybeSingle = async () => ({ data: table === "org_policy_settings" ? (tables.settings ?? null) : null });
    b.insert = (row: Record<string, unknown>) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: null });
    };
    // Awaiting the builder itself (the policies query) resolves to { data }.
    b.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: table === "policies" ? (tables.policies ?? []) : null }).then(resolve);
    return b;
  };
  return { inserts, from: (t: string) => make(t) };
}

let current: ReturnType<typeof fakeAdmin>;
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => current }));

import { gate } from "@/lib/aiGate";

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const SECRET_PROMPT = "here is the prod key sk_live_9f2a3c please use it";
const CLEAN_PROMPT = "what is a good recipe for banana bread?";

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY; // keep the AI step off; the free layer decides
});

describe("gate() enforce mode (default)", () => {
  it("blocks a secret and logs a real deny", async () => {
    current = fakeAdmin({ settings: { enforcement_mode: "enforce", monitor_until: null } });
    const r = await gate("org1", SECRET_PROMPT, "ChatGPT", "emp1");
    expect(r.decision).toBe("denied");
    expect(r.monitored).toBeUndefined();
    const audit = current.inserts.find((i) => i.table === "audit_log");
    expect(audit?.row.effect).toBe("deny");
    expect(audit?.row.status).toBe("denied");
  });
});

describe("gate() monitor mode", () => {
  it("passes a secret through but logs what WOULD have happened", async () => {
    current = fakeAdmin({ settings: { enforcement_mode: "monitor", monitor_until: future } });
    const r = await gate("org1", SECRET_PROMPT, "ChatGPT", "emp1");
    // The caller sees allow → nothing is blocked or held.
    expect(r.decision).toBe("approved");
    expect(r.monitored).toBe(true);
    expect(r.wouldDecision).toBe("denied");
    // The audit row records the pass-through effect but the would-have detail.
    const audit = current.inserts.find((i) => i.table === "audit_log");
    expect(audit?.row.effect).toBe("allow");
    expect(audit?.row.status).toBe("monitored");
    expect((audit?.row.params as { monitor?: boolean }).monitor).toBe(true);
    expect((audit?.row.params as { would_effect?: string }).would_effect).toBe("deny");
    // No approval is queued in monitor mode.
    expect(current.inserts.some((i) => i.table === "approvals")).toBe(false);
  });

  it("an expired monitor window enforces again (never silently unprotected)", async () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    current = fakeAdmin({ settings: { enforcement_mode: "monitor", monitor_until: past } });
    const r = await gate("org1", SECRET_PROMPT, "ChatGPT", "emp1");
    expect(r.decision).toBe("denied"); // back to enforcing
  });

  it("a clean prompt is a normal allow even in monitor mode", async () => {
    current = fakeAdmin({ settings: { enforcement_mode: "monitor", monitor_until: future } });
    const r = await gate("org1", CLEAN_PROMPT, "ChatGPT", "emp1");
    expect(r.decision).toBe("approved");
    expect(r.monitored).toBeUndefined();
    const audit = current.inserts.find((i) => i.table === "audit_log");
    expect(audit?.row.status).toBe("allowed");
  });
});
