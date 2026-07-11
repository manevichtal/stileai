-- Deep inspection (AI second opinion) support: a per-tenant verdict cache and a
-- per-org monthly budget counter. Both are STRICTLY scoped by org_id so one
-- tenant's cached verdicts or usage can never touch another's. Service-role only
-- (no RLS policies granted); the app reaches them through the admin client.
-- Safe to run more than once.

-- Cache: which sensitive categories the AI found for a given (org, prompt-hash).
-- The hash is org-salted in the app, so the same text from two tenants yields two
-- different rows. Stores no raw prompt content — only the hash and the result.
create table if not exists ai_inspection_cache (
  org_id      uuid not null,
  prompt_hash text not null,
  categories  text[] not null default '{}',
  created_at  timestamptz not null default now(),
  primary key (org_id, prompt_hash)
);
alter table ai_inspection_cache enable row level security;
create index if not exists ai_inspection_cache_created_idx on ai_inspection_cache (created_at);

-- Monthly budget counter, one row per (org, 'YYYY-MM').
create table if not exists ai_inspection_usage (
  org_id uuid not null,
  period text not null,
  count  int not null default 0,
  primary key (org_id, period)
);
alter table ai_inspection_usage enable row level security;

-- Atomically count one inspection for this org+month and report whether the tenant
-- is still within its included allotment. Returns TRUE while under the limit.
create or replace function ai_budget_consume(
  p_org uuid,
  p_period text,
  p_limit int
) returns boolean
language plpgsql
as $$
declare
  v_count int;
begin
  insert into ai_inspection_usage (org_id, period, count)
    values (p_org, p_period, 1)
  on conflict (org_id, period) do update
    set count = ai_inspection_usage.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Optional housekeeping: drop cache rows past their useful life. Call from a cron
-- if you add one; not required for correctness.
create or replace function ai_inspection_cache_gc() returns void
language sql
as $$
  delete from ai_inspection_cache where created_at < now() - interval '2 days';
$$;
