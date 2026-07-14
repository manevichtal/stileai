import { describe, it, expect } from "vitest";
import { effectiveMode, daysLeft, monitorUntilFrom, isEnforcementMode } from "@/lib/enforcementMode";

const NOW = Date.parse("2026-07-14T12:00:00Z");
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

describe("effectiveMode", () => {
  it("defaults to enforce", () => {
    expect(effectiveMode(null, null, NOW)).toBe("enforce");
    expect(effectiveMode("enforce", null, NOW)).toBe("enforce");
    expect(effectiveMode("something-else", inDays(5), NOW)).toBe("enforce");
  });

  it("is monitor while the window is open", () => {
    expect(effectiveMode("monitor", inDays(3), NOW)).toBe("monitor");
  });

  it("reverts to enforce once the window has passed (never silently unprotected)", () => {
    expect(effectiveMode("monitor", inDays(-1), NOW)).toBe("enforce");
    expect(effectiveMode("monitor", inDays(0), NOW)).toBe("enforce"); // exactly now = expired
  });

  it("treats an unparseable date as still-monitoring rather than crashing", () => {
    expect(effectiveMode("monitor", "not-a-date", NOW)).toBe("monitor");
  });

  it("allows open-ended monitor when no window is set", () => {
    expect(effectiveMode("monitor", null, NOW)).toBe("monitor");
  });
});

describe("daysLeft", () => {
  it("counts whole days remaining", () => {
    expect(daysLeft(inDays(14), NOW)).toBe(14);
    expect(daysLeft(inDays(0.4), NOW)).toBe(1); // rounds up a partial day
  });
  it("is 0 when past and null when unset", () => {
    expect(daysLeft(inDays(-2), NOW)).toBe(0);
    expect(daysLeft(null, NOW)).toBe(null);
  });
});

describe("monitorUntilFrom", () => {
  it("builds a window N days out and reads back as monitoring", () => {
    const until = monitorUntilFrom(NOW, 14);
    expect(effectiveMode("monitor", until, NOW)).toBe("monitor");
    expect(daysLeft(until, NOW)).toBe(14);
  });
  it("floors to at least one day", () => {
    expect(daysLeft(monitorUntilFrom(NOW, 0), NOW)).toBe(1);
  });
});

describe("isEnforcementMode", () => {
  it("validates the vocabulary", () => {
    expect(isEnforcementMode("enforce")).toBe(true);
    expect(isEnforcementMode("monitor")).toBe(true);
    expect(isEnforcementMode("observe")).toBe(false);
    expect(isEnforcementMode(null)).toBe(false);
  });
});
