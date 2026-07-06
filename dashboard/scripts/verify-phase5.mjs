// Phase 5 verification: (a) every admin screen renders for a logged-in session,
// (b) the admin's policy/key/org writes succeed under RLS, (c) cross-org isolation
// holds for those writes/reads. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:3000";

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `phase5-${Date.now()}@stileai-verify.local`;
const password = "verify-password-123";
let userId, orgId, otherOrgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  // onboard admin + org
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.user.id;
  const { data: org } = await admin.from("organizations").insert({ name: "Phase5 Org" }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
  // a second org with a policy, to test isolation
  const { data: other } = await admin.from("organizations").insert({ name: "Other Org" }).select("id").single();
  otherOrgId = other.id;
  await admin.from("policies").insert({ org_id: otherOrgId, policy_id: "secret-rule", effect: "deny", priority: 1, action: "*" });
  ok("onboarded admin + org (+ a second org for isolation)");

  // sign in, capture cookies
  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signin, error: se } = await pub.auth.signInWithPassword({ email, password });
  if (se) throw se;
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: signin.session.access_token, refresh_token: signin.session.refresh_token });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

  // (a) each page renders
  const pages = [
    ["/policies", ["Policies", "Add rule"]],
    ["/audit", ["Audit log"]],
    ["/approvals", ["Approvals", "Awaiting a human"]],
    ["/keys", ["API keys", "Generate key"]],
    ["/settings", ["Connect your checkpoint", "INTERLOCK_DASHBOARD_URL"]],
  ];
  for (const [path, markers] of pages) {
    const res = await fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
    const body = await res.text();
    const allPresent = markers.every((m) => body.includes(m));
    const notLogin = !body.includes("Create account");
    if (res.status === 200 && allPresent && notLogin) ok(`renders ${path}`);
    else bad(`${path} status=${res.status} markers=${markers.map((m) => body.includes(m))} login=${body.includes("Create account")}`);
  }

  // (b) admin writes under RLS (mirrors what the server actions do)
  const asUser = createClient(URL, ANON, { auth: { persistSession: false } });
  await asUser.auth.setSession({ access_token: signin.session.access_token, refresh_token: signin.session.refresh_token });

  const { data: ver0row } = await asUser.from("organizations").select("policy_version").eq("id", orgId).single();
  const { error: insErr } = await asUser.from("policies").insert({
    org_id: orgId, policy_id: "test-rule", effect: "require_approval", priority: 42,
    actor: "*", action: "payment.charge", resource: "*", approvals_required: 1,
    conditions: [{ field: "amount", op: "gt", value: 100 }], description: "test", enabled: true,
  });
  if (!insErr) ok("admin can INSERT a policy (RLS)"); else bad("policy insert blocked: " + insErr.message);

  const { data: ver1row } = await asUser.from("organizations").select("policy_version").eq("id", orgId).single();
  if (ver1row.policy_version > ver0row.policy_version) ok(`policy_version bumped on write (${ver0row.policy_version} -> ${ver1row.policy_version})`);
  else bad("policy_version did not bump");

  const { error: updErr } = await asUser.from("policies").update({ description: "edited" }).eq("org_id", orgId).eq("policy_id", "test-rule");
  if (!updErr) ok("admin can UPDATE a policy (RLS)"); else bad("policy update blocked");

  const { error: keyErr } = await asUser.from("api_keys").insert({ org_id: orgId, label: "k", key_hash: "deadbeef", key_prefix: "sk_live_x" });
  if (!keyErr) ok("admin can INSERT an api key (RLS)"); else bad("api key insert blocked: " + keyErr.message);

  const { error: nameErr } = await asUser.from("organizations").update({ name: "Renamed Org" }).eq("id", orgId);
  if (!nameErr) ok("admin can rename their org (RLS)"); else bad("org rename blocked");

  // (c) isolation
  const { data: seenPolicies } = await asUser.from("policies").select("policy_id, org_id");
  const leaked = (seenPolicies ?? []).some((p) => p.org_id === otherOrgId || p.policy_id === "secret-rule");
  if (!leaked) ok("isolation: admin cannot see the other org's policies"); else bad("ISOLATION LEAK: saw other org policies");

  const { error: writeOtherErr } = await asUser.from("policies").insert({ org_id: otherOrgId, policy_id: "sneak", effect: "allow", priority: 1, action: "*" });
  if (writeOtherErr) ok("isolation: admin cannot write into another org (RLS blocks)"); else bad("ISOLATION LEAK: wrote into other org");

  const { error: delErr } = await asUser.from("policies").delete().eq("org_id", orgId).eq("policy_id", "test-rule");
  if (!delErr) ok("admin can DELETE their policy (RLS)"); else bad("policy delete blocked");
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (otherOrgId) await admin.from("organizations").delete().eq("id", otherOrgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nPHASE 5 VERIFY: FAILED" : "\nPHASE 5 VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
