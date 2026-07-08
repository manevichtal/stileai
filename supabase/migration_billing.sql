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
