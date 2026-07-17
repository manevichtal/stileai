import { describe, it, expect } from "vitest";
import {
  CATEGORY_ORDER,
  CATEGORY_META,
  PROTECTION_LEVELS,
  COMPLIANCE_PRESETS,
  effectsFromPolicies,
  activeLevelKey,
  activePresetKey,
} from "./protection";
import { BALANCED_RULES, decisionFromEffect } from "./promptCheck";

describe("protection model", () => {
  it("covers all seven categories exactly once", () => {
    expect(CATEGORY_ORDER.length).toBe(7);
    expect(new Set(CATEGORY_ORDER).size).toBe(7);
    for (const c of CATEGORY_ORDER) expect(CATEGORY_META[c]).toBeTruthy();
  });

  it("every level and preset assigns all seven categories", () => {
    for (const lvl of PROTECTION_LEVELS) {
      for (const c of CATEGORY_ORDER) expect(lvl.map[c]).toBeTruthy();
    }
    for (const p of COMPLIANCE_PRESETS) {
      for (const c of CATEGORY_ORDER) expect(p.map[c]).toBeTruthy();
    }
  });

  it("Balanced level matches the engine's built-in BALANCED_RULES", () => {
    const balanced = PROTECTION_LEVELS.find((l) => l.key === "balanced")!;
    for (const c of CATEGORY_ORDER) {
      expect(decisionFromEffect(balanced.map[c])).toBe(BALANCED_RULES[c]);
    }
  });

  it("effectsFromPolicies reads category rows and ignores disabled/unknown", () => {
    const map = effectsFromPolicies([
      { action: "secrets", effect: "deny", enabled: true },
      { action: "pii", effect: "allow", enabled: true },
      { action: "phi", effect: "allow", enabled: false }, // disabled -> ignored (falls back)
      { action: "payment.charge", effect: "deny", enabled: true }, // not a content category -> ignored
    ]);
    expect(map.secrets).toBe("deny");
    expect(map.pii).toBe("allow");
    expect(map.phi).toBe("deny"); // balanced default, since the disabled row is ignored
  });

  it("activeLevelKey identifies the matching level and enforcement", () => {
    const balanced = PROTECTION_LEVELS.find((l) => l.key === "balanced")!;
    expect(activeLevelKey(balanced.map, "enforce")).toBe("balanced");
    // Same categories but monitoring -> Watch, not Balanced.
    expect(activeLevelKey(balanced.map, "monitor")).toBe("watch");
  });

  it("activePresetKey identifies an applied compliance preset", () => {
    const hipaa = COMPLIANCE_PRESETS.find((p) => p.key === "hipaa")!;
    expect(activePresetKey(hipaa.map)).toBe("hipaa");
    expect(hipaa.map.phi).toBe("deny");
  });
});
