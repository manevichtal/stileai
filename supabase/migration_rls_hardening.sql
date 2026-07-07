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

-- 2) api_keys + org_policy_settings: any org MEMBER may READ (so viewer/approver
--    teammates still see the Keys/Policies pages), but only ADMINS may WRITE
--    (create/rotate keys, change the org's default posture). Was: any member r/w.
--    Split into a member SELECT policy + admin write policies (RLS OR's them:
--    SELECT hits the member policy; writes hit the admin ones).
drop policy if exists org_rw_api_keys on api_keys;
drop policy if exists admin_rw_api_keys on api_keys;
create policy member_ro_api_keys on api_keys
  for select using (org_id = current_org_id());
create policy admin_write_api_keys on api_keys
  for insert with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy admin_update_api_keys on api_keys
  for update using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
          with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy admin_delete_api_keys on api_keys
  for delete using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists org_rw_settings on org_policy_settings;
drop policy if exists admin_rw_settings on org_policy_settings;
create policy member_ro_settings on org_policy_settings
  for select using (org_id = current_org_id());
create policy admin_write_settings on org_policy_settings
  for insert with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy admin_update_settings on org_policy_settings
  for update using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
          with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- 3) constrain the role vocabulary.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','approver','viewer'));
