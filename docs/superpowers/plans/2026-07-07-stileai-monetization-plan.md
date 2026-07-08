# StileAI Monetization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make StileAI a paid, plan-gated SaaS: no account without an active per-seat subscription (Stripe), each employee has their own identity so seats are counted and enforced, and over-seat employees are hard-blocked at the proxy.

**Architecture:** Add a per-employee identity layer (`employees` table; a seat = one active employee). Gate signup behind Stripe Checkout — the org is created `incomplete` and unlocks only when a webhook confirms payment. Manage plan/seats/card via Stripe, enforced by an app-wide access gate. The proxy resolves the caller from their key and blocks if the org is inactive or the employee is over the seat limit.

**Tech Stack:** Next.js 16 App Router · Supabase (Postgres + RLS, service-role admin client) · Stripe (Checkout, Customer Portal, Webhooks, subscription mode with per-seat `quantity`) · Vitest (added for pure billing/enforcement logic) · Tailwind.

## Global Constraints

- **Isolation:** StileAI only — its own Vercel, Supabase (`paoppumyqodrlkamaxkd`), GitHub (`manevichtal/stileai`), Stripe account. Never mix with any other project.
- **No free plan.** Every org must have `subscription_status='active'` to use the app or the proxy.
- **Fail closed on billing; fail safe on seats.** Unknown/lapsed subscription → app + proxy locked (platform admin exempt). Over-seat employee → that employee blocked; already-seated employees unaffected.
- **Data minimization holds** — never store restricted prompt content (existing `lib/aiGate.ts` behavior).
- **Plans:** Starter $25/seat (min 5) · Business $59/seat (min 1) · Enterprise custom (contact sales, no Checkout). Monthly only. USD.
- **Migrations** are plain SQL files in `supabase/`, applied manually by the user (as with `migration_rls_hardening.sql`). **Deploy** is `git push origin main` (Vercel auto-deploys).
- Reuse existing helpers: `lib/apiKeys.ts` (`hashApiKey`, key generation), `lib/supabase/admin.ts` (`createAdminClient`), `lib/getProfile.ts`.

---

## Prerequisites (USER action — one-time, blocks go-live only)

The code can be built and unit-tested without these; the live flow needs them. Document, then wait for the user to supply:

1. Stripe account (test + live).
2. Two Products with recurring **monthly** Prices: Starter ($25), Business ($59). Copy the two **price IDs**.
3. `STRIPE_SECRET_KEY` (test + live).
4. Webhook endpoint → `https://stileai.vercel.app/api/stripe/webhook`; copy the **signing secret** → `STRIPE_WEBHOOK_SECRET`.
5. Enable the **Customer Portal** (allow: update quantity, swap plan, update card, cancel).

Vercel env vars (StileAI project only): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_BUSINESS`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migration_billing.sql` (new) | Billing columns on `organizations`; `employees` table; RLS; indexes. |
| `lib/stripe.ts` (new) | Stripe client + `PLANS` config + `priceIdForPlan`/`planForPriceId` (pure). |
| `lib/billingSync.ts` (new) | Pure `billingFromSubscription(sub)` → column values. Unit-tested. |
| `lib/seats.ts` (new) | Pure `seatedIds(active, planSeats)` + `callerDecision(...)`. Unit-tested. |
| `lib/employees.ts` (new) | DB ops: create/disable/list employees, `activeSeatCount`, `resolveEmployeeByKey`. |
| `lib/aiGate.ts` (modify) | `resolveCaller(rawKey)`; record `employee_id`; block inactive/over-seat. |
| `app/api/proxy/[key]/v1/messages/route.ts` + `.../chat/completions/route.ts` (modify) | Use `resolveCaller`; block when not allowed. |
| `app/api/stripe/checkout/route.ts` (new) | Create Checkout Session. |
| `app/api/stripe/portal/route.ts` (new) | Create Customer Portal session. |
| `app/api/stripe/webhook/route.ts` (new) | Verify signature; sync subscription → org. |
| `app/login/actions.ts` (modify) | `signUpAction` creates org `incomplete`; returns `orgId`. |
| `app/login/page.tsx` (modify) | Signup step adds plan + seats; after signup → Checkout redirect. |
| `lib/getProfile.ts` (modify) | Add `subscriptionActive`; gate to `/billing/inactive`. |
| `app/(app)/billing/inactive/page.tsx` (new) | "Finish setup / update payment" screen; polls status. |
| `app/(app)/billing/page.tsx` (new) | Plan, seats used/paid, status, "Manage billing" → portal. |
| `app/(app)/team/page.tsx` (new) | Employees/seats management; add-key; disable; seat-limit block. |
| `components/AppShell.tsx` (modify) | Add "Team & seats" and "Billing" nav entries. |
| `public/landing.html` (modify) | "Log in" area → also "Get started" (→ signup); fix "no workspace yet?" copy. |
| `vitest.config.ts` + `package.json` (modify) | Add vitest + `"test"` script for pure-logic tasks. |

---

## Task 1: Add Stripe SDK, Vitest, and the plans config

**Files:**
- Modify: `dashboard/package.json` (deps + `test` script)
- Create: `dashboard/vitest.config.ts`
- Create: `dashboard/lib/stripe.ts`
- Test: `dashboard/lib/stripe.test.ts`

**Interfaces:**
- Produces: `stripe` (Stripe client), `PLANS`, `type PlanId = "starter"|"business"|"enterprise"`, `priceIdForPlan(plan): string|null`, `planForPriceId(priceId): PlanId|null`.

- [ ] **Step 1: Install deps**
```bash
cd dashboard && NODE_OPTIONS=--use-system-ca npm i stripe && NODE_OPTIONS=--use-system-ca npm i -D vitest
```

- [ ] **Step 2: Add test script to package.json**
```json
"scripts": { "dev": "next dev", "build": "next build", "start": "next start", "test": "vitest run" }
```

- [ ] **Step 3: vitest.config.ts**
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["lib/**/*.test.ts"] } });
```

- [ ] **Step 4: Write the failing test** `lib/stripe.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { PLANS, priceIdForPlan, planForPriceId } from "./stripe";

beforeEach(() => { process.env.STRIPE_PRICE_STARTER = "price_S"; process.env.STRIPE_PRICE_BUSINESS = "price_B"; });

describe("plans", () => {
  it("has per-seat pricing", () => {
    expect(PLANS.starter.perSeat).toBe(25);
    expect(PLANS.business.perSeat).toBe(59);
    expect(PLANS.enterprise.perSeat).toBeNull();
  });
  it("maps plan -> price id and back", () => {
    expect(priceIdForPlan("starter")).toBe("price_S");
    expect(planForPriceId("price_B")).toBe("business");
    expect(planForPriceId("price_unknown")).toBeNull();
    expect(priceIdForPlan("enterprise")).toBeNull();
  });
});
```

- [ ] **Step 5: Run — expect FAIL** (`cannot find module ./stripe`)
```bash
NODE_OPTIONS=--use-system-ca npm test
```

- [ ] **Step 6: Implement `lib/stripe.ts`**
```ts
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");

export type PlanId = "starter" | "business" | "enterprise";

export const PLANS: Record<PlanId, { id: PlanId; label: string; perSeat: number | null; minSeats: number | null; priceEnv: string | null }> = {
  starter:    { id: "starter",    label: "Starter",    perSeat: 25,   minSeats: 5, priceEnv: "STRIPE_PRICE_STARTER" },
  business:   { id: "business",   label: "Business",   perSeat: 59,   minSeats: 1, priceEnv: "STRIPE_PRICE_BUSINESS" },
  enterprise: { id: "enterprise", label: "Enterprise", perSeat: null, minSeats: null, priceEnv: null },
};

export function priceIdForPlan(plan: PlanId): string | null {
  const p = PLANS[plan];
  return p.priceEnv ? (process.env[p.priceEnv] ?? null) : null;
}

export function planForPriceId(priceId: string): PlanId | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return null;
}
```

- [ ] **Step 7: Run — expect PASS**; **commit** `feat(billing): stripe client + plans config`

---

## Task 2: Database migration — billing columns + employees table

**Files:**
- Create: `supabase/migration_billing.sql`

**Interfaces:**
- Produces: `organizations.{stripe_customer_id, stripe_subscription_id, plan, plan_seats, subscription_status, current_period_end}`; `employees` table.

- [ ] **Step 1: Write the migration**
```sql
-- Billing on organizations
alter table organizations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists plan text,
  add column if not exists plan_seats int not null default 0,
  add column if not exists subscription_status text not null default 'incomplete',
  add column if not exists current_period_end timestamptz;

-- Employees = seats. Each has a personal StileAI key (hashed).
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  label text not null,
  key_hash text not null unique,
  key_prefix text not null,
  status text not null default 'active',   -- 'active' | 'disabled'
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists employees_org_idx on employees(org_id);
create index if not exists employees_key_hash_idx on employees(key_hash);

alter table employees enable row level security;

-- Members read their org's employees; only admins write. Proxy uses service role (bypasses RLS).
create policy employees_select on employees for select
  using (org_id in (select org_id from profiles where id = auth.uid()));
create policy employees_admin_write on employees for all
  using (org_id in (select org_id from profiles where id = auth.uid() and role = 'admin'))
  with check (org_id in (select org_id from profiles where id = auth.uid() and role = 'admin'));
```

- [ ] **Step 2: User applies it** in the Supabase SQL editor (as with prior migrations). Verify: `select column_name from information_schema.columns where table_name='organizations' and column_name='plan_seats';` returns a row, and `select * from employees limit 0;` succeeds.

- [ ] **Step 3: Commit** `feat(billing): db migration for billing columns + employees`

---

## Task 3: Pure seat + caller logic

**Files:**
- Create: `dashboard/lib/seats.ts`
- Test: `dashboard/lib/seats.test.ts`

**Interfaces:**
- Produces: `seatedIds(active, planSeats): Set<string>`; `callerDecision({subscriptionActive, isAdmin, seated}): { allowed: boolean; reason: string }`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test** `lib/seats.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { seatedIds, callerDecision } from "./seats";

const emp = (id: string, t: string) => ({ id, created_at: t });

describe("seatedIds", () => {
  it("seats the oldest N active employees", () => {
    const active = [emp("c", "2026-03"), emp("a", "2026-01"), emp("b", "2026-02")];
    const s = seatedIds(active, 2);
    expect([...s].sort()).toEqual(["a", "b"]);
  });
  it("seats nobody when planSeats is 0", () => {
    expect(seatedIds([emp("a", "2026-01")], 0).size).toBe(0);
  });
});

describe("callerDecision", () => {
  it("blocks when subscription inactive", () => {
    expect(callerDecision({ subscriptionActive: false, isAdmin: true, seated: true }).allowed).toBe(false);
  });
  it("admin passes when active regardless of seat", () => {
    expect(callerDecision({ subscriptionActive: true, isAdmin: true, seated: false }).allowed).toBe(true);
  });
  it("employee blocked when over seat limit", () => {
    const d = callerDecision({ subscriptionActive: true, isAdmin: false, seated: false });
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/seat/i);
  });
  it("seated employee passes", () => {
    expect(callerDecision({ subscriptionActive: true, isAdmin: false, seated: true }).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `lib/seats.ts`**
```ts
export function seatedIds(active: { id: string; created_at: string }[], planSeats: number): Set<string> {
  const ordered = [...active].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return new Set(ordered.slice(0, Math.max(0, planSeats)).map((e) => e.id));
}

export function callerDecision(x: { subscriptionActive: boolean; isAdmin: boolean; seated: boolean }): { allowed: boolean; reason: string } {
  if (!x.subscriptionActive) return { allowed: false, reason: "Your company's StileAI subscription is inactive." };
  if (x.isAdmin) return { allowed: true, reason: "" };
  if (!x.seated) return { allowed: false, reason: "No active seat — ask your admin to add one." };
  return { allowed: true, reason: "" };
}
```

- [ ] **Step 4: Run — expect PASS**; **commit** `feat(billing): pure seat + caller decision logic`

---

## Task 4: Employees data-access lib

**Files:**
- Create: `dashboard/lib/employees.ts`
- Consumes: `createAdminClient`, `hashApiKey` + key generator from `lib/apiKeys.ts`, `seatedIds` (Task 3).

**Interfaces:**
- Produces: `createEmployee(orgId, label): Promise<{ id: string; key: string; prefix: string }>` (key returned once, never stored raw), `disableEmployee(id)`, `listEmployees(orgId)`, `activeSeatCount(orgId): Promise<number>`, `resolveEmployeeByKey(rawKey): Promise<{ orgId: string; employeeId: string } | null>`.

- [ ] **Step 1: Read `lib/apiKeys.ts`** to reuse its generator and `hashApiKey` (match its key format, e.g. `sk_live_…`). If it exposes `generateApiKey()`, reuse; else generate `sk_live_ + 48 hex` and `hashApiKey` it.

- [ ] **Step 2: Implement `lib/employees.ts`**
```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";
import { randomBytes } from "crypto";

function newKey() {
  const raw = "sk_live_" + randomBytes(24).toString("hex");
  return { raw, prefix: raw.slice(0, 12) + "…" };
}

export async function createEmployee(orgId: string, label: string) {
  const admin = createAdminClient();
  const { raw, prefix } = newKey();
  const { data, error } = await admin.from("employees")
    .insert({ org_id: orgId, label, key_hash: hashApiKey(raw), key_prefix: prefix, status: "active" })
    .select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Could not create employee");
  return { id: data.id as string, key: raw, prefix };
}

export async function disableEmployee(id: string) {
  const admin = createAdminClient();
  await admin.from("employees").update({ status: "disabled" }).eq("id", id);
}

export async function listEmployees(orgId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("employees").select("id, label, key_prefix, status, created_at, last_used_at").eq("org_id", orgId).order("created_at");
  return data ?? [];
}

export async function activeSeatCount(orgId: string) {
  const admin = createAdminClient();
  const { count } = await admin.from("employees").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("status", "active");
  return count ?? 0;
}

export async function resolveEmployeeByKey(rawKey: string) {
  if (!rawKey) return null;
  const admin = createAdminClient();
  const { data } = await admin.from("employees").select("id, org_id, status").eq("key_hash", hashApiKey(rawKey)).eq("status", "active").maybeSingle();
  if (!data) return null;
  return { orgId: data.org_id as string, employeeId: data.id as string };
}
```

- [ ] **Step 3: Verify build** `NODE_OPTIONS=--use-system-ca npm run build`; **commit** `feat(billing): employees data-access`

---

## Task 5: Proxy enforcement — resolveCaller in the gate

**Files:**
- Modify: `dashboard/lib/aiGate.ts`
- Modify: both proxy routes.
- Test: `dashboard/lib/aiGate.test.ts` (pure parts only — the seat/caller logic is already covered in Task 3; here assert the gate wiring calls the decision correctly via a small extracted helper if practical, else rely on Task 3 + manual).

**Interfaces:**
- Produces: `resolveCaller(rawKey): Promise<{ orgId: string; employeeId: string | null; isAdmin: boolean; subscriptionActive: boolean; seated: boolean } | null>`.
- Consumes: `resolveEmployeeByKey`, `activeSeatCount`+`seatedIds`, existing `orgForKey` (admin key), org `subscription_status`+`plan_seats`.

- [ ] **Step 1: Implement `resolveCaller`** in `lib/aiGate.ts`
```ts
import { resolveEmployeeByKey, listEmployees } from "@/lib/employees";
import { seatedIds } from "@/lib/seats";

export async function resolveCaller(rawKey: string) {
  const admin = createAdminClient();
  const emp = await resolveEmployeeByKey(rawKey);
  const orgId = emp?.orgId ?? (await orgForKey(rawKey)); // admin/legacy key fallback
  if (!orgId) return null;
  const { data: org } = await admin.from("organizations").select("subscription_status, plan_seats").eq("id", orgId).maybeSingle();
  const subscriptionActive = (org?.subscription_status ?? "") === "active";
  if (!emp) return { orgId, employeeId: null, isAdmin: true, subscriptionActive, seated: true };
  const actives = (await listEmployees(orgId)).filter((e) => e.status === "active");
  const seated = seatedIds(actives, org?.plan_seats ?? 0).has(emp.employeeId);
  return { orgId, employeeId: emp.employeeId, isAdmin: false, subscriptionActive, seated };
}
```

- [ ] **Step 2: Record `employee_id` in `gate()`** — add `employee_id: employeeId ?? null` to the `audit_log` insert (pass `employeeId` into `gate`).

- [ ] **Step 3: Update both proxy routes** — replace `orgForKey` with `resolveCaller`; before running `gate`, apply `callerDecision`:
```ts
const caller = await resolveCaller(key);
if (!caller) return /* existing 401 invalid-key response */;
const gateAllowed = callerDecision(caller);
if (!gateAllowed.allowed) {
  // Return the provider-shaped block message with gateAllowed.reason (reuse blockMessage/anthropicMessage/completion helpers).
}
// else: run gate(caller.orgId, promptText, model, caller.employeeId) as before.
```

- [ ] **Step 4: Build + run tests**; **manual check (test-mode later):** an over-seat employee key is blocked; admin key passes. **Commit** `feat(billing): per-caller proxy enforcement`

---

## Task 6: Stripe webhook + sync

**Files:**
- Create: `dashboard/lib/billingSync.ts`
- Create: `dashboard/app/api/stripe/webhook/route.ts`
- Test: `dashboard/lib/billingSync.test.ts`

**Interfaces:**
- Produces: `billingFromSubscription(sub): { stripe_subscription_id; plan; plan_seats; subscription_status; current_period_end }`.

- [ ] **Step 1: Failing test** `lib/billingSync.test.ts`
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { billingFromSubscription } from "./billingSync";

beforeEach(() => { process.env.STRIPE_PRICE_BUSINESS = "price_B"; });

it("maps a subscription to org billing columns", () => {
  const sub: any = { id: "sub_1", status: "active", current_period_end: 1893456000,
    items: { data: [{ quantity: 7, price: { id: "price_B" } }] } };
  const b = billingFromSubscription(sub);
  expect(b.stripe_subscription_id).toBe("sub_1");
  expect(b.plan).toBe("business");
  expect(b.plan_seats).toBe(7);
  expect(b.subscription_status).toBe("active");
  expect(b.current_period_end).toContain("2030"); // epoch 1893456000
});
```

- [ ] **Step 2: Implement `lib/billingSync.ts`**
```ts
import { planForPriceId } from "./stripe";
export function billingFromSubscription(sub: any) {
  const item = sub?.items?.data?.[0];
  const priceId = item?.price?.id ?? "";
  return {
    stripe_subscription_id: sub.id as string,
    plan: planForPriceId(priceId),
    plan_seats: (item?.quantity as number) ?? 0,
    subscription_status: sub.status as string,
    current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
}
```

- [ ] **Step 3: Run — PASS. Implement `app/api/stripe/webhook/route.ts`** (raw body + signature verify)
```ts
import { stripe } from "@/lib/stripe";
import { billingFromSubscription } from "@/lib/billingSync";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event;
  try { event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? ""); }
  catch { return new Response("bad signature", { status: 400 }); }

  const admin = createAdminClient();
  if (event.type === "checkout.session.completed") {
    const s: any = event.data.object;
    const orgId = s.client_reference_id;
    const sub = await stripe.subscriptions.retrieve(s.subscription);
    await admin.from("organizations").update({ stripe_customer_id: s.customer, ...billingFromSubscription(sub) }).eq("id", orgId);
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub: any = event.data.object;
    const patch = event.type === "customer.subscription.deleted"
      ? { subscription_status: "canceled" } : billingFromSubscription(sub);
    await admin.from("organizations").update(patch).eq("stripe_subscription_id", sub.id);
  }
  return new Response("ok", { status: 200 });
}
```

- [ ] **Step 4: Build; commit** `feat(billing): stripe webhook + sync`

---

## Task 7: Checkout + Portal endpoints

**Files:**
- Create: `dashboard/app/api/stripe/checkout/route.ts`
- Create: `dashboard/app/api/stripe/portal/route.ts`

- [ ] **Step 1: `checkout/route.ts`** — body `{ orgId, plan, seats }`
```ts
import { stripe, priceIdForPlan, PLANS, type PlanId } from "@/lib/stripe";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { orgId, plan, seats } = await req.json();
  const price = priceIdForPlan(plan as PlanId);
  const min = PLANS[plan as PlanId]?.minSeats ?? 1;
  if (!price) return new Response(JSON.stringify({ error: "Choose Starter or Business (Enterprise is contact-sales)." }), { status: 400 });
  const qty = Math.max(min, Number(seats) || min);
  const origin = req.headers.get("origin") ?? "https://stileai.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", client_reference_id: orgId,
    line_items: [{ price, quantity: qty }],
    success_url: `${origin}/dashboard`, cancel_url: `${origin}/billing/inactive`,
  });
  return new Response(JSON.stringify({ url: session.url }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 2: `portal/route.ts`** — uses the caller's org `stripe_customer_id`
```ts
import { stripe } from "@/lib/stripe";
import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const ctx = await requireProfileContext();
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("stripe_customer_id").eq("id", ctx.orgId).maybeSingle();
  if (!org?.stripe_customer_id) return new Response(JSON.stringify({ error: "No billing account yet." }), { status: 400 });
  const origin = req.headers.get("origin") ?? "https://stileai.vercel.app";
  const s = await stripe.billingPortal.sessions.create({ customer: org.stripe_customer_id, return_url: `${origin}/billing` });
  return new Response(JSON.stringify({ url: s.url }), { headers: { "Content-Type": "application/json" } });
}
```

- [ ] **Step 3: Build; commit** `feat(billing): checkout + portal endpoints`

---

## Task 8: Plan-gated signup

**Files:**
- Modify: `dashboard/app/login/actions.ts`
- Modify: `dashboard/app/login/page.tsx`

**Interfaces:**
- `signUpAction(email, password, orgName)` now returns `{ ok: true; orgId: string } | { ok: false; error }`, and the created org keeps `subscription_status='incomplete'` (default from migration — no code change needed to set it, but confirm the insert doesn't override it).

- [ ] **Step 1:** In `signUpAction`, after creating the org, `select("id")` (already does) and return `orgId` on success. Do **not** set `subscription_status` (defaults to `incomplete`).

- [ ] **Step 2:** In `login/page.tsx` signup mode, add plan (`starter`/`business`, Enterprise = link to `mailto:sales@stileai.com`) + seats inputs. On submit:
```ts
const res = await signUpAction(email, password, orgName);
if (!res.ok) { setError(res.error); return; }
await supabase.auth.signInWithPassword({ email, password });      // establish session
const co = await fetch("/api/stripe/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ orgId: res.orgId, plan, seats }) }).then(r => r.json());
if (co.url) location.href = co.url; else setError(co.error ?? "Could not start checkout.");
```

- [ ] **Step 3: Build; commit** `feat(billing): plan-gated signup`

---

## Task 9: Access gate + inactive screen

**Files:**
- Modify: `dashboard/lib/getProfile.ts`
- Create: `dashboard/app/(app)/billing/inactive/page.tsx`

- [ ] **Step 1:** Add `subscriptionActive: boolean` to `ProfileContext` (select `organizations(subscription_status)`; `active === "active"`). In `requireProfileContext`, after loading: `if (!ctx.isPlatformAdmin && !ctx.subscriptionActive) redirect("/billing/inactive");`. Ensure `/billing/inactive` itself does **not** call `requireProfileContext` in a way that loops — it uses `getProfileContext` (nullable) and shows the screen regardless.

- [ ] **Step 2:** `billing/inactive/page.tsx` — a minimal client screen: "Finishing setup…" that polls `getProfileContext` status every 3s for ~30s (via a tiny `/api/billing/status` route or a server action) then shows "Complete payment" → `/api/stripe/portal` (or re-checkout). Include "Sign out".

- [ ] **Step 3: Build; commit** `feat(billing): app access gate + inactive screen`

---

## Task 10: Billing page + Team & seats page + nav

**Files:**
- Create: `dashboard/app/(app)/billing/page.tsx`
- Create: `dashboard/app/(app)/team/page.tsx`
- Modify: `dashboard/components/AppShell.tsx`

- [ ] **Step 1: Nav** — add to `NAV`: `{ href: "/team", label: "Team & seats", icon: "tenants" }` and `{ href: "/billing", label: "Billing", icon: "payment" }`.

- [ ] **Step 2: Billing page** — server component: load org `plan`, `plan_seats`, `subscription_status`, `current_period_end`, and `activeSeatCount(orgId)`. Render plan, `used / paid` seats, status, renewal date, and a client "Manage billing" button that POSTs `/api/stripe/portal` and redirects to `url`.

- [ ] **Step 3: Team page** — server loads `listEmployees(orgId)`, `activeSeatCount`, org `plan_seats`. Client "Add employee" calls a server action `createEmployee(orgId, label)`; if `activeSeatCount >= plan_seats`, block with "You're using all N seats — add seats in Billing" (link to `/billing`). Show each new key **once** (copy button). "Disable" calls `disableEmployee`.

- [ ] **Step 4:** Update `ConnectGuide.tsx`/`keys` copy: employees use their **personal** key from Team & seats (admin key stays for testing).

- [ ] **Step 5: Build; commit** `feat(billing): billing + team pages and nav`

---

## Task 11: Landing — real "Get started"

**Files:**
- Modify: `dashboard/public/landing.html`

- [ ] **Step 1:** Add a "Get started" CTA (top-right, next to "Log in") that opens the signup flow — simplest: link to `/login?mode=signup` (ensure `login/page.tsx` reads `?mode=signup` to open in signup mode). In the console `loginStart`, change "no workspace yet? book a walkthrough" → "no workspace yet? <a href='/login?mode=signup'>create an account</a>".

- [ ] **Step 2:** Commit `feat(billing): landing get-started entry`; deploy after user OK.

---

## Manual go-live checklist (test mode first)

1. Set the 4 Stripe env vars (test keys) in Vercel.
2. Sign up → pick Business, 3 seats → Stripe **test card** `4242 4242 4242 4242` → land on dashboard unlocked.
3. Team & seats: add 3 employees (get 3 keys). Add a 4th → blocked ("add seats").
4. Point a tool at employee key #1 → request flows + audit row shows `employee_id`. Point at the 4th (over-seat) key → blocked.
5. Stripe portal: raise quantity to 5 → webhook → `plan_seats=5` → 4th employee now works.
6. Cancel in portal → app + proxy lock (inactive screen).
7. Flip to **live** keys.

---

## Self-Review notes

- Spec coverage: identity/seats (T2–4), enforcement (T5), Stripe checkout/portal/webhook (T6–7), plan-gated signup (T8), access gate (T9), billing/team UI (T10), landing entry (T11), pricing config (T1). ✔
- No free plan: org defaults `incomplete`; gate blocks until webhook → `active`. ✔
- Hard-block = over-seat employee only (seatedIds by oldest-N; admin exempt). ✔
- Type consistency: `PlanId`, `resolveCaller` shape, `billingFromSubscription` columns match the migration. ✔
- Pin the Stripe API version in `lib/stripe.ts` once the account's version is known (currently uses account default).
