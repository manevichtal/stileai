-- StileAI: downstream tools the gateway proxies, per org.
create table if not exists connected_tools (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  name       text not null,                 -- shown to the agent as the tool group
  transport  text not null check (transport in ('http','stdio')),
  target     text not null,                 -- http: URL ; stdio: JSON [command, ...args]
  auth       text,                          -- encrypted secret for the downstream (enc:...)
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, name),
  check (auth is null or auth like 'enc:%')  -- never store plaintext downstream creds
);
create index if not exists connected_tools_org on connected_tools(org_id);

alter table connected_tools enable row level security;

-- admin-only + org-scoped (holds credentials)
create policy connected_tools_admin_rw on connected_tools
  for all
  using (
    org_id = current_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    org_id = current_org_id()
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
