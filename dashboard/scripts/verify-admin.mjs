// Verifies the platform-owner ("master") account: a platform admin sees the
// cross-tenant /admin view; a normal tenant admin is blocked from it. Cleans up.
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
// must match the dev server's PLATFORM_ADMIN_EMAILS
const PLATFORM_EMAIL = "platform-owner-test@stileai-verify.local";

const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const created = { users: [], orgs: [] };
let failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

async function makeUser(email, orgName) {
  const { data: c } = await admin.auth.admin.createUser({ email, password: "verify-password-123", email_confirm: true });
  created.users.push(c.user.id);
  const { data: org } = await admin.from("organizations").insert({ name: orgName }).select("id").single();
  created.orgs.push(org.id);
  await admin.from("org_policy_settings").insert({ org_id: org.id });
  await admin.from("profiles").insert({ id: c.user.id, org_id: org.id, role: "admin", email });
  return { userId: c.user.id, orgId: org.id, email };
}
async function cookieFor(email) {
  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s, error } = await pub.auth.signInWithPassword({ email, password: "verify-password-123" });
  if (error) throw error;
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  return [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
}

try {
  const owner = await makeUser(PLATFORM_EMAIL, "Owner Home Org");
  const normal = await makeUser(`normal-${Date.now()}@stileai-verify.local`, "Normal Tenant");
  // two extra tenants with some data, so the god view has something to show
  const { data: tA } = await admin.from("organizations").insert({ name: "Tenant Alpha" }).select("id").single();
  const { data: tB } = await admin.from("organizations").insert({ name: "Tenant Beta" }).select("id").single();
  created.orgs.push(tA.id, tB.id);
  await admin.from("policies").insert({ org_id: tA.id, policy_id: "r1", effect: "deny", priority: 5, actor: "*", action: "db.drop*", resource: "*" });
  await admin.from("audit_log").insert({ org_id: tA.id, decision_id: "d1", actor: "agent:x", action: "db.drop_table", resource: "t", effect: "deny", matched_policy: "r1", status: "denied", params: {} });
  await admin.from("approvals").insert({ org_id: tB.id, decision_id: "p1", actor: "agent:y", action: "payment.charge", resource: "c", status: "pending", approvals_required: 1, params: {} });
  ok("seeded 4 orgs (owner, normal, Tenant Alpha, Tenant Beta)");

  const ownerCookie = await cookieFor(owner.email);
  const normalCookie = await cookieFor(normal.email);

  // 1. platform owner sees /admin with all tenants
  const a1 = await fetch(BASE + "/admin", { headers: { cookie: ownerCookie }, redirect: "manual" });
  const b1 = await a1.text();
  if (a1.status === 200 && b1.includes("All tenants") && b1.includes("Tenant Alpha") && b1.includes("Tenant Beta") && b1.includes("Normal Tenant"))
    ok("platform owner: /admin lists every tenant");
  else bad(`owner /admin: status ${a1.status} alpha=${b1.includes("Tenant Alpha")} beta=${b1.includes("Tenant Beta")} normal=${b1.includes("Normal Tenant")}`);

  // 2. platform owner can drill into a specific tenant
  const a2 = await fetch(BASE + "/admin/" + tA.id, { headers: { cookie: ownerCookie }, redirect: "manual" });
  const b2 = await a2.text();
  if (a2.status === 200 && b2.includes("Tenant Alpha") && b2.includes("db.drop"))
    ok("platform owner: tenant drill-down shows that tenant's data");
  else bad(`owner /admin/[org]: status ${a2.status} name=${b2.includes("Tenant Alpha")} policy=${b2.includes("db.drop")}`);

  // 3. normal tenant admin is BLOCKED from /admin (redirected away)
  const a3 = await fetch(BASE + "/admin", { headers: { cookie: normalCookie }, redirect: "manual" });
  if (a3.status === 307 || a3.status === 302 || a3.status === 308) ok(`normal admin: /admin blocked (redirect ${a3.status})`);
  else {
    const b3 = await a3.text();
    if (a3.status === 200 && !b3.includes("Tenant Alpha")) ok("normal admin: /admin shows no tenant data");
    else bad(`normal admin NOT blocked from /admin: status ${a3.status} sawAlpha=${(await a3.text()).includes?.("Tenant Alpha")}`);
  }

  // 4. normal tenant admin cannot drill into another tenant either
  const a4 = await fetch(BASE + "/admin/" + tA.id, { headers: { cookie: normalCookie }, redirect: "manual" });
  if ([302, 307, 308].includes(a4.status)) ok(`normal admin: tenant drill-down blocked (redirect ${a4.status})`);
  else {
    const b4 = await a4.text();
    if (!b4.includes("db.drop")) ok("normal admin: tenant drill-down shows no data");
    else bad(`normal admin saw another tenant's data: status ${a4.status}`);
  }
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  for (const id of created.orgs) await admin.from("organizations").delete().eq("id", id);
  for (const id of created.users) await admin.auth.admin.deleteUser(id);
  console.log("  cleanup done");
}
console.log(failed ? "\nADMIN VERIFY: FAILED" : "\nADMIN VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
