-- Decision feedback: lets an admin flag a decision as wrong (over-blocked, or a
-- miss). Two purposes: admins can correct mistakes, and the flagged examples are
-- the labeled data that Phase 3 (first-party detection models) will train on.
--
-- Strictly org-scoped. Tenants may READ their own org's feedback; only the
-- service role WRITES (mirrors audit_log: the app inserts via the admin client
-- after resolving the caller's org from their session). Stores no raw sensitive
-- content — the snapshot fields copy the already-redacted audit values.
-- Safe to run more than once.

create table if not exists decision_feedback (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  decision_id  text not null,
  -- false_positive: was blocked/held but should have been allowed (over-blocked)
  -- false_negative: was allowed but should have been blocked (a miss)
  -- other:          anything else the reporter wants to flag
  kind         text not null check (kind in ('false_positive','false_negative','other')),
  note         text,
  reported_by  text,                              -- reporter email (from session)
  effect       text,                              -- snapshot of the decision effect
  reason       text,                              -- snapshot of the decision reason
  preview      text,                              -- snapshot of the ALREADY-redacted preview
  status       text not null default 'open',      -- open | reviewed | dismissed
  created_at   timestamptz not null default now()
);

create index if not exists decision_feedback_org_created
  on decision_feedback(org_id, created_at desc);

alter table decision_feedback enable row level security;

-- Tenants read their own org's feedback; writes are service-role only (no
-- insert/update/delete policy for authenticated/anon → denied by RLS).
drop policy if exists org_ro_decision_feedback on decision_feedback;
create policy org_ro_decision_feedback on decision_feedback
  for select using (org_id = current_org_id());
