-- Inbound "Book a demo" requests from the public landing page. This is a lead
-- inbox: the public POST /api/demo route writes here with the service role, and
-- an email notification is sent to the founder when an email provider is set.
--
-- There is NO tenant here (these are prospects, not customers), so the table is
-- deliberately not org-scoped. RLS is ON and there is NO policy for the anon or
-- authenticated roles, so the public/browser clients can never read it. Only the
-- service role (which bypasses RLS) writes and reads it. Safe to run more than once.

create table if not exists demo_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  company     text,
  team_size   text,
  message     text,
  source      text,                       -- which button/page it came from
  user_agent  text,
  ip          text,
  notified    boolean not null default false,   -- did the email notification send
  created_at  timestamptz not null default now()
);

create index if not exists demo_requests_created_idx on demo_requests (created_at desc);

alter table demo_requests enable row level security;
-- No anon/authenticated policies on purpose: only the service role may touch it.
