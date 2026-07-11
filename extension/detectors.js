// On-device fallback detectors. This is a condensed, dependency-free copy of the
// server's deterministic engine. It runs ONLY when StileAI's backend is unreachable,
// so the extension can keep protecting the obvious leaks (secrets, PII, PHI, code)
// on the user's own machine instead of going dark during an outage. The full engine
// (obfuscation handling, entropy tuning, the org's own policies, and the AI second
// opinion) always runs server-side when reachable; this is the safety floor.
//
// Returns { categories: string[], reason: string }. An empty list means the local
// checks found nothing; the caller decides what to do with that.
"use strict";

(function () {
  function shannon(s) {
    const f = {};
    for (const c of s) f[c] = (f[c] || 0) + 1;
    let h = 0;
    for (const k in f) {
      const p = f[k] / s.length;
      h -= p * Math.log2(p);
    }
    return h;
  }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function looksLikeSecretToken(tok) {
    if (tok.length < 28 || tok.length > 512) return false;
    if (/^https?:\/\//i.test(tok) || UUID.test(tok)) return false;
    const classes =
      (/[a-z]/.test(tok) ? 1 : 0) +
      (/[A-Z]/.test(tok) ? 1 : 0) +
      (/[0-9]/.test(tok) ? 1 : 0) +
      (/[^A-Za-z0-9]/.test(tok) ? 1 : 0);
    return classes >= 3 && shannon(tok) >= 3.6;
  }

  function luhn(digits) {
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0,
      alt = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = digits.charCodeAt(i) - 48;
      if (d < 0 || d > 9) return false;
      if (alt) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  const KEYWORD = [
    ["secrets", /\b(pass(?:word|wd|phrase)|api[\s_-]?key|secret[\s_-]?key|access[\s_-]?token|client[\s_-]?secret|private[\s_-]?key|credentials?)\b\s*[:=]/i],
    ["secrets", /(sk_live_|sk_test_|ghp_|gho_|github_pat_|glpat-|AIza[0-9A-Za-z_-]{10,}|AKIA[0-9A-Z]{16}|xox[baprs]-|shpat_|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/],
    ["secrets", /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/],
    ["pii", /\b\d{3}-\d{2}-\d{4}\b/],
    ["pii", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
    ["pii", /\b(social security|passport number|driver'?s? licen[cs]e|date of birth|\bdob\b|national insurance)\b/i],
    ["client_data", /\b(customer|client|subscriber|member|account) (list|lists|data|records?|roster|database|contacts?|export|dump)\b/i],
    ["financial", /\b(bank account|routing number|iban|swift code|sort code|\bcvv\b|salary|payroll|revenue|invoices?)\b/i],
    ["legal", /\b(contract|agreement|\bnda\b|non-disclosure|\bmsa\b|term sheet|privileged|attorney)\b/i],
    ["phi", /\b(patient|diagnos(?:is|es|ed)|medical (record|history)|prescription|\bphi\b|lab results?)\b/i],
    ["source_code", /```|\b(source code|codebase|repository|proprietary code)\b|\b(function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+|SELECT\s+.+\s+FROM)\b/i],
  ];

  function detect(prompt) {
    const t = String(prompt || "");
    const found = new Set();
    for (const [cat, re] of KEYWORD) {
      try {
        if (re.test(t)) found.add(cat);
      } catch (_) {}
    }
    // high-entropy credential
    for (const tok of t.split(/\s+/)) {
      if (looksLikeSecretToken(tok)) {
        found.add("secrets");
        break;
      }
    }
    // valid payment card
    const cards = t.match(/\b(?:\d[ -]?){13,19}\b/g) || [];
    for (const c of cards) {
      if (luhn(c.replace(/[ -]/g, ""))) {
        found.add("pii");
        break;
      }
    }
    const categories = [...found];
    return {
      categories,
      reason: categories.length
        ? "Blocked by StileAI's on-device check while the service was unreachable (detected " +
          categories.join(", ") +
          ")."
        : "",
    };
  }

  self.StileAIDetect = detect;
})();
