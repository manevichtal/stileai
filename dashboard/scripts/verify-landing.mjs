// Verify Option A: "/" serves the public StileAI landing; portal is at /dashboard;
// login routing works. Cleans up.
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.argv[2] || "http://localhost:3000";
const admin = createClient(URL, SVC, { auth: { persistSession: false } });
const email = `land-${Date.now()}@stileai-verify.local`;
let userId, orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };
const status0 = async (path, headers = {}) => {
  const r = await fetch(BASE + path, { headers, redirect: "manual" });
  return { status: r.status, loc: r.headers.get("location"), body: await r.text() };
};

try {
  // 1. "/" = public landing
  const home = await status0("/");
  if (home.status === 200 && home.body.includes("StileAI") && home.body.includes("Log in") && home.body.includes("stileai · console"))
    ok("/ serves the public StileAI landing (with Log in button)");
  else bad(`/ landing wrong: status ${home.status}, hasLogin=${home.body.includes("Log in")}, isLanding=${home.body.includes("stileai · console")}`);

  // 2. /dashboard while logged out -> redirect to /login
  const dashOut = await status0("/dashboard");
  if ([302, 307, 308].includes(dashOut.status) && (dashOut.loc || "").includes("/login")) ok("/dashboard (logged out) -> redirects to /login");
  else bad(`/dashboard logged-out: status ${dashOut.status} loc ${dashOut.loc}`);

  // onboard + session
  const { data: c } = await admin.auth.admin.createUser({ email, password: "verify-password-123", email_confirm: true });
  userId = c.user.id;
  const { data: org } = await admin.from("organizations").insert({ name: "Land Co" }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: s } = await pub.auth.signInWithPassword({ email, password: "verify-password-123" });
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.setSession({ access_token: s.session.access_token, refresh_token: s.session.refresh_token });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");

  // 3. /dashboard authed -> portal
  const dashIn = await status0("/dashboard", { cookie });
  if (dashIn.status === 200 && dashIn.body.includes("Welcome back") && dashIn.body.includes("Land Co")) ok("/dashboard (logged in) -> renders the portal Overview");
  else bad(`/dashboard authed: status ${dashIn.status} welcome=${dashIn.body.includes("Welcome back")}`);

  // 4. /login authed -> redirect to /dashboard
  const loginIn = await status0("/login", { cookie });
  if ([302, 307, 308].includes(loginIn.status) && (loginIn.loc || "").includes("/dashboard")) ok("/login (logged in) -> redirects to /dashboard");
  else bad(`/login authed: status ${loginIn.status} loc ${loginIn.loc}`);

  // 5. / still landing even when authed (public marketing home)
  const homeIn = await status0("/", { cookie });
  if (homeIn.status === 200 && homeIn.body.includes("stileai · console")) ok("/ stays the landing even when logged in");
  else bad(`/ authed: status ${homeIn.status}`);
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nLANDING/PORTAL VERIFY: FAILED" : "\nLANDING/PORTAL VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
