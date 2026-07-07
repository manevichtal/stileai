-- StileAI migration: speeds up per-actor / recent-window counting for velocity
-- policies (GET /api/usage). audit_log's timestamp column is `ts` (see schema.sql).
-- Apply via the Supabase SQL editor.

create index if not exists audit_log_org_actor_ts on audit_log (org_id, actor, ts desc);

-- Server-side sum of numeric params.amount for an org since a timestamp (money
-- velocity). Computed in Postgres so it is NEVER truncated by a row cap — an
-- agent must not be able to hide a large charge by flooding cheap audit rows.
create or replace function sum_recent_amount(p_org uuid, p_since timestamptz)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum((params->>'amount')::numeric), 0)
  from audit_log
  where org_id = p_org
    and ts >= p_since
    and params ? 'amount'
    and (params->>'amount') ~ '^-?[0-9]+(\.[0-9]+)?$'
$$;

-- Only the service role (the dashboard's /api/usage route) may call this.
-- Prevents a logged-in user from summing another org's spend via PostgREST RPC.
revoke execute on function sum_recent_amount(uuid, timestamptz) from public;
revoke execute on function sum_recent_amount(uuid, timestamptz) from anon;
revoke execute on function sum_recent_amount(uuid, timestamptz) from authenticated;
grant execute on function sum_recent_amount(uuid, timestamptz) to service_role;
