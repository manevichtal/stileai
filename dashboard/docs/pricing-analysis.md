# StileAI pricing analysis

Prepared for review with a financial adviser. Every number below is either sourced (competitor pricing, mid-2026) or a clearly labeled assumption you can adjust. The goal: set a price that sits below what a customer already pays for their AI tools, protects strong margins, and does not position StileAI as the "cheap" option in a security category where cheap erodes trust.

---

## 1. The core tension

The buyer already pays for AI. We are a security layer on top. So there is a felt ceiling: a customer resists paying more for the guardrail than for the tool it guards. But we also sell a security product, and in security, a suspiciously low price signals "not serious." The answer is not to be cheapest. It is to (a) price clearly below a single AI seat, and (b) reframe what we are priced against: not one $20 tool, but the customer's whole AI stack.

---

## 2. What customers already pay for AI (the anchor)

Sourced, mid-2026 business/enterprise pricing, per user per month:

| Tool | Business tier | Enterprise tier |
|---|---|---|
| ChatGPT (OpenAI) | $20-25 (Team) | $40-60 (Enterprise) |
| Claude (Anthropic) | $20-25 (Team) | Custom, negotiated |
| Microsoft 365 Copilot | $18-21 (Business) | +$30 add-on (Enterprise) |
| Google Gemini (Workspace) | $14-22 (bundled) | $21-30 (Gemini Enterprise) |
| GitHub Copilot | $19 (Business) | $39 (Enterprise) |

Two takeaways:
- A single business AI seat clusters at **$19-30/month**, enterprise at **$30-60**.
- Most real employees use **more than one** AI tool. A developer might have Copilot ($19) plus ChatGPT Team ($25). A knowledge worker might have Gemini in Workspace plus a ChatGPT seat. **Combined AI spend per employee is commonly $40-70/month.** That is the number we are actually a fraction of.

## 3. What competing AI-security tools charge (direct comps)

| Vendor | Per-user/month | Notes |
|---|---|---|
| Prompt Security | $19 (ChatGPT-only) to $39 (all AI) | Plus a $5,000/mo enterprise tier |
| Witness AI | ~$15 ($180/user/year) | 1,000-seat minimum |
| Nightfall AI | Custom / quote | Opaque |
| Harmonic, Zenity | Custom / quote | Opaque |

The market clears at roughly **$15-40 per user/month** for an AI-security overlay. Most hide pricing behind "contact sales," which buyers openly dislike. **Transparent pricing is itself a wedge for us.** Our current listed price of $25 is squarely in-market, not expensive, but it does bump against the single-tool ceiling, which is what feels off.

---

## 4. Our cost to deliver (COGS), per seat per month

This is the part that makes the pricing decision easy: our marginal cost is tiny, so margin is healthy at every option below. Components:

**a) AI second-opinion layer (the only real variable cost).** Most prompts are decided for free by our deterministic detection. Only "gray-zone" prompts escalate to Claude Haiku 4.5 (priced $1 per million input tokens, $5 per million output). One escalation is about 1,500 input + 150 output tokens = **~$0.0023 per call**. A 24-hour cache dedupes repeats.

| Usage per seat | Escalations/mo | AI cost/mo |
|---|---|---|
| Light | 15 | $0.03 |
| Typical | 30 | $0.07 |
| Heavy | 80 | $0.18 |
| Very heavy | 200 | $0.46 |

**b) Infrastructure** (Vercel + Supabase + bandwidth): mostly a fixed base (~$45/mo today) plus small per-seat usage. Marginal per-seat ~**$0.30**.

**c) Payment processing** (Stripe): ~**3% of revenue**.

**Fully loaded marginal COGS: about $0.50-1.00 per seat per month** (using ~$1.00 as a conservative planning number), plus ~3% payment fees. Everything below assumes **$1.00 COGS + 3% fees**.

**Fixed company costs today** (before salaries): Vercel Pro + Supabase Pro + Anthropic baseline + domain + email ≈ **$100-150/month**.

---

## 5. Three pricing options (with full math)

Gross margin below = (price − $1.00 COGS − 3% fee) / price.

### Option A: One simple price
- **$12/seat/month** (or **$10** billed annually). 5-seat minimum.
- Everything included, one plan.
- Gross margin: **~89%**.
- Pros: dead simple to sell. "Less than half the price of the AI seat it protects." Fast for small business self-serve.
- Cons: leaves money on the table with larger and regulated buyers; no upsell lever; one price cannot flex to willingness-to-pay.

### Option B: Three tiers (RECOMMENDED)
Anchored so most buyers land on the middle tier.

| Tier | Price/seat/mo | Who | Gross margin |
|---|---|---|---|
| **Starter** | $8 | Small teams, browser AI only (ChatGPT/Claude/Gemini), core detection, 30-day audit log, monitor mode | ~85% |
| **Team** (hero) | $15 | + approvals workflow, coding-tool gateway (Cursor/Copilot/Claude Code), unlimited audit history, policy templates | ~92% |
| **Business** | $25 | + SSO/SAML, compliance report exports (SOC 2/GDPR/HIPAA mapping), custom policies, admin roles, priority support | ~95% |

- **Annual billing = 2 months free** (pay for 10). Improves cash and retention.
- **Enterprise** (250+ seats or regulated): custom, volume discount toward **$18-20**, with options like zero-retention and SSO enforcement.
- Blended realistic ARPU: **~$14-16/seat**.
- Pros: captures three different willingness-to-pay levels; the $15 hero tier sits clearly under every business AI seat; Business tier monetizes compliance buyers without scaring off SMB; clean expansion path.
- Cons: slightly more to explain than one price.

### Option C: Platform fee + seats
- **$99/month base includes 15 seats**, then **$7/seat** beyond.
- Effective per-seat falls as they grow; predictable base revenue.
- Gross margin: ~85-90% once past ~5 active seats.
- Pros: predictable, SMB-friendly, removes per-seat friction for tiny teams.
- Cons: the base fee is a hurdle for a 3-person shop; less intuitive than per-seat for buyers comparing to their AI bills.

---

## 6. Why the middle tier is $15, not $8

The founder's instinct not to be "the cheap version" is correct and worth defending with numbers:
- **$15 is still a fraction of the stack it protects.** A typical employee's combined AI spend is $40-70/month. $15 is roughly 25% of that, for the insurance layer over all of it, on one bill. That reframes "more than the tool" into "a quarter of your total AI spend."
- **Security buyers distrust cheap.** At $8 flat we look like a toy; at $15 with a real Business tier we look like infrastructure.
- **Margin is not the constraint, positioning is.** At $8 vs $15 the gross margin difference is small (85% vs 92%) because COGS is ~$1. The real difference is perceived seriousness and revenue per customer. Underpricing does not win this category; trust does.

## 7. The value anchor (for the "is it worth it" question)

Price is trivial against the downside it removes. A single leaked API key, customer list, or source-code file can mean a breach, a lost contract, or a compliance finding. Industry breach costs run into six and seven figures. At $15/seat, a 50-person company pays **$9,000/year** to make an entire class of AI leaks not happen. That is the framing for the sales page and for justifying that we are not the cheapest.

## 8. Unit economics (illustrative, Option B, Team tier)

Assumptions the adviser can flex: $15/seat, $1 COGS, 3% fees, fixed costs $150/mo.
- **Contribution per seat:** $15 − $1.00 − $0.45 = **$13.55/month**.
- **Break-even:** $150 / $13.55 ≈ **12 paid seats** (roughly 1-2 small customers) covers current fixed costs.
- **At 50 customers × 20 seats avg:** 1,000 seats × $15 = **$15,000 MRR ($180k ARR)**, COGS ~$1,000/mo, gross margin ~90%.
- **LTV example:** 20-seat customer, 18-month average retention: 20 × $13.55 × 18 ≈ **$4,878 lifetime contribution**. Even at a $500 blended acquisition cost (kept low by SEO and self-serve), that is a strong LTV:CAC.

## 9. Recommendation

Adopt **Option B**, lead publicly with the **Team tier at $15/seat/month** (annual $12.50-equivalent), keep a **Business tier at $25** for compliance/SSO buyers, and offer **custom enterprise** above 250 seats. This:
- stays clearly under a single business AI seat ($19-30),
- is a fraction of the employee's total AI spend (the honest reframe),
- protects 90%+ gross margins,
- avoids the "cheap security tool" trap,
- and gives a built-in expansion path as customers grow and mature.

If simplicity matters more than expansion in the first 6 months, launch with **Option A ($12 flat)** and split into tiers once you have usage data on who wants compliance features.

---

## 10. Open decisions for the adviser

- Annual discount depth (2 months free is standard; could be less).
- Whether to enforce a seat minimum (5 seats keeps tiny/low-value accounts out).
- Enterprise floor price and what unlocks it (zero-retention, on-prem, custom DPA).
- Whether to meter anything (e.g., very heavy escalation users) or keep it all-you-can-use for simplicity. Given COGS, all-you-can-use is fine well past normal usage.

*Note: our public price is currently listed at $25. If we adopt Option B, update the pricing page and the structured-data price in the site metadata to match.*
