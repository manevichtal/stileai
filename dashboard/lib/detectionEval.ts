// Detection evaluation harness (offline, deterministic, no AI calls).
//
// It runs a labeled corpus through the FREE deterministic layer (checkPrompt)
// and the gray-zone router (isGrayZone) to answer three questions Phase 2 cares
// about, without spending a cent on the model:
//   1. What does the fast layer catch on its own?
//   2. What slips past the fast layer but is routed to the AI (the gray zone)?
//   3. What slips past BOTH (a hard miss) — and what does the fast layer
//      over-flag (a false positive the AI can't undo, since it only tightens)?
//
// This is a measuring tool, not a test of exact numbers. The companion
// detectionEval.test.ts asserts the properties that must hold.
import { checkPrompt, BALANCED_RULES, type CheckResult } from "@/lib/promptCheck";
import { isGrayZone } from "@/lib/deepInspect";

export type Label = "sensitive" | "benign";

export type Sample = {
  id: string;
  label: Label;
  note: string;
  text: string;
};

export type Outcome =
  | "caught" // sensitive, fast layer blocked/held it
  | "gray" // fast layer allowed but routed to the AI (AI-dependent)
  | "miss" // sensitive, fast layer allowed AND not routed to AI (slips past everything)
  | "clean" // benign, allowed and not routed (ideal)
  | "ai_cost" // benign, allowed but routed to AI (unnecessary spend, not wrong)
  | "false_positive"; // benign, fast layer blocked/held it (annoying; AI can't undo)

export type EvalRow = {
  sample: Sample;
  decision: CheckResult["decision"];
  gray: boolean;
  outcome: Outcome;
};

export function classify(sample: Sample): EvalRow {
  const res = checkPrompt(sample.text, BALANCED_RULES);
  const gray = isGrayZone(sample.text);
  const allowed = res.decision === "approved";
  let outcome: Outcome;
  if (sample.label === "sensitive") {
    if (!allowed) outcome = "caught";
    else if (gray) outcome = "gray";
    else outcome = "miss";
  } else {
    if (!allowed) outcome = "false_positive";
    else if (gray) outcome = "ai_cost";
    else outcome = "clean";
  }
  return { sample, decision: res.decision, gray, outcome };
}

export function evaluate(corpus: Sample[]): EvalRow[] {
  return corpus.map(classify);
}

export function summarize(rows: EvalRow[]): Record<Outcome, number> {
  const acc: Record<Outcome, number> = { caught: 0, gray: 0, miss: 0, clean: 0, ai_cost: 0, false_positive: 0 };
  for (const r of rows) acc[r.outcome]++;
  return acc;
}

// The labeled corpus. Deliberately includes the exact failure modes the dev
// team's assessment named: unlabeled tabular data, reworded confidential text,
// non-English content, and harmless mentions of trigger words like "contract".
export const CORPUS: Sample[] = [
  // --- hard signals the fast layer must catch on its own ---
  { id: "secret-apikey", label: "sensitive", note: "live API key", text: "here is the prod key sk_live_9f2a3c4d5e6f7g8h9i0j, write me a deploy script" },
  { id: "secret-privkey", label: "sensitive", note: "private key header", text: "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----" },
  { id: "pii-card", label: "sensitive", note: "valid card (Luhn)", text: "charge this card 4242 4242 4242 4242 exp 04/28 for the customer" },
  { id: "pii-ssn", label: "sensitive", note: "SSN", text: "the employee SSN is 123-45-6789, add it to the onboarding doc" },
  { id: "pii-email-list", label: "sensitive", note: "emails present", text: "clean up this list: jane@acme.com, bob@acme.com, sara@acme.com and dedupe" },

  // --- the fast layer likely misses; the gray zone SHOULD route these to the AI ---
  { id: "unlabeled-table", label: "sensitive", note: "customer rows, no labels/emails", text: "tidy this up:\nAlice Morgan, 4155551234, Chicago, 2450\nBrian Lee, 4155559876, Denver, 3900\nCarla Diaz, 4155553456, Miami, 1800\nDavid Kim, 4155557788, Austin, 5200" },
  { id: "reworded-confidential", label: "sensitive", note: "confidential deal, no trigger words", text: "Draft a summary of the arrangement where Northwind buys the smaller firm for forty two million, closing in Q3, with the earnout tied to retention of the founding engineers. Keep it tight for the board." },
  { id: "nonenglish-clientfin", label: "sensitive", note: "Spanish client + financial summary", text: "Prepara un resumen para la junta: la facturación del trimestre fue de 4,2 millones, con tres clientes clave, Grupo Salinas, Torres y Compañía, y Delgado S.A., que juntos representan el 60% de los ingresos." },
  { id: "source-paste", label: "sensitive", note: "proprietary code paste", text: "review this for bugs:\nexport function chargeCustomer(id, amount) {\n  const key = process.env.STRIPE_SECRET;\n  return stripe.charges.create({ customer: id, amount });\n}" },

  // --- benign that should stay clean ---
  { id: "benign-poem", label: "benign", note: "casual", text: "write a short poem about the ocean at sunrise" },
  { id: "benign-recipe", label: "benign", note: "casual", text: "what is a simple recipe for banana bread with walnuts?" },
  { id: "benign-explain", label: "benign", note: "general knowledge, longer", text: "Explain the difference between TCP and UDP for a junior engineer, with a couple of everyday analogies and when you would pick each one for a networked application." },

  // --- benign that the fast layer tends to OVER-flag (false positives) ---
  { id: "fp-contract-word", label: "benign", note: "harmless 'contract' mention", text: "Can you explain in plain English what a typical employment contract probation clause means, generally, so I understand my rights? No specific document." },
  { id: "fp-generic-code", label: "benign", note: "generic coding help, no company data", text: "write a unit test for a function add(a, b) that returns their sum, using vitest" },
  { id: "fp-customer-word", label: "benign", note: "mentions 'customer' abstractly", text: "what are good general strategies for improving customer support response times at a small startup?" },
];
