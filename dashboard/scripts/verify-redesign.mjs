// Verify the redesigned dashboard renders for a logged-in session: new Overview,
// the policy library, and the logo asset. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.argv[2] || "http://localhost:3000";
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `redesign-${Date.now()}@stileai-verify.local`;
let userId, orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  const { data: c } = await admin.auth.admin.createUser({ email, password: "verify-password-123", email_confirm: true });
  userId = c.user.id;
  const { data: org } = await admin.from("organizations").insert({ name: "Redesign Co" }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
  await admin.from("policies").insert({ org_id: orgId, policy_id: "allow-reads", effect: "allow", priority: 30, actor: "*", action: "*.read", resource: "*" });
  await admin.from("audit_log").insert({ org_id: orgId, decision_id: "d1", actor: "agent:bot", action: "payment.charge", resource: "customer:1", effect: "require_approval", matched_policy: "x", status: "pending", params: {} });
  ok("seeded org + a policy + a decision");

  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await pub.auth.signInWithPassword({ email, password: "verify-password-123" });
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.setSession({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

  const home = await (await fetch(BASE + "/", { headers: { cookie } })).text();
  const homeOk = ["Welcome back", "Recent activity", "Decisions today", "Decisions this week", "compliance pack"].filter((m) => !home.includes(m));
  if (homeOk.length === 0) ok("new Overview renders (hero, activity, stat tiles, chart, promo)"); else bad("Overview missing: " + homeOk.join(", "));
  if (home.includes("/brandmark.png")) ok("sidebar references the logo asset"); else bad("logo not referenced");

  const lib = await (await fetch(BASE + "/policies?tab=library", { headers: { cookie } })).text();
  const libOk = ["Policy library", "Recommended baseline", "SOC 2", "HIPAA", "PCI-DSS", "GDPR", "NIST AI RMF"].filter((m) => !lib.includes(m));
  if (libOk.length === 0) ok("policy library renders all packs"); else bad("library missing: " + libOk.join(", "));

  const rules = await (await fetch(BASE + "/policies", { headers: { cookie } })).text();
  if (rules.includes("Your policies") && rules.includes("allow-reads")) ok("rules tab renders existing policies"); else bad("rules tab wrong");

  const logo = await fetch(BASE + "/brandmark.png");
  if (logo.status === 200 && (logo.headers.get("content-type") || "").includes("image")) ok("logo asset served (200, image)"); else bad("logo asset status " + logo.status);
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nREDESIGN VERIFY: FAILED" : "\nREDESIGN VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
