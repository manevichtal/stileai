# StileAI Phase 2 — Meaning-based AI detection

Plain-language plan for the second phase of the detection layer. Written so a
non-engineer can follow it and an engineer can build from it.

---

## 1. What Phase 2 is, in one paragraph

Today StileAI catches sensitive data with fast rules (known key formats, card
numbers, keywords). Rules are instant and private, but they miss things that
are not written the "expected" way (an unlabeled customer table, a confidential
document with no trigger words, another language) and they over-flag things
(every email, the word "contract"). Phase 2 adds a second step: when the fast
rules are **unsure**, a small, fast AI reads the message for **meaning** and
decides whether it really contains sensitive data. This is what makes the
"AI-powered" claim true, and it cuts both misses and false alarms.

---

## 2. The important part: this engine already exists

Most of Phase 2 is already built and wired into the product
(`dashboard/lib/deepInspect.ts`). Here is exactly how it works today.

**The flow, step by step:**
1. Every message first goes through the fast local rules (Phase 1). If those
   clearly **block** or **hold** it, we are done. Instant. No AI is called.
2. If the rules **allow** it **but the message still looks risky** (the
   "gray zone"), and only then, we send that one message to a small fast AI
   (Claude Haiku) with a single question: *which sensitive categories does this
   contain?*
3. The AI answers with a list of categories (secrets, PII, client data,
   financial, legal, health, source code). We then apply **that company's own
   policy rules** to the answer to get allow / hold / block.
4. The result can only ever get **stricter**, never looser.

**Safety guarantees already coded in:**
- **Never fails open.** Any error, timeout, missing key, or spent budget returns
  the fast layer's original decision. The AI can only tighten, never loosen.
- **Strict per-company isolation.** The cache is keyed by a company-salted hash,
  so one company's cached answer can never be reused for another. Budgets and
  rules are per company.
- **Cost is bounded.** The AI runs only on the gray-zone slice, answers are
  cached for 24 hours, and each company has a monthly cap.
- **The message is treated as untrusted.** The AI is instructed to classify the
  text, never to obey instructions hidden inside it (prompt-injection defense).

**Current settings (the "dials"):**
| Dial | Current value | What it controls |
|---|---|---|
| Model | Claude Haiku | The small, fast classifier |
| Gray-zone trigger | length, CSV/JSON shape, sensitive words, lots of digits, many names | Which allowed messages get the AI check |
| Monthly budget | 50,000 AI checks per company | Cost ceiling per company |
| Cache | 24 hours | Avoid re-checking identical text |
| Timeout | 6 seconds | Then falls back per company setting |
| Fallback mode | availability / hold / flag | What to do when the AI can't run |

**What "enabled" means:** the engine only turns on when an `ANTHROPIC_API_KEY`
is set on the server. Without it, every request just uses the fast layer.

So Phase 2 is **not** "build the AI." It is: turn it on safely, add the one
missing piece (feedback), tune it, and prove it out.

---

## 3. What is genuinely left to do

### A. Turn it on safely (needs you + me)
- **You:** put a zero-data-retention (ZDR) agreement in place with the model
  provider (Anthropic offers this). This is what lets us honestly say "your
  message content is not retained by the AI."
- **Me:** set the server key, and write a short **trust page** stating what the
  AI step does, that it runs under ZDR, and that clearly-safe and
  clearly-blocked messages never reach it.

### B. Build the feedback loop (the one missing piece, me)
When StileAI blocks or holds something it should not have, a person should be
able to flag it in one click. Today there is no way to do that. This matters for
two reasons: it lets admins correct mistakes, and the flagged examples become
the training data for Phase 3 (your own in-house model).
- New database table `feedback` (per company, content redacted).
- New API route to record a report.
- A "report this" action on a blocked/held message (in the extension banner
  and/or the dashboard audit row).
- A simple review list in the dashboard.

### C. Tune the gray zone and build a test set (me)
Before leaning on "AI-powered" in marketing, we tune the dial that decides which
messages get the AI check, and we measure it.
- Build a labeled test set of realistic examples: an unlabeled customer table, a
  reworded confidential doc, a non-English secret, and harmless messages that
  merely mention "contract" or an email address.
- Measure misses and false alarms, adjust the gray-zone triggers, repeat.

### D. Confirm speed and cost (me)
- Verify the added delay is imperceptible when a message is sent (the design
  already short-circuits the common cases; we confirm it with real timing).
- Set the monthly budget number to a value you are comfortable with and confirm
  the cap behaves.

### E. Align the marketing (me)
Once A to D are done, the "AI-powered" claim is fully supportable. Update the
landing page and social copy to match what is shipped.

---

## 4. Decisions only you can make

1. **Zero-data-retention:** do we sign the ZDR agreement with the provider? (We
   should, before turning the wording on.)
2. **Monthly AI budget per company:** the default is 50,000 checks. Comfortable,
   higher, or lower?
3. **Where the "report a wrong block" button lives:** extension, dashboard, or
   both. (Recommend both.)
4. **Default fallback mode:** when the AI cannot run, should the default be
   *availability* (allow, since the fast layer already cleared it), *hold*
   (block until a human checks), or *flag* (allow but mark as unverified)?
   Recommend *availability* as default, with *hold* offered to strict customers.

---

## 5. Build order (sequenced)

1. **Turn it on safely** — ZDR agreement (you) + server key + trust page (me).
2. **Feedback loop** — table, API, extension + dashboard button, review list (me).
3. **Tune + test** — labeled test set, measure, adjust the gray zone (me).
4. **Speed + cost** — latency check, set the budget, confirm the cap (me).
5. **Align marketing** — update landing + social to match (me).

Steps 2 through 5 I can implement, test, and push. Step 1 needs your ZDR
decision before the "nothing is retained" wording goes live; the engine itself
can run before that under the provider's standard terms if you choose.

---

## 6. What "done" looks like (success criteria)

1. A reworded or unlabeled piece of sensitive data that the fast rules miss is
   correctly caught by the AI step, in a test we can repeat.
2. A harmless message that only mentions a trigger word (like "contract") is no
   longer needlessly held.
3. The added delay is not noticeable when sending a message.
4. Every AI check is logged (redacted) and stays within the company's budget.
5. A wrong block can be reported in one click, and the report is stored and
   reviewable.
6. With the AI step unreachable, the product still decides safely (never fails
   open) per the company's fallback mode.
7. The public "AI-powered" claim matches what actually ships.
