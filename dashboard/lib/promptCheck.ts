// The core of StileAI's AI-usage policy layer: check an employee's prompt/request
// against company policy BEFORE it reaches an AI tool (ChatGPT, Claude, Gemini,
// Copilot, …). Returns approve / deny / admin-approval with a plain-language reason.
//
// This is real, deterministic detection (no external calls, no fake data). It is
// built in LAYERS so it catches content that isn't typed the "expected" way:
//   1. Normalize   — fold unicode/homoglyphs, strip zero-width chars, undo spacing
//                    tricks, fold leetspeak, and decode embedded base64/hex/URL so
//                    a hidden secret is scanned in the clear.
//   2. Heuristics  — high-entropy tokens, Luhn-valid cards, connection strings and
//                    JWTs are caught by shape, not by a known prefix (novel formats).
//   3. Meaning     — broad synonym lexicons per category (paraphrase, not exact words).
//   4. Escalation  — anything that only surfaces AFTER de-obfuscation is treated as
//                    an evasion attempt and never allowed silently.

export type Decision = "approved" | "admin_approval" | "denied";

export type Category =
  | "secrets"
  | "pii"
  | "client_data"
  | "financial"
  | "legal"
  | "phi"
  | "source_code";

export type CategoryHit = { category: Category; label: string; evidence: string; obfuscated?: boolean };

export type CheckResult = {
  decision: Decision;
  reason: string;
  hits: CategoryHit[];
  profile: string;
  // Set when the request was allowed but the optional AI deep-inspection step could
  // not run (service unavailable / budget spent). Surfaced in the audit trail so an
  // admin knows this one wasn't AI-verified. The local checks still ran.
  unverified?: boolean;
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

// ---------------------------------------------------------------------------
// Layer 1 — normalization. Everything here is defensive: any step that throws on
// hostile input falls back to the raw text so detection never crashes (a crash
// would fail-closed and block everything).
// ---------------------------------------------------------------------------

// Zero-width, soft-hyphen, BOM and Mongolian vowel separator: invisible chars
// used to break a token apart so it slips past a plain pattern.
const ZERO_WIDTH = new RegExp("[\\u200B-\\u200D\\u2060\\uFEFF\\u00AD\\u180E]", "g");


const LEET: Record<string, string> = { "4": "a", "3": "e", "1": "i", "0": "o", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i" };

function foldBasics(s: string): string {
  try {
    return s.normalize("NFKC").replace(ZERO_WIDTH, "");
  } catch {
    return s;
  }
}

function leetFold(s: string): string {
  return s.replace(/[431057@$!]/g, (c) => LEET[c] ?? c);
}

// Remove whitespace so a token broken up with spaces/newlines is rejoined
// ("s k _ l i v e" -> "sk_live", "4111 1111 1111 1111" -> "4111111111111111").
// Only STRUCTURAL detectors (key shapes, entropy, cards) run on this variant, so
// gluing prose words together can't create keyword false positives.
function condense(s: string): string {
  return s.replace(/\s+/g, "");
}

function printableRatio(s: string): number {
  if (!s) return 0;
  let ok = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 32 && c <= 126) ok++;
  }
  return ok / s.length;
}

// Decode base64 / hex / URL-encoded blobs and return any that look like real text
// or credentials, so content smuggled through an encoding is scanned in the clear.
function decodeEmbedded(s: string): string[] {
  const out: string[] = [];
  try {
    for (const m of s.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? []) {
      if (out.length >= 12) break;
      try {
        const d = Buffer.from(m, "base64").toString("utf8");
        if (d.length >= 6 && printableRatio(d) > 0.85) out.push(d);
      } catch { /* not valid base64 */ }
    }
    for (const m of s.match(/\b[0-9a-fA-F]{16,}\b/g) ?? []) {
      if (out.length >= 20) break;
      if (m.length % 2 === 0) {
        try {
          const d = Buffer.from(m, "hex").toString("utf8");
          if (printableRatio(d) > 0.85) out.push(d);
        } catch { /* ignore */ }
      }
    }
    if (/%[0-9a-fA-F]{2}/.test(s)) {
      try { out.push(decodeURIComponent(s)); } catch { /* malformed */ }
    }
  } catch { /* ignore */ }
  return out;
}

// Build the set of strings a detector should be tested against. Capped so a huge
// paste can't blow up cost; raw regex still runs on the full text separately.
function buildVariants(text: string): { keyword: string[]; structural: string[] } {
  const capped = text.length > 50000 ? text.slice(0, 50000) : text;
  const folded = foldBasics(capped);
  const leet = leetFold(folded);
  const decoded = decodeEmbedded(folded);
  const keyword = dedupe([folded, leet, ...decoded]);
  const structural = dedupe([folded, condense(folded), leet, ...decoded.map(condense), ...decoded]);
  return { keyword, structural };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Regex detectors: a category matches if ANY of its patterns hit. `structural`
// detectors also run on the whitespace-condensed variant. Patterns are a mix of
// hard signals (an actual email, a key prefix) and topic keywords/synonyms.
// ---------------------------------------------------------------------------
type Detector = { category: Category; patterns: RegExp[]; evidence: string; structural?: boolean };

const DETECTORS: Detector[] = [
  {
    category: "secrets",
    evidence: "looks like a password, API key, or secret",
    structural: true,
    patterns: [
      // No leading \b: these prefixes are distinctive, and a de-spaced variant can
      // glue a preceding word onto the key ("issk_live_…"), which \b would miss.
      /(sk_live_|sk_test_|rk_live_|xox[baprs]-|ghp_|gho_|ghu_|ghs_|github_pat_|glpat-|AIza[0-9A-Za-z_-]{10,}|AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ya29\.|SG\.[\w-]{16,}|shpat_|shpss_|xapp-|dop_v1_|hf_[A-Za-z0-9]{16,})/,
      /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/,
      /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/, // JWT
      /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s:/@]+@/i, // scheme://user:pass@host
      /\b(pass(?:word|wd|phrase)|api[\s_-]?key|secret[\s_-]?key|access[\s_-]?token|client[\s_-]?secret|private[\s_-]?key|bearer[\s_-]?token|auth[\s_-]?token|credentials?)\b\s*[:=]/i,
      /\b(my|our|the|your) (password|passphrase|api key|secret key|access token|private key|credentials)\b/i,
    ],
  },
  {
    category: "pii",
    evidence: "contains personal data (emails, phone numbers, SSN, or card numbers)",
    patterns: [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, // email address
      /\b\d{3}-\d{2}-\d{4}\b/, // US SSN
      /\b(\+?\d[\d\s().-]{8,}\d)\b/, // phone-like number
      /\b(phone numbers?|email addresses?|home address(?:es)?|mailing address|date of birth|\bdob\b|social security|\bssn\b|passport number|driver'?s? licen[cs]e|national insurance|\bnino\b|tax id|\btin\b|\bsin\b|aadhaar|personal (information|data|details)|\bpii\b)\b/i,
    ],
  },
  {
    category: "client_data",
    evidence: "references customer or client records",
    patterns: [
      /\b(customer|client|subscriber|member|user|account) (list|lists|data|records?|roster|database|db|contacts?|details?|information|emails?|export|dump|table)\b/i,
      /\b(list of (our |all )?(customers|clients|subscribers|members|users|accounts))\b/i,
      /\b(book of business|customer base|client base|contact database|crm (export|data|dump)|mailing list)\b/i,
      /\b(client|customer) (contract|agreement|record)\b/i,
    ],
  },
  {
    category: "financial",
    evidence: "references financial or banking information",
    patterns: [
      /\b(bank account|routing number|account number|\biban\b|swift code|sort code|credit card|debit card|\bcvv\b|card on file)\b/i,
      /\b(salary|salaries|payroll|compensation|revenue|profit|margins?|financial statements?|balance sheet|income statement|cash flow|invoices?|accounts? (payable|receivable)|\bap\b|\bar\b|bank statement|wire (details|instructions))\b/i,
    ],
  },
  {
    category: "legal",
    evidence: "references a legal or contractual document",
    patterns: [
      /\b(contract|agreement|\bnda\b|non-disclosure|\bmsa\b|\bsow\b|statement of work|term sheet|letter of intent|\bloi\b|terms (?:and|&) conditions|legal (document|memo|opinion)|lawsuit|litigation|settlement|deposition|subpoena|privileged|attorney)\b/i,
    ],
  },
  {
    category: "phi",
    evidence: "references health / medical information (PHI)",
    patterns: [
      /\b(patient|diagnos(?:is|es|ed)|medical (record|history|condition)|health record|prescription|treatment (plan|history)|\bphi\b|clinical|lab results?|\bicd-?\d|mrn\b|medications?|symptoms?|physician|therapy)\b/i,
    ],
  },
  {
    category: "source_code",
    evidence: "contains or references source code",
    patterns: [
      /```/, // code fence
      /\b(source code|codebase|code base|repository|repo|proprietary code|our code|internal code)\b/i,
      /\b(vulnerabilit(?:y|ies)|security (review|audit) of (?:this|our|the) code)\b/i,
      /\b(function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+|import\s+[\w./]|from\s+\w+\s+import|#include|public\s+static|SELECT\s+.+\s+FROM|module\.exports|const\s+\w+\s*=\s*require)\b/,
    ],
  },
];

// ---------------------------------------------------------------------------
// Layer 2 — heuristic detectors (shape, not known pattern). These catch novel
// credentials and real card numbers the regex list would miss.
// ---------------------------------------------------------------------------

function shannon(s: string): number {
  const freq: Record<string, number> = {};
  for (const c of s) freq[c] = (freq[c] ?? 0) + 1;
  let h = 0;
  for (const k in freq) {
    const p = freq[k] / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

// A long, high-entropy, mixed-character token is almost certainly a credential,
// even with an unknown prefix. Conservative thresholds keep false positives low
// (a UUID or an all-lowercase word will not trip it).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function looksLikeSecretToken(tok: string): boolean {
  if (tok.length < 28 || tok.length > 512) return false;
  if (/^https?:\/\//i.test(tok)) return false;
  if (UUID_RE.test(tok)) return false; // UUIDs are identifiers, not secrets
  const classes =
    (/[a-z]/.test(tok) ? 1 : 0) +
    (/[A-Z]/.test(tok) ? 1 : 0) +
    (/[0-9]/.test(tok) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(tok) ? 1 : 0);
  return classes >= 3 && shannon(tok) >= 3.6;
}

function detectEntropySecret(strings: string[]): boolean {
  for (const s of strings) {
    for (const tok of s.split(/\s+/)) {
      if (looksLikeSecretToken(tok)) return true;
    }
  }
  return false;
}

function luhnValid(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectLuhnCard(strings: string[]): boolean {
  for (const s of strings) {
    for (const m of s.match(/\b(?:\d[ -]?){13,19}\b/g) ?? []) {
      if (luhnValid(m.replace(/[ -]/g, ""))) return true;
    }
  }
  return false;
}

// A per-category decision map. This is what the org's Policies produce: for each
// kind of restricted content, what StileAI does — approve, ask an admin, or deny.
export type CategoryRules = Partial<Record<Category, Decision>>;

// The recommended defaults, used until an admin sets their own policies.
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
export function redactSensitive(text: string, maxLen = 280): string {
  let out = text ?? "";
  for (const det of DETECTORS) {
    for (const re of det.patterns) {
      try {
        const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
        out = out.replace(new RegExp(re.source, flags), "••••");
      } catch { /* skip an un-globalizable pattern */ }
    }
  }
  // Also mask heuristic hits (high-entropy tokens and Luhn-valid card numbers),
  // which aren't expressed as a single regex above.
  out = out.replace(/\S{28,}/g, (t) => (looksLikeSecretToken(t) ? "••••" : t));
  out = out.replace(/\b(?:\d[ -]?){13,19}\b/g, (t) => (luhnValid(t.replace(/[ -]/g, "")) ? "••••" : t));
  return out.length > maxLen ? out.slice(0, maxLen) + "…" : out;
}

// The core check: detect restricted content across all normalized variants, then
// decide per the org's policy rules. Deterministic and side-effect-free. The
// strictest matching rule wins; anything found only after de-obfuscation is
// treated as an evasion attempt and never allowed silently.
export function checkPrompt(prompt: string, rules: CategoryRules = BALANCED_RULES): CheckResult {
  const text = prompt ?? "";
  const v = buildVariants(text);
  const seen = new Map<Category, CategoryHit>();

  const add = (category: Category, evidence: string, obfuscated: boolean) => {
    const prev = seen.get(category);
    if (!prev) seen.set(category, { category, label: CATEGORY_LABEL[category], evidence, obfuscated });
    else if (prev.obfuscated && !obfuscated) prev.obfuscated = false; // a clear hit outranks an obfuscated one
  };

  for (const det of DETECTORS) {
    const variants = det.structural ? v.structural : v.keyword;
    const inRaw = det.patterns.some((re) => safeTest(re, text));
    const inVariant = inRaw || det.patterns.some((re) => variants.some((s) => safeTest(re, s)));
    if (inVariant) add(det.category, det.evidence, !inRaw);
  }

  // Entropy detection needs REAL token boundaries, so it runs on the
  // whitespace-preserving variants (never the condensed one, which would glue a
  // whole sentence into one high-entropy "token"). Luhn is digit-only, so the
  // condensed variant is safe and useful (it rejoins a spaced-out card number).
  if (detectEntropySecret(v.keyword)) add("secrets", "contains a long, high-entropy token that looks like a credential", !detectEntropySecret([text]));
  if (detectLuhnCard(v.structural)) add("pii", "contains a valid payment-card number", !detectLuhnCard([text]));

  const hits = [...seen.values()];
  if (hits.length === 0) {
    return { decision: "approved", reason: "No policy-restricted content detected — safe, general AI usage.", hits: [], profile: "your policies" };
  }

  let decision: Decision = "approved";
  let driver: CategoryHit | null = null;
  for (const hit of hits) {
    let d = rules[hit.category] ?? "approved";
    // Evasion guard: if a category would normally be allowed but the content was
    // hidden (spaced-out, encoded, homoglyphs), don't silently allow it — route it
    // to a human. Someone disguising it is a signal in itself.
    if (hit.obfuscated && d === "approved") d = "admin_approval";
    if (SEVERITY[d] > SEVERITY[decision]) { decision = d; driver = hit; }
  }

  if (decision === "approved") {
    return { decision, reason: "Allowed under your current policies.", hits, profile: "your policies" };
  }

  const d = driver ?? hits[0];
  const verb = decision === "denied" ? "blocked" : "sent to an admin for approval";
  const note = d.obfuscated ? " The content appeared to be disguised, which StileAI treats as higher risk." : "";
  const reason = `This request was ${verb} because it ${d.evidence} (${d.label}), which your policies restrict.${note}`;
  return { decision, reason, hits, profile: "your policies" };
}

// Non-global .test is stateless; guard against a bad dynamic pattern just in case.
function safeTest(re: RegExp, s: string): boolean {
  try {
    return re.test(s);
  } catch {
    return false;
  }
}
