// The "simple" policy model that the redesigned Policies page is built on.
//
// The live decision engine (lib/aiGate.ts) turns each org's `policies` rows into a
// per-category decision: for every kind of sensitive content it finds, it does
// what the matching policy's `effect` says. There are exactly SEVEN content
// categories, and three possible effects. That is the whole real decision surface.
//
// This file gives that surface plain-language names, examples, one-click
// "protection levels", and compliance presets that ACTUALLY set the seven
// categories (unlike the legacy agent-action packs, which fire on a different
// path). Everything here compiles down to ordinary `policies` rows via the
// server actions, so the engine is unchanged.

import type { Category } from "@/lib/promptCheck";

export type Effect = "allow" | "require_approval" | "deny";

// The three choices an admin makes per category, in plain words.
export const EFFECT_LABEL: Record<Effect, string> = {
  allow: "Allow",
  require_approval: "Ask an admin",
  deny: "Block",
};

// Fixed display order (most-dangerous first).
export const CATEGORY_ORDER: Category[] = [
  "secrets",
  "source_code",
  "client_data",
  "pii",
  "financial",
  "legal",
  "phi",
];

export type CategoryMeta = {
  policyId: string; // canonical policies.policy_id, shared with the ai-usage pack (idempotent)
  label: string;
  short: string;
  example: string;
};

// policyId values match the existing "ai-usage" pack so writing the grid upserts
// the same rows rather than creating duplicates.
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  secrets: {
    policyId: "ai-secrets",
    label: "Passwords, API keys & secrets",
    short: "Credentials of any kind",
    example: "an AWS key, a database password, an access token",
  },
  source_code: {
    policyId: "ai-source-code",
    label: "Source code",
    short: "Proprietary code and config",
    example: "a code file, a script, a config with connection strings",
  },
  client_data: {
    policyId: "ai-client-data",
    label: "Customer & client data",
    short: "Records about the people you serve",
    example: "a customer list, a client's account details",
  },
  pii: {
    policyId: "ai-pii",
    label: "Personal data (PII)",
    short: "Information that identifies a person",
    example: "names with emails, phone numbers, national IDs, addresses",
  },
  financial: {
    policyId: "ai-financial",
    label: "Financial information",
    short: "Money, accounts, and card data",
    example: "unpublished revenue, bank details, a card number",
  },
  legal: {
    policyId: "ai-legal",
    label: "Legal & contract documents",
    short: "Contracts and legal text",
    example: "an NDA, a signed agreement, litigation notes",
  },
  phi: {
    policyId: "ai-phi",
    label: "Health information (PHI)",
    short: "Health data about a person",
    example: "a medical record, a diagnosis, a health claim",
  },
};

// ---- Protection levels: one click sets all seven categories + enforcement -----

export type LevelKey = "watch" | "balanced" | "strict";
export type ProtectionLevel = {
  key: LevelKey;
  name: string;
  tagline: string;
  enforcement: "monitor" | "enforce";
  recommended?: boolean;
  map: Record<Category, Effect>;
};

// Balanced = block the clear-cut dangers, ask an admin on the judgment calls.
// Mirrors the engine's BALANCED_RULES so "Balanced" matches the built-in default.
const BALANCED_MAP: Record<Category, Effect> = {
  secrets: "deny",
  phi: "deny",
  source_code: "require_approval",
  client_data: "require_approval",
  pii: "require_approval",
  financial: "require_approval",
  legal: "require_approval",
};

// Strict = block almost everything sensitive; only the two most everyday
// categories still route to an admin instead of a hard block.
const STRICT_MAP: Record<Category, Effect> = {
  secrets: "deny",
  phi: "deny",
  source_code: "deny",
  client_data: "deny",
  financial: "deny",
  pii: "require_approval",
  legal: "require_approval",
};

export const PROTECTION_LEVELS: ProtectionLevel[] = [
  {
    key: "watch",
    name: "Watch only",
    tagline: "See everything your team sends to AI, block nothing. The safe way to start.",
    enforcement: "monitor",
    map: BALANCED_MAP,
  },
  {
    key: "balanced",
    name: "Balanced",
    tagline: "Block the obvious dangers, ask an admin on the judgment calls.",
    enforcement: "enforce",
    recommended: true,
    map: BALANCED_MAP,
  },
  {
    key: "strict",
    name: "Strict",
    tagline: "Lock it down. Block or require approval on everything sensitive.",
    enforcement: "enforce",
    map: STRICT_MAP,
  },
];

// ---- Compliance presets: framework-shaped postures over the same 7 categories --

export type CompliancePreset = {
  key: string;
  name: string;
  framework: string;
  summary: string;
  map: Record<Category, Effect>;
  controls: Partial<Record<Category, string>>; // category -> the control it satisfies
};

export const COMPLIANCE_PRESETS: CompliancePreset[] = [
  {
    key: "soc2",
    name: "SOC 2",
    framework: "Trust Services Criteria",
    summary: "Protect sensitive data broadly: block secrets, and route customer data, source code, and the rest to an admin.",
    map: {
      secrets: "deny",
      source_code: "require_approval",
      client_data: "require_approval",
      pii: "require_approval",
      financial: "require_approval",
      legal: "require_approval",
      phi: "require_approval",
    },
    controls: {
      secrets: "CC6.1 Logical access",
      client_data: "CC6.7 Data transfer",
      source_code: "CC6.1 Logical access",
    },
  },
  {
    key: "hipaa",
    name: "HIPAA",
    framework: "Protected Health Information",
    summary: "Block health information outright and hold personal and customer data for approval.",
    map: {
      phi: "deny",
      secrets: "deny",
      pii: "require_approval",
      client_data: "require_approval",
      financial: "require_approval",
      legal: "require_approval",
      source_code: "require_approval",
    },
    controls: {
      phi: "§164.312(e) Transmission security",
      pii: "§164.312(a) Access control",
    },
  },
  {
    key: "pci",
    name: "PCI-DSS",
    framework: "Cardholder data",
    summary: "Block financial and card data and secrets; hold the rest for approval.",
    map: {
      financial: "deny",
      secrets: "deny",
      pii: "require_approval",
      client_data: "require_approval",
      phi: "require_approval",
      legal: "require_approval",
      source_code: "require_approval",
    },
    controls: {
      financial: "Req. 3 Protect stored cardholder data",
      secrets: "Req. 3.4 Render PAN unreadable",
    },
  },
  {
    key: "gdpr",
    name: "GDPR",
    framework: "Personal data",
    summary: "Hold all personal and customer data for approval, and block secrets.",
    map: {
      pii: "require_approval",
      client_data: "require_approval",
      secrets: "deny",
      financial: "require_approval",
      phi: "require_approval",
      legal: "require_approval",
      source_code: "require_approval",
    },
    controls: {
      pii: "Art. 5 Integrity & confidentiality",
      client_data: "Art. 44 Transfers",
    },
  },
  {
    key: "iso27001",
    name: "ISO 27001",
    framework: "Information security",
    summary: "Block secrets and route source code, customer, and personal data to an admin.",
    map: {
      secrets: "deny",
      source_code: "require_approval",
      financial: "require_approval",
      client_data: "require_approval",
      pii: "require_approval",
      legal: "require_approval",
      phi: "require_approval",
    },
    controls: {
      secrets: "A.9 Access control",
      source_code: "A.8 Asset management",
    },
  },
];

// ---- Helpers ---------------------------------------------------------------

// Build the current per-category effect map from the org's policy rows. A
// category with no rule falls back to the Balanced default so the grid always
// shows a real, honest current state.
export function effectsFromPolicies(
  rows: { action?: string | null; effect?: string | null; enabled?: boolean }[],
): Record<Category, Effect> {
  const out = { ...BALANCED_MAP };
  for (const r of rows) {
    if (r.enabled === false) continue;
    const cat = r.action as Category;
    if (cat in CATEGORY_META && (r.effect === "allow" || r.effect === "deny" || r.effect === "require_approval")) {
      out[cat] = r.effect;
    }
  }
  return out;
}

function sameMap(a: Record<Category, Effect>, b: Record<Category, Effect>): boolean {
  return CATEGORY_ORDER.every((c) => a[c] === b[c]);
}

// Which protection level (if any) the current map exactly matches. Enforcement
// mode is compared by the caller, since it lives in a separate setting.
export function activeLevelKey(
  map: Record<Category, Effect>,
  enforcement: "monitor" | "enforce",
): LevelKey | null {
  for (const lvl of PROTECTION_LEVELS) {
    if (lvl.enforcement === enforcement && sameMap(lvl.map, map)) return lvl.key;
  }
  return null;
}

export function activePresetKey(map: Record<Category, Effect>): string | null {
  for (const p of COMPLIANCE_PRESETS) if (sameMap(p.map, map)) return p.key;
  return null;
}
