import { describe, it, expect } from "vitest";
import { capabilitiesFor, packAllowed, auditFloorISO, CORE_PACK_KEYS } from "./tiers";

describe("capabilitiesFor", () => {
  it("starter: core packs, 30-day retention, no per-employee audit", () => {
    expect(capabilitiesFor("starter")).toEqual({ policyPacks: "core", auditRetentionDays: 30, perEmployeeAudit: false });
  });
  it("business: all packs, 1-year, per-employee audit", () => {
    expect(capabilitiesFor("business")).toEqual({ policyPacks: "all", auditRetentionDays: 365, perEmployeeAudit: true });
  });
  it("enterprise and no-plan get full unlimited access", () => {
    const full = { policyPacks: "all", auditRetentionDays: null, perEmployeeAudit: true };
    expect(capabilitiesFor("enterprise")).toEqual(full);
    expect(capabilitiesFor(null)).toEqual(full);
    expect(capabilitiesFor(undefined)).toEqual(full);
  });
});

describe("packAllowed", () => {
  it("starter can enable only core packs", () => {
    for (const k of CORE_PACK_KEYS) expect(packAllowed("starter", k)).toBe(true);
    expect(packAllowed("starter", "soc2")).toBe(false);
    expect(packAllowed("starter", "hipaa")).toBe(false);
  });
  it("business and no-plan can enable any pack", () => {
    expect(packAllowed("business", "soc2")).toBe(true);
    expect(packAllowed(null, "soc2")).toBe(true);
  });
});

describe("auditFloorISO", () => {
  const now = 1893456000000; // fixed epoch ms
  it("starter floor is 30 days before now", () => {
    expect(auditFloorISO("starter", now)).toBe(new Date(now - 30 * 86400000).toISOString());
  });
  it("unlimited plans have no floor", () => {
    expect(auditFloorISO("enterprise", now)).toBeNull();
    expect(auditFloorISO(null, now)).toBeNull();
  });
});
