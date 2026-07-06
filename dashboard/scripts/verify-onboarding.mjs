// Phase 2 verification: exercises the sign-up onboarding + auth + RLS round-trip
// against the real Supabase project, then cleans up. Run from dashboard/.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// load .env.local
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `phase2-test-${Date.now()}@stileai-verify.local`;
const password = "verify-password-123";
let userId, orgId;
let failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  // 1. onboarding (mirrors app/login/actions.ts)
  const { data: created, error: e1 } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (e1) throw e1;
  userId = created.user.id;
  ok("created auth user (pre-confirmed)");

  const { data: org, error: e2 } = await admin
    .from("organizations").insert({ name: "Phase2 Test Org" }).select("id").single();
  if (e2) throw e2;
  orgId = org.id;
  ok("created organization " + orgId);

  const { error: e3 } = await admin.from("org_policy_settings").insert({ org_id: orgId });
  if (e3) throw e3;
  ok("created default policy settings (fail-safe default_effect)");

  const { error: e4 } = await admin.from("profiles")
    .insert({ id: userId, org_id: orgId, role: "admin", email });
  if (e4) throw e4;
  ok("created admin profile linked to org");

  // 2. sign in as the new user via the public anon client
  const asUser = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signin, error: e5 } = await asUser.auth.signInWithPassword({ email, password });
  if (e5) throw e5;
  ok("signed in with email + password");

  // 3. RLS: signed-in user reads their own profile + org
  const { data: prof, error: e6 } = await asUser
    .from("profiles").select("org_id, role, organizations(name)").eq("id", userId).single();
  if (e6) throw e6;
  if (prof.org_id === orgId && prof.organizations?.name === "Phase2 Test Org") {
    ok("RLS: user sees their own org (" + prof.organizations.name + ")");
  } else bad("RLS profile read mismatch");

  // 4. RLS isolation: create a SECOND org via service role; the user must NOT see it
  const { data: other } = await admin
    .from("organizations").insert({ name: "Other Tenant" }).select("id").single();
  const { data: orgsSeen } = await asUser.from("organizations").select("id");
  const ids = (orgsSeen || []).map((o) => o.id);
  if (ids.includes(orgId) && !ids.includes(other.id)) {
    ok("RLS isolation: user sees ONLY their org, not the other tenant");
  } else {
    bad("RLS isolation FAILED — user saw orgs: " + JSON.stringify(ids));
  }
  await admin.from("organizations").delete().eq("id", other.id);
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  // cleanup
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}

console.log(failed ? "\nPHASE 2 VERIFY: FAILED" : "\nPHASE 2 VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
