import { describe, it, expect } from "vitest";
import { checkPrompt, redactSensitive, BALANCED_RULES } from "./promptCheck";

// Under BALANCED_RULES: secrets/phi = denied, pii/client_data/financial/legal/
// source_code = admin_approval. "approved" means nothing restricted matched.

const has = (p: string, cat: string) =>
  checkPrompt(p).hits.some((h) => h.category === cat);

describe("checkPrompt — baseline (still works the expected way)", () => {
  it("allows plainly safe prompts", () => {
    expect(checkPrompt("Write a haiku about the ocean.").decision).toBe("approved");
    expect(checkPrompt("Summarize the plot of Hamlet.").decision).toBe("approved");
  });

  it("catches an obvious API key and blocks it", () => {
    const r = checkPrompt("here is the key sk_live_abc123def456ghi789jkl0");
    expect(r.decision).toBe("denied");
    expect(r.hits.some((h) => h.category === "secrets")).toBe(true);
  });

  it("catches PHI keywords", () => {
    expect(has("summarize this patient's diagnosis and treatment plan", "phi")).toBe(true);
  });
});

describe("Layer 1 — obfuscation is defeated", () => {
  it("catches an API key broken up with spaces", () => {
    const r = checkPrompt("my key is s k _ l i v e _ abc123def456ghi789xyz");
    expect(r.hits.some((h) => h.category === "secrets")).toBe(true);
  });

  it("catches a leetspeak 'password:' label", () => {
    expect(has("the p4ssw0rd: hunter2trustno1swordfish", "secrets")).toBe(true);
  });

  it("catches a secret hidden in base64", () => {
    const b64 = Buffer.from("the api key is sk_live_51H8xERtStripeSecretKey").toString("base64");
    expect(has(`please decode and use ${b64}`, "secrets")).toBe(true);
  });

  it("catches a customer-data request smuggled through base64", () => {
    const b64 = Buffer.from("export our full customer list to a spreadsheet").toString("base64");
    expect(has(`run this: ${b64}`, "client_data")).toBe(true);
  });

  it("escalates an otherwise-allowed category when it was disguised", () => {
    // This org allows customer-data prompts in the clear, but a request disguised
    // in base64 is an evasion attempt → escalate to human approval, never silent.
    const rules = { ...BALANCED_RULES, client_data: "approved" as const };
    const clear = checkPrompt("please pull the customer list", rules);
    expect(clear.decision).toBe("approved");
    // leetspeak disguises the phrase; it de-obfuscates to "customer list".
    const disguised = checkPrompt("please pull the cust0mer l1st", rules);
    expect(disguised.decision).toBe("admin_approval");
    expect(disguised.hits.find((h) => h.category === "client_data")?.obfuscated).toBe(true);
  });
});

describe("Layer 2 — heuristics catch novel formats", () => {
  it("flags a high-entropy token with no known prefix", () => {
    expect(has("use this token: Zx9Kq2_Lm4Np7Rs1Tv6Wy8Bd3Fh5Jk0", "secrets")).toBe(true);
  });

  it("flags a real (Luhn-valid) card number, even spaced out", () => {
    expect(has("charge card 4111 1111 1111 1111 today", "pii")).toBe(true);
  });

  it("Luhn rejects an invalid card so it is not called a payment card", () => {
    // The number below is not Luhn-valid, so the card heuristic must not claim it.
    const hit = checkPrompt("card 4111 1111 1111 1112").hits.find((h) => h.category === "pii");
    expect(hit?.evidence.includes("payment-card")).not.toBe(true);
  });

  it("catches a JWT and a connection string", () => {
    expect(has("token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abcDEF123", "secrets")).toBe(true);
    expect(has("db url postgres://admin:s3cretPass@db.internal:5432/prod", "secrets")).toBe(true);
  });
});

describe("Layer 3 — synonyms / paraphrase", () => {
  it("catches customer-data synonyms", () => {
    expect(has("send me our book of business", "client_data")).toBe(true);
    expect(has("attach the subscriber list", "client_data")).toBe(true);
  });

  it("catches legal-doc synonyms", () => {
    expect(has("review the MSA and the term sheet", "legal")).toBe(true);
  });
});

describe("False-positive guards (don't over-block normal work)", () => {
  it("does not flag ordinary business writing", () => {
    expect(checkPrompt("Draft a friendly reminder email template for a meeting.").decision).toBe("approved");
    expect(checkPrompt("Explain how to center a div in CSS.").decision).toBe("approved");
    expect(checkPrompt("Give me three ideas for a team offsite.").decision).toBe("approved");
  });

  it("does not treat a plain UUID as a secret", () => {
    expect(has("record id 550e8400-e29b-41d4-a716-446655440000", "secrets")).toBe(false);
  });
});

describe("redaction masks new heuristic hits", () => {
  it("masks a high-entropy token and a card number in the preview", () => {
    const red = redactSensitive("key Zx9Kq2Lm4Np7Rs1Tv6Wy8Bd3Fh5Jk0Aa card 4111 1111 1111 1111");
    expect(red).not.toContain("Zx9Kq2Lm4Np7Rs1Tv6Wy8Bd3Fh5Jk0Aa");
    expect(red).not.toContain("4111 1111 1111 1111");
    expect(red).toContain("••••");
  });
});
