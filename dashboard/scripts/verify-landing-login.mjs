// Verify the new landing design + its inline login endpoint end-to-end:
// / serves the new StileAI landing; POST /api/auth/login signs in (sets cookie)
// and the resulting session reaches /dashboard; wrong password -> 401. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.argv[2] || "http://localhost:3000";
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `llogin-${Date.now()}@stileai-verify.local`;
const password = "verify-password-123";
let userId, orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  const { data: c } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = c.user.id;
  const { data: org } = await admin.from("organizations").insert({ name: "InlineLogin Co" }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
  ok("seeded org + user");

  // 1. new landing serves at /
  const home = await (await fetch(BASE + "/")).text();
  if (home.includes("StileAI") && home.includes("Your team is turning on AI agents") && home.includes("Book a walkthrough"))
    ok("/ serves the new StileAI landing design");
  else bad("new landing markers missing");

  // 2. wrong password -> 401
  const wrong = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "nope" }) });
  if (wrong.status === 401) ok("POST /api/auth/login wrong password -> 401");
  else bad(`wrong pw: status ${wrong.status}`);

  // 3. correct login -> 200 + redirect + session cookie
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const data = await res.json();
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  if (res.status === 200 && data.ok && data.redirect === "/dashboard" && setCookies.length > 0)
    ok(`inline login -> 200, redirect /dashboard, ${setCookies.length} session cookie(s) set`);
  else bad(`login failed: status ${res.status} ok=${data.ok} redirect=${data.redirect} cookies=${setCookies.length}`);

  // 4. the session reaches the portal
  const cookieHeader = setCookies.map((c) => c.split(";")[0]).join("; ");
  const dash = await fetch(BASE + "/dashboard", { headers: { cookie: cookieHeader }, redirect: "manual" });
  const dbody = await dash.text();
  if (dash.status === 200 && dbody.includes("Welcome back") && dbody.includes("InlineLogin Co"))
    ok("session from inline login opens the portal at /dashboard");
  else bad(`portal via inline-login cookie: status ${dash.status} welcome=${dbody.includes("Welcome back")}`);
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nLANDING LOGIN VERIFY: FAILED" : "\nLANDING LOGIN VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
