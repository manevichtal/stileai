# Security Policy

StileAI is a security product, and we hold our own code to that bar. This
document describes how we protect customer data and how to report a
vulnerability.

## Reporting a vulnerability

Email **security@stileai.com** with the details and steps to reproduce. We aim
to acknowledge within 2 business days and to keep you updated through
resolution. Please give us a reasonable window to fix an issue before any
public disclosure. We do not pursue legal action against good-faith research
that respects these guidelines and does not access, modify, or exfiltrate other
customers' data.

## How the product is secured

**Tenant isolation.** Every customer is a separate organization. All org-scoped
tables (policies, audit log, approvals, API keys, profiles) have PostgreSQL
Row Level Security enabled, and access is gated by the organization derived from
the authenticated session. Isolation is enforced at the database, not only in
application code. Server-side routes that use the service role always filter by
the organization the API key resolves to.

**Credential handling.** API keys are 192-bit random values, hashed with SHA-256
before storage; the raw key is shown once at creation and never stored. The
Supabase service-role key is used only in server code and never shipped to the
browser. Customers' AI-provider keys pass through to the provider and are never
persisted.

**Data minimization.** Blocked or held request content is never stored. The
audit trail records the decision, the matched policy category, and a redacted
preview only for explicitly allowed requests. We do not train on customer data
and we do not sell it.

**Fail-closed enforcement.** If the policy service cannot verify a request, the
default is to block it, both in the server-side proxy and in the browser
extension. An unverifiable request is never silently allowed by default.

**Abuse controls.** Public and API-key endpoints (prompt inspection, the AI
proxy, sign-in, and connect-link redemption) are rate limited. Request bodies
are size-capped before parsing.

**Transport and browser hardening.** All traffic is HTTPS. Responses set
HSTS, a Content-Security-Policy, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: SAMEORIGIN`, a strict `Referrer-Policy`, and a
`Permissions-Policy` that disables unused device APIs.

## Subprocessors

Vercel (application hosting), Supabase (Postgres, auth, storage), Stripe
(billing), and the AI providers a customer connects (which receive only the
requests that pass policy, using the customer's own keys). When deep inspection
is enabled, Anthropic's Claude Haiku model receives only the small share of
requests the local checks cannot classify with confidence, for a second
opinion; that content is not stored and not used for training. Each tenant's
verdict cache and usage budget are scoped by organization and never shared. See
the in-product Trust & security page for details.

## Scope and honest limits

The browser extension is a workforce policy checkpoint, not an unbreakable
barrier: a determined user with local control of their machine can bypass any
client-side control. It is designed to prevent the accidental and careless leak,
with a full audit trail, and to be paired with the server-side proxy for
system-to-system enforcement. We state this plainly rather than overselling
prevention.
