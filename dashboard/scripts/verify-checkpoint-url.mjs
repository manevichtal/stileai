// Tests per-tenant checkpoint URL: register endpoint (auth + persist), Settings
// render, and Connect auto-fill. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:3000";
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `cp-${Date.now()}@stileai-verify.local`;
const rawKey = "sk_live_" + randomBytes(24).toString("hex");
const CP_URL = "https://cp-endpoint-test.example/mcp";
let userId, orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

async function orgCp() {
  const { data } = await admin.from("organizations").select("checkpoint_url").eq("id", orgId).single();
  return data?.checkpoint_url;
}

try {
  const { data: c } = await admin.auth.admin.createUser({ email, password: "verify-password-123", email_confirm: true });
  userId = c.user.id;
  const { data: org } = await admin.from("organizations").insert({ name: "CP Co" }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
  await admin.from("api_keys").insert({ org_id: orgId, label: "cp", key_hash: createHash("sha256").update(rawKey).digest("hex"), key_prefix: rawKey.slice(0, 12) });
  ok("seeded org + api key");

  // register endpoint: no key -> 401
  const noauth = await fetch(`${BASE}/api/checkpoint`, { method: "POST", body: JSON.stringify({ url: CP_URL }) });
  // invalid url -> 400
  const badurl = await fetch(`${BASE}/api/checkpoint`, { method: "POST", headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: "not-a-url" }) });
  if (noauth.status === 401 && badurl.status === 400) ok("register endpoint rejects missing key (401) + bad url (400)");
  else bad(`register guards: noauth=${noauth.status} badurl=${badurl.status}`);

  // valid register -> 200 + persisted
  const reg = await fetch(`${BASE}/api/checkpoint`, { method: "POST", headers: { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: CP_URL }) });
  if (reg.status === 200 && (await orgCp()) === CP_URL) ok("register endpoint saves checkpoint_url for the org");
  else bad(`register failed: status ${reg.status}, stored ${await orgCp()}`);

  // sign in + cookie
  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await pub.auth.signInWithPassword({ email, password: "verify-password-123" });
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.setSession({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

  // Overview Connect auto-fills the URL
  const home = await (await fetch(BASE + "/", { headers: { cookie } })).text();
  if (home.includes(CP_URL)) ok("Overview Connect section auto-fills the tenant's checkpoint URL");
  else bad("Overview did not show checkpoint URL");

  // Settings shows the URL in its field
  const settings = await (await fetch(BASE + "/settings", { headers: { cookie } })).text();
  if (settings.includes(CP_URL) && settings.includes("Checkpoint URL")) ok("Settings shows the saved checkpoint URL");
  else bad("Settings did not show checkpoint URL");
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nCHECKPOINT URL VERIFY: FAILED" : "\nCHECKPOINT URL VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
