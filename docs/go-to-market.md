# StileAI — Go-to-Market v1

_Owner: COO/CMO. Living doc. Written for a solo founder — every line is meant to be
acted on, not admired._

## 0. The honest one-liner

> **StileAI is the policy checkpoint between your team and the AI they use.** It
> watches what employees send to ChatGPT, Claude, Gemini, and AI coding tools, and
> stops secrets, customer data, and regulated information from leaking — with an
> audit trail you can hand to an auditor. Live in minutes, no infrastructure.

What makes this true *today* (and keeps churn low):
- **Browser extension** → governs ChatGPT / Claude / Gemini on the web (how office staff use AI).
- **API gateway** → governs Cursor, Claude Code, the OpenAI/Anthropic API (how engineers use AI).
- Both feed **one dashboard, one audit log, one policy engine.**

Do **not** promise coverage of the ChatGPT desktop app or GitHub Copilot yet — say
"on the roadmap." Overpromising is our #1 churn risk.

## 1. The problem we sell against

69% of organizations already have employees using unsanctioned public AI tools. The
#1 accidental-leak path is people pasting the sensitive thing — a customer list, a
contract, a patient note, an API key, proprietary code — into a chat box to "just
get help." Traditional DLP can't see it (it's HTTPS browser traffic). The buyer's
fear: *"I have no idea what my team is putting into AI, and I can't prove to a client
or auditor that we're not leaking their data."*

## 2. Who we sell to first (ICP)

**Primary beachhead — regulated small/mid businesses (20–200 staff) with compliance
pressure but no security team.** Rank order to attack:

1. **Digital health / healthtech (HIPAA).** Acute pain, clear regulation, they must
   prove data handling to land hospital/enterprise deals. AI adoption is aggressive.
2. **Fintech / accounting / bookkeeping firms (SOC2, financial data).**
3. **Legal / professional services (client confidentiality, privilege).**
4. **MSPs / IT providers** — *channel, not first customer.* One MSP resells to a book
   of SMBs (multi-tenant is already built). Pursue after we have 2–3 logos + a case study.

**The buyer:** owner / COO / Head of Ops / "the person who owns compliance" at a
20–200-person regulated firm. Often not deeply technical → the browser extension +
"5-minute setup" is the wedge. In software-heavy orgs, the CTO/eng lead co-signs.

**The trigger event (why now):** just adopted AI, a client sent a security
questionnaire, prepping for SOC2/HIPAA, a near-miss leak, or a new AI-usage policy
with no way to enforce it.

## 3. Where to find them (lead sources)

- **LinkedIn Sales Nav** filters: industry (Hospital & Health Care / Financial
  Services / Legal), headcount 11–200, titles (COO, Head of Ops, Compliance, CTO).
- **Vertical directories:** Rock Health portfolio, YC healthtech/fintech, digital-health
  accelerators, state bar tech directories, r/msp and MSP communities.
- **Signal scraping:** companies posting AI-usage-policy templates, hiring "AI" roles,
  or with a Trust/Security page but no AI mention.
- **Warm:** anyone in the founder's network in health/finance/legal → 5 intros beats 500 cold.

## 4. Offer & pricing

- Public pricing stays: **Starter $25/seat (min 5), Business $59/seat.** In market
  range ($8–71/user among peers) — fine.
- **Design-partner offer (first 10 logos):** 60–90 days free, white-glove setup, a
  direct line to the founder, in exchange for (a) a 30-min feedback call, (b) a
  logo/testimonial if they're happy. This buys proof, which buys everyone else.
- **The demo that closes:** live-block a fake secret/patient record in ChatGPT via
  the extension, then show the blocked attempt appear in the audit log. 90 seconds.

## 5. Outreach engine (the actual work)

**Volume target for a solo founder:** 15–25 personalized touches/day, 5 days/week.
Track in a simple sheet: Company · Contact · Channel · Sent · Reply · Stage.

### Cold email — 3-touch sequence

**Touch 1 (day 0):**
> Subject: what your team is pasting into ChatGPT
>
> Hi {First} — quick one. Most {healthtech/finance/legal} teams now have staff using
> ChatGPT and Claude daily, and there's usually no record of what customer data or
> credentials go in. If a client or auditor asked you to prove nothing sensitive
> leaks into AI, could you?
>
> StileAI sits between your team and those AI tools and blocks the risky stuff before
> it leaves — with an audit log. Installs in about 5 minutes, no IT project.
>
> Worth a 15-min look? I'll show it blocking a live leak in ChatGPT.
> — {Founder}

**Touch 2 (day 3):** one-line proof + a 90-sec Loom of the block-in-ChatGPT demo.
**Touch 3 (day 7):** the "breakup" — "Should I close this out, or is AI governance
just not a priority this quarter?" (this one gets the most replies).

### LinkedIn DM (after a connect)
> Hi {First} — I built StileAI: it stops staff leaking client data / PHI / secrets
> into ChatGPT & Claude, with an audit trail for compliance. Given you're in
> {vertical}, thought it might be relevant. Open to a quick demo? No pitch if it's not a fit.

## 6. Content / inbound (compounding, secondary)

The blog exists — point it at the ICP. High-intent pieces to write next:
- "The HIPAA guide to employees using ChatGPT" (+ fintech/legal variants)
- "Free AI-usage policy template" → gated by email → nurture
- "Can your DLP see what's pasted into ChatGPT? (No — here's why)"
Repurpose each into 3–5 LinkedIn posts from the founder's profile.

## 7. Two-week launch plan

| Day | Action |
|-----|--------|
| 1 | Confirm live stack works end-to-end (see checklist below). Fix anything broken. |
| 2 | Record the 90-sec "block a leak in ChatGPT" demo (extension). This is the whole pitch. |
| 3 | Build a 50-company target list (vertical #1) in a sheet. |
| 4 | Write/publish the design-partner landing section + policy-template lead magnet. |
| 5–10 | 15–25 outreach touches/day. Book demos. |
| 10–14 | Run demos, sign 2–3 design partners, collect the first testimonial. |

**Success by day 14:** 3+ design partners live on the extension, 1 quote we can put
on the site. That's the unlock for the MSP channel and paid conversion.

## 8. Metrics that matter (weekly)

Touches → replies (aim 10–20%) → demos booked → design partners live → testimonials
→ paid conversions. Everything upstream of "design partners live" is just activity.

## 9. Blocking dependency — confirm the live stack (COO checklist)

Nothing above works if the product isn't actually live. Verify in the browser:
1. `https://stileai.vercel.app` loads the landing page.
2. Sign-up works and lands you in Stripe Checkout (test card `4242 4242 4242 4242`).
3. After paying you reach the dashboard unlocked.
4. Supabase migrations are all applied (`migration_billing.sql`, checkpoint URL, etc.).
5. Stripe webhook is registered → `STRIPE_WEBHOOK_SECRET` + price IDs set in Vercel.
6. Create a key, load the extension, block a fake secret in ChatGPT, see it in the audit log.

If any step fails, that's priority #1 before a single outreach email goes out.
