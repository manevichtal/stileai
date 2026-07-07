// Verifies the RLS hardening migration (migration_rls_hardening.sql):
//   - audit_log is tenant READ-ONLY (a non-admin org member cannot update or
//     delete their org's audit rows; select still works).
//   - api_keys is ADMIN-ONLY (a non-admin insert is blocked; an admin insert
//     succeeds).
// Uses the anon client signed in as real seeded users (NOT the service role,
// which bypasses RLS) so this exercises the actual REST/PostgREST RLS path.
// Cleans up.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = "verify-password-123";

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const created = { users: [], orgs: [] };
let failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

async function makeUser(email, orgId, role) {
  const { data: c, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  created.users.push(c.user.id);
  const { error: pErr } = await admin.from("profiles").insert({ id: c.user.id, org_id: orgId, role, email });
  if (pErr) throw pErr;
  return c.user.id;
}

async function signIn(email) {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

try {
  // --- seed (service role) ---------------------------------------------
  const { data: org, error: orgErr } = await admin.from("organizations").insert({ name: "RLS Hardening Test Org" }).select("id").single();
  if (orgErr) throw orgErr;
  const orgId = org.id;
  created.orgs.push(orgId);

  const ts = Date.now();
  const nonAdminEmail = `viewer-${ts}@stileai-verify.local`;
  const adminEmail = `admin-${ts}@stileai-verify.local`;
  await makeUser(nonAdminEmail, orgId, "viewer");
  await makeUser(adminEmail, orgId, "admin");

  const { data: auditRow, error: auditErr } = await admin.from("audit_log").insert({
    org_id: orgId, decision_id: "d-" + ts, actor: "agent:x", action: "db.drop_table",
    resource: "t", effect: "deny", matched_policy: "r1", status: "denied", params: {},
  }).select("id, status").single();
  if (auditErr) throw auditErr;
  const auditId = auditRow.id;

  ok("seeded org + non-admin (viewer) + admin profiles + 1 audit_log row");

  const nonAdminClient = await signIn(nonAdminEmail);
  const adminClient = await signIn(adminEmail);

  // --- non-admin: select still works ------------------------------------
  {
    const { data, error } = await nonAdminClient.from("audit_log").select("id, status").eq("org_id", orgId);
    if (!error && data?.some((r) => r.id === auditId)) ok("non-admin: SELECT audit_log returns the org's row");
    else bad("non-admin SELECT audit_log failed: " + JSON.stringify({ error, data }));
  }

  // --- non-admin: update audit_log is blocked -----------------------------
  {
    const { data, error } = await nonAdminClient.from("audit_log").update({ status: "tampered" }).eq("id", auditId).select();
    if (error || (data && data.length === 0)) ok("non-admin: UPDATE audit_log blocked (0 rows / error)");
    else bad("non-admin UPDATE audit_log NOT blocked: " + JSON.stringify({ error, data }));
  }

  // --- non-admin: delete audit_log is blocked -----------------------------
  {
    const { data, error } = await nonAdminClient.from("audit_log").delete().eq("id", auditId).select();
    if (error || (data && data.length === 0)) ok("non-admin: DELETE audit_log blocked (0 rows / error)");
    else bad("non-admin DELETE audit_log NOT blocked: " + JSON.stringify({ error, data }));
  }

  // --- confirm the row is untouched (service role read) -------------------
  {
    const { data, error } = await admin.from("audit_log").select("id, status").eq("id", auditId).single();
    if (!error && data && data.status === "denied") ok("audit_log row unchanged after blocked update/delete attempts");
    else bad("audit_log row was modified/removed: " + JSON.stringify({ error, data }));
  }

  // --- non-admin: insert into api_keys is blocked --------------------------
  {
    const { data, error } = await nonAdminClient.from("api_keys").insert({
      org_id: orgId, label: "should-fail", key_hash: "x".repeat(16), key_prefix: "sk_test",
    }).select();
    if (error || (data && data.length === 0)) ok("non-admin: INSERT api_keys blocked");
    else bad("non-admin INSERT api_keys NOT blocked: " + JSON.stringify({ error, data }));
  }

  // --- admin: insert into api_keys succeeds ---------------------------------
  {
    const { data, error } = await adminClient.from("api_keys").insert({
      org_id: orgId, label: "should-succeed", key_hash: "y".repeat(16), key_prefix: "sk_test",
    }).select();
    if (!error && data && data.length === 1) ok("admin: INSERT api_keys succeeds");
    else bad("admin INSERT api_keys failed: " + JSON.stringify({ error, data }));
  }

  // --- sanity: verify actual row count in api_keys for this org via service role
  {
    const { data, error } = await admin.from("api_keys").select("id, label").eq("org_id", orgId);
    if (!error && data?.length === 1 && data[0].label === "should-succeed")
      ok("api_keys table has exactly 1 row for org (the admin's insert), non-admin's insert did not land");
    else bad("api_keys row count mismatch: " + JSON.stringify({ error, data }));
  }
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  for (const id of created.orgs) await admin.from("organizations").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  console.log("  cleanup done");
}
console.log(failed ? "\nRLS HARDENING VERIFY: FAILED" : "\nRLS HARDENING VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
