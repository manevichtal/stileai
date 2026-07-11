-- Rate limiting for public / API-key endpoints (inspect, proxy, login, redeem).
-- A single fixed-window counter per bucket, incremented and evaluated atomically
-- in one round trip. Service-role only (no RLS policies granted); the app calls
-- it through the admin client. Safe to run more than once.

create table if not exists rate_limits (
  bucket       text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);

alter table rate_limits enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) touches it.

-- Returns TRUE when the caller is under the limit (request allowed), FALSE when
-- the limit for the current window is exceeded. The window resets lazily on the
-- first hit after it expires, so no background job is needed.
create or replace function rate_limit_hit(
  p_bucket text,
  p_limit int,
  p_window_seconds int
) returns boolean
language plpgsql
as $$
declare
  v_now   timestamptz := now();
  v_count int;
begin
  insert into rate_limits (bucket, window_start, count)
    values (p_bucket, v_now, 1)
  on conflict (bucket) do update
    set count = case
          when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < v_now - make_interval(secs => p_window_seconds)
            then v_now
          else rate_limits.window_start
        end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

-- Optional housekeeping: drop counters idle for over a day. Call from a cron if
-- you add one; not required for correctness (rows are reused per bucket).
create or replace function rate_limits_gc() returns void
language sql
as $$
  delete from rate_limits where window_start < now() - interval '1 day';
$$;
