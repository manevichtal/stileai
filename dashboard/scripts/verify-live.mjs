// Phase 7 live verification: exercises the DEPLOYED dashboard on Vercel end to end —
// public login page, API auth (401 + real key), and authenticated page render —
// against the production Supabase. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.argv[2] || "https://stileai.com";

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `live-${Date.now()}@stileai-verify.local`;
const password = "verify-password-123";
const ORG = "Live Test Org";
const rawKey = "sk_live_" + randomBytes(24).toString("hex");
let userId, orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  console.log("target: " + BASE);
  // 1. public login page
  const login = await fetch(BASE + "/login");
  const lbody = await login.text();
  if (login.status === 200 && lbody.includes("Create account")) ok("public /login page serves our app");
  else bad(`/login status ${login.status}`);

  // 2. API rejects missing key with our JSON 401 (not a Vercel/HTML wall)
  const noauth = await fetch(BASE + "/api/policies/version");
  const nbody = await noauth.text();
  if (noauth.status === 401 && nbody.includes("invalid or missing API key")) ok("API returns our JSON 401 without a key");
  else bad(`API 401 check: status ${noauth.status} body ${nbody.slice(0, 80)}`);

  // 3. seed org + key + a policy, then hit the LIVE API with the key
  const { data: org } = await admin.from("organizations").insert({ name: ORG }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("policies").insert({
    org_id: orgId, policy_id: "approve-large-payments", effect: "require_approval", priority: 41,
    actor: "*", action: "payment.charge", resource: "*", approvals_required: 1,
    conditions: [{ field: "amount", op: "gt", value: 100 }], description: "over $100 needs a human", enabled: true,
  });
  await admin.from("api_keys").insert({ org_id: orgId, label: "live-test", key_hash: createHash("sha256").update(rawKey).digest("hex"), key_prefix: rawKey.slice(0, 12) });

  const withKey = await fetch(BASE + "/api/policies", { headers: { Authorization: `Bearer ${rawKey}` } });
  const pol = await withKey.json();
  if (withKey.status === 200 && pol.policies?.[0]?.id === "approve-large-payments" && pol.default_effect === "require_approval")
    ok("LIVE API returns the engine-shaped ruleset with a real key (service-role env works on Vercel)");
  else bad("live API-with-key wrong: " + JSON.stringify(pol).slice(0, 120));

  // 4. onboard a user, sign in, replay session cookies -> Overview renders
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.user.id;
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
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
  const home = await fetch(BASE + "/", { headers: { cookie }, redirect: "manual" });
  const hbody = await home.text();
  if (home.status === 200 && hbody.includes("Overview") && hbody.includes(ORG))
    ok(`authenticated user lands on their Overview ("${ORG}") on the live site`);
  else bad(`live authenticated home: status ${home.status} hasOrg=${hbody.includes(ORG)} hasOverview=${hbody.includes("Overview")}`);
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nLIVE VERIFY: FAILED" : "\nLIVE VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
