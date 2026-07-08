# StileAI Monetization — Design Spec

**Date:** 2026-07-07
**Sub-project:** 1 of 2 (Monetization). Sub-project 2 = Locked-app coverage (browser extension + network proxy) is **out of scope here** and gets its own spec.
**Status:** Approved design — ready for implementation planning.

---

## Goal

Turn StileAI from an open dashboard into a paid, plan-gated SaaS: no account exists without an active paid subscription, billing is **per seat per month** via Stripe, and each employee has their own identity so seats can be counted and enforced.

## Approach (3 sentences)

Add a per-employee **identity layer** (each employee gets their own StileAI key; a seat = one active employee) so the proxy knows *who* is making each request and can enforce a seat limit. Gate signup behind **Stripe Checkout** — the org is created in an `incomplete` state and only unlocks when a webhook confirms payment. Manage everything (plan, seat quantity, card, cancel) through Stripe, surfaced in an in-app **Billing** page and enforced by middleware.

## Tech stack

Next.js 16 App Router · Supabase (Postgres + RLS, service-role admin client) · **Stripe** (Checkout, Customer Portal, Webhooks, subscription mode with per-seat `quantity`) · Tailwind (existing tokens).

---

## Global Constraints

- **Isolation:** StileAI only — its own Vercel, Supabase (`paoppumyqodrlkamaxkd`), GitHub (`manevichtal/stileai`), and Stripe account. Never mix with NXSCRM or any other project.
- **No free plan.** Every org must have an active subscription to use the app.
- **Data minimization holds:** never store restricted prompt content (existing behavior in `lib/aiGate.ts`) — unchanged by this work.
- **Fail closed on billing:** if subscription status is unknown or lapsed, lock the app (except platform admin).
- **Fail safe on seats:** an employee over the seat limit is blocked; already-seated employees are never affected.
- Currency USD. Prices are config + Stripe — changeable without code edits to logic.

---

## Plans (launch config)

| Plan | Price (per seat / mo) | Min seats | Key limits / features |
|------|----------------------|-----------|-----------------------|
| **Starter** | $25 | 5 | Core policy packs · 30-day audit retention · email support |
| **Business** | $59 | 1 | All policy packs + approvals workflow · per-employee audit · 1-year retention · priority support |
| **Enterprise** | Custom (contact sales) | Negotiated | Custom policies · SSO · DPA · self-host · Copilot/ChatGPT coverage · SLA |

- Monthly only at launch. Annual (~20% off) is a later add (a second Stripe price per plan).
- Enterprise is **not** self-serve: its CTA is "Contact sales" (`mailto:`), no Checkout.

---

## Prerequisites the user must provide (manual, one-time)

These block the build's final wiring; the code can be written and unit-tested without them, but go-live needs them:

1. **Stripe account** (live + test mode).
2. Two **Products** with recurring monthly **Prices**: Starter ($25) and Business ($59). Copy their **price IDs**.
3. **API keys**: `STRIPE_SECRET_KEY` (test + live).
4. A **webhook endpoint** pointed at `https://stileai.vercel.app/api/stripe/webhook`; copy its **signing secret** → `STRIPE_WEBHOOK_SECRET`.
5. Enable the **Customer Portal** in Stripe (allow: update quantity, swap plan, update card, cancel).

Env vars (Vercel, StileAI project only):
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`.

---

## Data model changes

### `organizations` — add billing columns
- `stripe_customer_id text`
- `stripe_subscription_id text`
- `plan text` — `'starter' | 'business' | 'enterprise'` (null until chosen)
- `plan_seats int default 0` — the paid quantity (mirrors Stripe subscription quantity)
- `subscription_status text default 'incomplete'` — `'incomplete' | 'active' | 'past_due' | 'canceled'`
- `current_period_end timestamptz`

### `employees` — new table (the seat + identity unit)
- `id uuid pk`
- `org_id uuid` → organizations
- `label text` — display name or email of the employee
- `key_hash text unique` — hash of that employee's personal StileAI key (same `hashApiKey` scheme)
- `key_prefix text` — first chars for display (e.g. `sk_live_5f29…`)
- `status text default 'active'` — `'active' | 'disabled'`
- `created_at timestamptz`
- `last_used_at timestamptz`
- RLS: org members read their org's rows; only admins write. Service role (proxy) bypasses via admin client.

> **Seat accounting:** a seat is consumed by each `status='active'` employee. `active_count` must be ≤ `plan_seats`. The admin key in `api_keys` remains for testing/legacy and is **exempt** from seat counting.

---

## Components / files

### A. Identity + seat management
- **`lib/employees.ts`** (new) — `createEmployee`, `disableEmployee`, `listEmployees`, `activeSeatCount(orgId)`, `resolveEmployeeByKey(rawKey)`.
- **`app/(app)/team/page.tsx`** (new) — "Team & seats" page: list employees, seats used/paid, "Add employee" (generates a personal key, shown once), disable. Blocks activating beyond `plan_seats` with an "Add seats" prompt that deep-links to the Stripe portal.
- **Nav:** add `{ href: "/team", label: "Team & seats", icon: "tenants" }` to `AppShell.tsx`.

### B. Proxy enforcement (extend, don't rebuild)
- **`lib/aiGate.ts`** — `orgForKey` becomes `resolveCaller(rawKey)` returning `{ orgId, employeeId | null, seated: boolean }`:
  - Look up the key in `employees` first → employee caller; check the org's subscription is active AND this employee is within the seated set → `seated`.
  - Else fall back to `api_keys` (admin/legacy) → org caller, `employeeId = null`, exempt from seat cap.
  - If org subscription not active → treat as blocked (billing lapse).
- **`gate(...)`** records `employee_id` on the audit row (per-employee audit — a Business/Enterprise feature).
- **Both proxy routes** (`/v1/chat/completions`, `/v1/messages`): when the caller is not `seated` (over-limit employee) or the org's subscription is inactive, return the existing block message shape with reason `"No active seat — ask your admin."` / `"Your company's StileAI subscription is inactive."`

### C. Stripe integration
- **`lib/stripe.ts`** (new) — Stripe client + `PLANS` config (id, label, priceEnvVar, perSeat, minSeats, features).
- **`app/api/stripe/checkout/route.ts`** (new) — creates a Checkout Session (subscription mode, `quantity = seats`, `client_reference_id = orgId`) → returns the URL.
- **`app/api/stripe/portal/route.ts`** (new) — creates a Customer Portal session for the org's `stripe_customer_id`.
- **`app/api/stripe/webhook/route.ts`** (new, raw body + signature verify) — handles:
  - `checkout.session.completed` → set `stripe_customer_id`, `stripe_subscription_id`, `plan`, `plan_seats`, `subscription_status='active'`, `current_period_end`.
  - `customer.subscription.updated` → sync `plan_seats` (quantity), `subscription_status`, `current_period_end`, `plan`.
  - `customer.subscription.deleted` → `subscription_status='canceled'`.

### D. Plan-gated signup
- **`app/login/actions.ts`** — `signUpAction` now creates the org with `subscription_status='incomplete'` (no policy access yet), then the client is redirected to Checkout (via `/api/stripe/checkout`). Rollback semantics unchanged.
- **`app/login/page.tsx`** — signup step adds **plan + seat count** selection before creating the account; after `signUpAction` ok, redirect to Checkout URL. Enterprise choice routes to `mailto:` instead.
- **Post-payment:** Stripe redirects to `/dashboard`; middleware allows it only once webhook flips status to `active` (brief "finishing setup…" state if the webhook is still in flight — poll status).

### E. Access gate
- **`middleware.ts` / `lib/getProfile.ts`** — add `subscriptionActive` to `ProfileContext`. `requireProfileContext` redirects to a **`/billing/inactive`** screen (new, minimal) when status ∉ {`active`}. Platform admin is exempt. `/login`, Stripe routes, and the inactive screen are always reachable.

### F. Billing page
- **`app/(app)/settings/`** — add a **Billing** section (or `app/(app)/billing/page.tsx`): shows plan, `seats used / paid`, status, next renewal, and a **"Manage billing"** button → `/api/stripe/portal`. Upgrade/downgrade and seat changes happen in the portal; the webhook syncs them back.

---

## Data flow

**Signup → active:**
`Signup form (org, email, password, plan, seats)` → `signUpAction` creates org `incomplete` + admin profile → `POST /api/stripe/checkout` → Stripe Checkout (card) → `checkout.session.completed` webhook → org `active`, `plan_seats` set → admin lands on dashboard, unlocked.

**Employee request → decision:**
`Employee tool (personal key) → proxy` → `resolveCaller(key)` → if org active **and** employee seated → run `gate()` → policy decision (approve/deny/admin) → forward or block; audit row carries `employee_id`. If not seated / org inactive → block with reason, no forward.

**Seat change:** admin opens portal → changes quantity/plan → `customer.subscription.updated` webhook → `plan_seats` synced → newly-allowed employees can be activated.

## Error handling

- **Webhook signature invalid** → 400, no state change.
- **Checkout abandoned** → org stays `incomplete` and locked; a later cleanup job (out of scope) can purge stale incompletes.
- **Payment fails later (`past_due`)** → app locked to the inactive screen with "update payment" → portal; proxy blocks with the inactive reason (fail closed).
- **Webhook race** (user hits dashboard before webhook lands) → inactive screen polls status for a few seconds before giving up.
- **Employee key unknown** → proxy 401 (existing behavior).

## Testing

- **Unit:** `resolveCaller` (employee vs admin vs unknown; seated vs over-limit; active vs inactive org). `activeSeatCount` respects `disabled`. `PLANS`/price resolution. Webhook handlers map each event to the right column updates (mock Stripe events).
- **Integration:** signup creates `incomplete` org; simulated `checkout.session.completed` flips to `active`; over-limit employee is blocked at the proxy while seated employees pass; `subscription.deleted` locks the app.
- **Manual (test mode):** full signup → Stripe test card → dashboard unlock → add employee → point a tool at the personal key → see per-employee audit → portal seat change reflected.

## Out of scope (later)

Annual billing · usage-based overage · dunning emails · self-serve Enterprise · SSO · the entire **locked-app coverage** sub-project (Copilot/ChatGPT via extension + network proxy).
