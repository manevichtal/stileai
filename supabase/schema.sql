-- Interlock — Supabase schema
-- Apply via the Supabase SQL editor, or `supabase db push` if using the CLI.
-- Multi-tenant: every row is scoped to an organization. Row Level Security
-- ensures an admin only sees their own org's data. The MCP-facing API routes
-- use the service role (server-side only) and filter by org_id explicitly.

-- ---------------------------------------------------------------------------
-- Organizations (one per customer company)
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  policy_version bigint not null default 1,   -- bumped whenever policies change
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (link Supabase Auth users -> org + role)
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id       uuid primary key references auth.users(id) on delete cascade,
  org_id   uuid not null references organizations(id) on delete cascade,
  role     text not null default 'admin',    -- admin | approver | viewer
  email    text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- API keys (the MCP authenticates with one of these; store only a hash)
-- ---------------------------------------------------------------------------
create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  label        text,
  key_hash     text not null,                -- hash of the key; never store raw
  key_prefix   text,                          -- first few chars, for display
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists api_keys_org on api_keys(org_id);

-- ---------------------------------------------------------------------------
-- Policies (the rules; shape mirrors engine.load_policies_from_dict)
-- ---------------------------------------------------------------------------
create table if not exists policies (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organizations(id) on delete cascade,
  policy_id          text not null,           -- human id, e.g. "approve-large-payments"
  effect             text not null,           -- allow | deny | require_approval
  priority           int  not null default 100,
  actor              text not null default '*',
  action             text not null default '*',
  resource           text not null default '*',
  conditions         jsonb not null default '[]'::jsonb,
  approvals_required int  not null default 1,
  description        text default '',
  enabled            boolean not null default true,
  updated_at         timestamptz not null default now(),
  unique (org_id, policy_id)
);
create index if not exists policies_org on policies(org_id);

-- Org-level defaults for when no policy matches
create table if not exists org_policy_settings (
  org_id         uuid primary key references organizations(id) on delete cascade,
  default_effect text not null default 'require_approval',
  default_reason text not null default 'No policy matched — defaulting to approval.'
);

-- ---------------------------------------------------------------------------
-- Audit log (one row per decision; params already redacted by the MCP)
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organizations(id) on delete cascade,
  decision_id    text not null,
  ts             timestamptz not null default now(),
  actor          text,
  action         text,
  resource       text,
  params         jsonb,
  effect         text,
  matched_policy text,
  reason         text,
  status         text
);
create index if not exists audit_org_ts on audit_log(org_id, ts desc);

-- ---------------------------------------------------------------------------
-- Approvals (pending human-in-the-loop decisions)
-- ---------------------------------------------------------------------------
create table if not exists approvals (
  decision_id        text not null,
  org_id             uuid not null references organizations(id) on delete cascade,
  actor              text,
  action             text,
  resource           text,
  params             jsonb,
  reason             text,
  matched_policy     text,
  approvals_required int not null default 1,
  status             text not null default 'pending',  -- pending | approved | denied
  approvals          jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  primary key (org_id, decision_id)
);
create index if not exists approvals_org_status on approvals(org_id, status);

-- ---------------------------------------------------------------------------
-- Bump policy_version whenever policies change (so the MCP's cheap version
-- poll detects edits and refetches).
-- ---------------------------------------------------------------------------
create or replace function bump_policy_version() returns trigger as $$
begin
  update organizations
     set policy_version = policy_version + 1
   where id = coalesce(new.org_id, old.org_id);
  return null;
end;
$$ language plpgsql;

drop trigger if exists policies_bump on policies;
create trigger policies_bump
  after insert or update or delete on policies
  for each row execute function bump_policy_version();

drop trigger if exists settings_bump on org_policy_settings;
create trigger settings_bump
  after insert or update or delete on org_policy_settings
  for each row execute function bump_policy_version();

-- ---------------------------------------------------------------------------
-- Row Level Security: admins see only their own org's rows.
-- (MCP-facing API routes use the service role, which bypasses RLS, and MUST
--  filter by org_id in code — see CLAUDE.md section 5.)
-- ---------------------------------------------------------------------------
alter table organizations      enable row level security;
alter table profiles           enable row level security;
alter table api_keys           enable row level security;
alter table policies           enable row level security;
alter table org_policy_settings enable row level security;
alter table audit_log          enable row level security;
alter table approvals          enable row level security;

-- Helper: the caller's org_id from their profile.
create or replace function current_org_id() returns uuid as $$
  select org_id from profiles where id = auth.uid()
$$ language sql stable;

-- Profiles: a user can read/update their own profile row.
create policy profiles_self on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Org-scoped tables: rows must belong to the caller's org.
create policy org_rw_organizations on organizations
  for all using (id = current_org_id()) with check (id = current_org_id());
create policy org_rw_api_keys on api_keys
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_rw_policies on policies
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_rw_settings on org_policy_settings
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_rw_audit on audit_log
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_rw_approvals on approvals
  for all using (org_id = current_org_id()) with check (org_id = current_org_id());
