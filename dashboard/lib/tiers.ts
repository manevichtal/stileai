// Single source of truth for what each subscription tier can access.
// Read by the policies gate, the audit query, and the Billing page so they never
// disagree. Orgs with no plan (grandfathered / platform-admin) and Enterprise get
// everything — only Starter and Business are actually restricted.

export type Capabilities = {
  policyPacks: "core" | "all";
  auditRetentionDays: number | null; // null = unlimited
  perEmployeeAudit: boolean;
};

// "Core" packs available on every tier, including Starter. Everything else in
// POLICY_PACKS is Business+ only.
export const CORE_PACK_KEYS = ["ai-usage", "baseline"] as const;

export function capabilitiesFor(plan: string | null | undefined): Capabilities {
  switch (plan) {
    case "starter":
      return { policyPacks: "core", auditRetentionDays: 30, perEmployeeAudit: false };
    case "business":
      return { policyPacks: "all", auditRetentionDays: 365, perEmployeeAudit: true };
    case "enterprise":
    default:
      // enterprise, or no/unknown plan (grandfathered + platform-admin orgs) → full access
      return { policyPacks: "all", auditRetentionDays: null, perEmployeeAudit: true };
  }
}

// Whether a given policy pack may be enabled on this plan.
export function packAllowed(plan: string | null | undefined, packKey: string): boolean {
  if (capabilitiesFor(plan).policyPacks === "all") return true;
  return (CORE_PACK_KEYS as readonly string[]).includes(packKey);
}

// The earliest audit timestamp this plan may see (ISO string), or null for unlimited.
export function auditFloorISO(plan: string | null | undefined, now: number): string | null {
  const days = capabilitiesFor(plan).auditRetentionDays;
  if (days == null) return null;
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}
