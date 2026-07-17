-- StileAI hardening migration: keep the audit log fast at scale and give it a
-- retention path. Apply via the Supabase SQL editor. Safe to re-run.

-- 1) Indexes for the two hottest read paths.
--    The audit page lists an org's rows newest-first; the approvals queue reads
--    an org's pending rows. Without these, both slow down as rows accumulate.
create index if not exists audit_log_org_ts on audit_log (org_id, ts desc);
create index if not exists approvals_org_status on approvals (org_id, status);

-- 2) Retention: delete audit rows older than N days. Returns how many were removed.
--    service_role only, so a logged-in user can never purge another org's trail.
create or replace function prune_audit_log(p_days int default 90)
returns bigint
language sql
security invoker
set search_path = public
as $$
  with del as (
    delete from audit_log
    where ts < now() - (p_days || ' days')::interval
    returning 1
  )
  select count(*)::bigint from del;
$$;

revoke execute on function prune_audit_log(int) from public;
revoke execute on function prune_audit_log(int) from anon;
revoke execute on function prune_audit_log(int) from authenticated;
grant execute on function prune_audit_log(int) to service_role;

-- 3) Retention runs automatically via the Vercel cron at /api/cron/prune-audit
--    (see vercel.json). If you would rather run it inside Postgres, enable pg_cron
--    and uncomment:
-- select cron.schedule('prune-audit-daily', '0 3 * * *', $$ select prune_audit_log(90) $$);
