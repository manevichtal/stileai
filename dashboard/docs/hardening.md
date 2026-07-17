# Production hardening + runbook

What we hardened before opening StileAI to real customers, and the short list of
things you (the founder) need to switch on. Written for 100 to 1,000 users.

## What is now in the code

**1. Extension health beacon (silent-break detection).**
The scariest failure for a security product is looking fine while protecting
nothing. If an AI vendor (ChatGPT/Claude/Gemini) changes their request format, our
extractor could stop reading messages silently. Now, whenever the extension
matches a real "send" endpoint but cannot read a message out of it, it fires a
beacon to `/api/health/extraction`, which logs an `extraction_miss` line (no prompt
content, ever). Set an alert on that line (below) and we find out immediately.

**2. Fail-closed policy check.**
Both API proxy routes now wrap the policy check so that if it errors for any
reason, the request is HELD with a clear message and never forwarded to the AI.
It can never fail open.

**3. Audit log built for scale.**
`supabase/migration_hardening.sql` adds indexes for the two hottest reads (an
org's recent audit rows, an org's pending approvals) and a `prune_audit_log(days)`
retention function. A daily Vercel cron (`/api/cron/prune-audit`, see `vercel.json`)
deletes rows older than the retention window so the table stays fast and small.

**4. Load-test script.**
`scripts/loadtest.mjs` hammers a URL at a set concurrency and reports throughput
and latency percentiles.

## Your checklist (one-time)

- [ ] **Apply the SQL.** Run `supabase/migration_hardening.sql` in the Supabase SQL
      editor. (Indexes + the retention function.)
- [ ] **Set `CRON_SECRET`** in Vercel (any long random string). Vercel automatically
      sends it to the cron, and the prune route rejects anything without it. Optional:
      `AUDIT_RETENTION_DAYS` (default 90).
- [ ] **Alert on `extraction_miss`.** In Vercel, add a Log Drain or a log alert that
      notifies you when a log line contains `"evt":"extraction_miss"`. That is your
      early warning that a vendor changed their format and an extractor needs a fix.
- [ ] **Uptime check.** Point any uptime monitor (Better Uptime, Pingdom, or a free
      one) at `https://stileai.com/api/health`. It returns 200 when healthy, 503 when
      the database is unreachable.
- [ ] **(Recommended) Error monitoring.** Add Sentry (or similar) to the dashboard for
      server error visibility. Needs a Sentry account + DSN env var.

## Before a big customer: run the load test

Against a STAGING key/tenant (so the audit log and AI budget are yours):

```
node scripts/loadtest.mjs --url https://stileai.com/api/health --conc 50 --secs 20
node scripts/loadtest.mjs --url https://stileai.com/api/inspect --conc 25 --secs 20 \
  --key <staging_key> --method POST \
  --body '{"prompt":"summarize our Q3 revenue of $2.4M","site":"loadtest"}'
```

Watch p90/p99 latency and the error count. The health endpoint should stay flat;
the inspect endpoint's latency reflects the real decision path. If p99 climbs or
errors appear, that is the first thing to tune before scaling up.

## What to watch once live

- **extraction_miss alerts** - fix the extractor promptly; coverage for that site is
  degraded until you do.
- **Escalation rate / AI budget** - if too many prompts hit the AI second opinion,
  latency and cost rise. The deterministic layer should handle the large majority.
- **Audit table size** - the cron keeps it bounded; confirm it is running (the route
  returns `{ ok: true, deleted: N }`).
