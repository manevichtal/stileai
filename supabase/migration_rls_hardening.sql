-- Interlock — RLS hardening migration
-- Apply via the Supabase SQL editor, or `supabase db push` if using the CLI.
-- Makes the audit trail tamper-proof and locks admin-only tables to admins.

-- 1) audit_log is APPEND-ONLY for tenants: they may read their org's rows, but
--    only the service role (checkpoint/gateway) may write. Prevents an org user
--    from tampering with their own compliance trail.
drop policy if exists org_rw_audit on audit_log;
create policy org_ro_audit on audit_log
  for select using (org_id = current_org_id());
-- (no insert/update/delete policy for authenticated/anon → denied by RLS;
--  service role bypasses RLS and remains the sole writer.)

-- 2) api_keys + org_policy_settings are ADMIN-ONLY (they mint credentials / set
--    the org's default posture). Was: any org member. Now: role='admin' + org.
drop policy if exists org_rw_api_keys on api_keys;
create policy admin_rw_api_keys on api_keys
  for all
  using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists org_rw_settings on org_policy_settings;
create policy admin_rw_settings on org_policy_settings
  for all
  using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- 3) constrain the role vocabulary.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','approver','viewer'));
