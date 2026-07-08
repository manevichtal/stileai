import { describe, it, expect } from "vitest";
import { seatedIds, callerDecision } from "./seats";

const emp = (id: string, t: string) => ({ id, created_at: t });

describe("seatedIds", () => {
  it("seats the oldest N active employees", () => {
    const active = [emp("c", "2026-03"), emp("a", "2026-01"), emp("b", "2026-02")];
    const s = seatedIds(active, 2);
    expect([...s].sort()).toEqual(["a", "b"]);
  });
  it("seats nobody when planSeats is 0", () => {
    expect(seatedIds([emp("a", "2026-01")], 0).size).toBe(0);
  });
});

describe("callerDecision", () => {
  it("blocks when subscription inactive", () => {
    expect(callerDecision({ subscriptionActive: false, isAdmin: true, seated: true }).allowed).toBe(false);
  });
  it("admin passes when active regardless of seat", () => {
    expect(callerDecision({ subscriptionActive: true, isAdmin: true, seated: false }).allowed).toBe(true);
  });
  it("employee blocked when over seat limit", () => {
    const d = callerDecision({ subscriptionActive: true, isAdmin: false, seated: false });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/seat/i);
  });
  it("seated employee passes", () => {
    expect(callerDecision({ subscriptionActive: true, isAdmin: false, seated: true }).allowed).toBe(true);
  });
});
