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

export const CATEGORY_LABEL: Record<Category, string> = {
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

// A per-category decision map. This is what the org's Policies produce: for each
// kind of restricted content, what StileAI does — approve, ask an admin, or deny.
export type CategoryRules = Partial<Record<Category, Decision>>;

// The recommended defaults, used until an admin sets their own policies. The
// dashboard's Policies page overrides these per category (see the "AI request
// policy" pack), so what the admin configures is exactly what happens.
export const BALANCED_RULES: CategoryRules = {
  secrets: "denied",
  phi: "denied",
  pii: "admin_approval",
  client_data: "admin_approval",
  financial: "admin_approval",
  legal: "admin_approval",
  source_code: "admin_approval",
};

// Map a dashboard policy effect (allow/deny/require_approval) to a prompt decision.
export function decisionFromEffect(effect: string): Decision {
  return effect === "allow" ? "approved" : effect === "deny" ? "denied" : "admin_approval";
}

const SEVERITY: Record<Decision, number> = { approved: 0, admin_approval: 1, denied: 2 };

// A privacy-preserving preview for the audit trail: the prompt with every detected
// sensitive span masked to "••••", so an admin sees the context and intent of a
// blocked message WITHOUT the raw secret/PII ever being stored. Truncated for size.
// (The unmasked remainder is, by definition, text no detector flagged as sensitive —
// the same risk level as an allowed preview.)
export function redactSensitive(text: string, maxLen = 280): string {
  let out = text ?? "";
  for (const det of DETECTORS) {
    for (const re of det.patterns) {
      const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
      out = out.replace(new RegExp(re.source, flags), "••••");
    }
  }
  return out.length > maxLen ? out.slice(0, maxLen) + "…" : out;
}

// The core check: detect restricted content, then decide per the org's policy
// rules. Deterministic and side-effect-free. `rules` comes straight from the
// Policies page — the strictest matching rule wins.
export function checkPrompt(prompt: string, rules: CategoryRules = BALANCED_RULES): CheckResult {
  const text = prompt ?? "";
  const hits: CategoryHit[] = [];
  for (const det of DETECTORS) {
    if (det.patterns.some((re) => re.test(text))) {
      hits.push({ category: det.category, label: CATEGORY_LABEL[det.category], evidence: det.evidence });
    }
  }
  if (hits.length === 0) {
    return { decision: "approved", reason: "No policy-restricted content detected — safe, general AI usage.", hits: [], profile: "your policies" };
  }
  let decision: Decision = "approved";
  let driver: CategoryHit | null = null;
  for (const hit of hits) {
    const d = rules[hit.category] ?? "approved";
    if (SEVERITY[d] > SEVERITY[decision]) { decision = d; driver = hit; }
  }
  if (decision === "approved") {
    return { decision, reason: "Allowed under your current policies.", hits, profile: "your policies" };
  }
  const d = driver ?? hits[0];
  const verb = decision === "denied" ? "blocked" : "sent to an admin for approval";
  const reason = `This request was ${verb} because it ${d.evidence} (${d.label}), which your policies restrict.`;
  return { decision, reason, hits, profile: "your policies" };
}
