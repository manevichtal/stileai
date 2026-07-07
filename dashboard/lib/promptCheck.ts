// The core of StileAI's AI-usage policy layer: check an employee's prompt/request
// against company policy BEFORE it reaches an AI tool (ChatGPT, Claude, Gemini,
// Copilot, …). Returns approve / deny / admin-approval with a plain-language reason.
//
// This is real, deterministic detection (no external calls, no fake data): it scans
// the prompt for restricted content categories and applies the chosen policy profile.

export type Decision = "approved" | "admin_approval" | "denied";

export type Category =
  | "secrets"
  | "pii"
  | "client_data"
  | "financial"
  | "legal"
  | "phi"
  | "source_code";

export type CategoryHit = { category: Category; label: string; evidence: string };

export type CheckResult = {
  decision: Decision;
  reason: string;
  hits: CategoryHit[];
  profile: string;
};

const CATEGORY_LABEL: Record<Category, string> = {
  secrets: "Passwords / API keys / secrets",
  pii: "Personal data (PII)",
  client_data: "Customer / client data",
  financial: "Financial information",
  legal: "Legal / contract documents",
  phi: "Health information (PHI)",
  source_code: "Source code",
};

// Detectors: a category matches if ANY of its patterns hit. Patterns are a mix of
// hard signals (an actual email, a key prefix) and topic keywords.
const DETECTORS: { category: Category; patterns: RegExp[]; evidence: string }[] = [
  {
    category: "secrets",
    evidence: "looks like a password, API key, or secret",
    patterns: [
      /\b(sk_live_|sk_test_|xox[baprs]-|ghp_|gho_|AIza[0-9A-Za-z_-]{10,}|AKIA[0-9A-Z]{16})/,
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
      /\b(pass(?:word|wd)|api[\s_-]?key|secret[\s_-]?key|access[\s_-]?token|client[\s_-]?secret|credentials?)\b\s*[:=]/i,
      /\b(my|our|the) (password|api key|secret key|access token)\b/i,
    ],
  },
  {
    category: "pii",
    evidence: "contains personal data (emails, phone numbers, SSN, or card numbers)",
    patterns: [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // email address
      /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
      /\b(?:\d[ -]?){13,16}\b/, // card-like number
      /\b(\+?\d[\d\s().-]{8,}\d)\b/, // phone-like number
      /\b(phone numbers?|email addresses?|home address(?:es)?|date of birth|social security|passport number|driver'?s? licen[cs]e|personal information|\bPII\b)\b/i,
    ],
  },
  {
    category: "client_data",
    evidence: "references customer or client records",
    patterns: [
      /\b(customer|client) (list|lists|data|records?|database|contacts?|details?|information)\b/i,
      /\b(list of (our )?(customers|clients))\b/i,
      /\b(client contract|customer contract)\b/i,
    ],
  },
  {
    category: "financial",
    evidence: "references financial or banking information",
    patterns: [
      /\b(bank account|routing number|account number|iban|swift code|credit card|debit card|cvv)\b/i,
      /\b(salary|salaries|payroll|revenue|profit|financial statements?|balance sheet|income statement|invoices?)\b/i,
    ],
  },
  {
    category: "legal",
    evidence: "references a legal or contractual document",
    patterns: [
      /\b(contract|agreement|\bNDA\b|non-disclosure|terms (?:and|&) conditions|legal document|lawsuit|litigation|settlement)\b/i,
    ],
  },
  {
    category: "phi",
    evidence: "references health / medical information (PHI)",
    patterns: [
      /\b(patient|diagnosis|medical record|health record|prescription|treatment plan|\bPHI\b|medical history)\b/i,
    ],
  },
  {
    category: "source_code",
    evidence: "contains or references source code",
    patterns: [
      /```/, // code fence
      /\b(source code|codebase|repository|repo|proprietary code)\b/i,
      /\b(vulnerabilit(?:y|ies)|security review of (?:this|our) code)\b/i,
      /\b(function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+|import\s+[\w./]|#include|public\s+static|SELECT\s+.+\s+FROM)\b/,
    ],
  },
];

export type PromptProfile = {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
  rules: Partial<Record<Category, Decision>>; // unlisted categories default to "approved"
};

// A few clear presets. "Balanced" is the recommended default and matches the
// intuitive outcomes for common prompts.
export const PROFILES: PromptProfile[] = [
  {
    id: "balanced",
    name: "Balanced (recommended)",
    description:
      "Safe general AI use is allowed. Sensitive requests are sent to an admin for approval; passwords and health data are blocked outright.",
    recommended: true,
    rules: {
      secrets: "denied",
      phi: "denied",
      pii: "admin_approval",
      client_data: "admin_approval",
      financial: "admin_approval",
      legal: "admin_approval",
      source_code: "admin_approval",
    },
  },
  {
    id: "strict",
    name: "Strict",
    description:
      "Locks things down: personal data, customer data, financials, code, and secrets are all blocked. Only clearly-safe requests get through.",
    rules: {
      secrets: "denied",
      phi: "denied",
      pii: "denied",
      client_data: "denied",
      financial: "denied",
      source_code: "denied",
      legal: "admin_approval",
    },
  },
  {
    id: "relaxed",
    name: "Relaxed",
    description:
      "Light touch: everyday AI use flows freely. Only outright secrets (passwords/keys) and health data are stopped.",
    rules: {
      secrets: "denied",
      phi: "denied",
      pii: "admin_approval",
    },
  },
];

export function getProfile(id: string): PromptProfile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}

const SEVERITY: Record<Decision, number> = { approved: 0, admin_approval: 1, denied: 2 };

// The core check. Deterministic and side-effect-free.
export function checkPrompt(prompt: string, profileId: string): CheckResult {
  const profile = getProfile(profileId);
  const text = prompt ?? "";

  const hits: CategoryHit[] = [];
  for (const det of DETECTORS) {
    if (det.patterns.some((re) => re.test(text))) {
      hits.push({ category: det.category, label: CATEGORY_LABEL[det.category], evidence: det.evidence });
    }
  }

  if (hits.length === 0) {
    return {
      decision: "approved",
      reason: "No policy-restricted content detected — this is safe, general AI usage.",
      hits: [],
      profile: profile.name,
    };
  }

  // Decide per hit via the profile; the strictest outcome wins.
  let decision: Decision = "approved";
  let driver: CategoryHit | null = null;
  for (const hit of hits) {
    const d = profile.rules[hit.category] ?? "approved";
    if (SEVERITY[d] > SEVERITY[decision]) {
      decision = d;
      driver = hit;
    }
  }

  if (decision === "approved") {
    return {
      decision,
      reason: "Allowed under this policy profile — the detected content is permitted.",
      hits,
      profile: profile.name,
    };
  }

  const d = driver ?? hits[0];
  const verb = decision === "denied" ? "blocked" : "sent to an admin for approval";
  const reason = `This request was ${verb} because it ${d.evidence} (${d.label}), which your "${profile.name}" policy restricts.`;
  return { decision, reason, hits, profile: profile.name };
}
