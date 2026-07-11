import { describe, it, expect } from "vitest";
import { POLICY_PACKS, PACK_CATEGORIES, packByKey, totalTemplateCount } from "./policyTemplates";

const EFFECTS = new Set(["allow", "deny", "require_approval"]);

describe("policy library integrity", () => {
  it("has a large, non-trivial library", () => {
    expect(totalTemplateCount()).toBeGreaterThanOrEqual(300);
    expect(totalTemplateCount()).toBe(
      POLICY_PACKS.reduce((n, p) => n + p.templates.length, 0),
    );
  });

  it("every policy_id is globally unique (upsert key)", () => {
    const ids = POLICY_PACKS.flatMap((p) => p.templates.map((t) => t.policy_id));
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("every pack key is unique", () => {
    const keys = POLICY_PACKS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every template has a valid effect and shape", () => {
    for (const pack of POLICY_PACKS) {
      for (const t of pack.templates) {
        expect(EFFECTS.has(t.effect)).toBe(true);
        expect(typeof t.priority).toBe("number");
        expect(t.action.length).toBeGreaterThan(0);
        expect(t.description.length).toBeGreaterThan(0);
        if (t.effect === "require_approval") {
          expect((t.approvals_required ?? 1)).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("every category key resolves to a real pack", () => {
    for (const cat of PACK_CATEGORIES) {
      for (const key of cat.keys) {
        expect(packByKey(key), `category "${cat.name}" references missing pack "${key}"`).toBeDefined();
      }
    }
  });

  it("no pack is listed in two categories", () => {
    const listed = PACK_CATEGORIES.flatMap((c) => c.keys);
    const dupes = listed.filter((k, i) => listed.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });
});
