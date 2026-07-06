// Phase 2 verification (part 2): confirms the AUTHENTICATED home page renders the
// Overview for a logged-in admin. Logs in, captures the real @supabase/ssr session
// cookies, replays them against the running dev server, and checks the response.
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
const email = `phase2-page-${Date.now()}@stileai-verify.local`;
const password = "verify-password-123";
const ORG = "Overview Test Org";
let userId, orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  // onboard
  const { data: created } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = created.user.id;
  const { data: org } = await admin.from("organizations").insert({ name: ORG }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({ org_id: orgId });
  await admin.from("profiles").insert({ id: userId, org_id: orgId, role: "admin", email });
  ok("onboarded test admin");

  // sign in to get session tokens
  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signin, error } = await pub.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // use @supabase/ssr to serialize the session into the exact cookies the server reads
  const jar = new Map();
  const ssr = createServerClient(URL, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await ssr.auth.setSession({
    access_token: signin.session.access_token,
    refresh_token: signin.session.refresh_token,
  });
  const cookieHeader = [...jar.entries()]
    .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
    .join("; ");
  if (!cookieHeader) throw new Error("no session cookies were produced");
  ok(`captured ${jar.size} session cookie(s)`);

  // request the protected home page WITH the session
  const res = await fetch(BASE + "/", { headers: { cookie: cookieHeader }, redirect: "manual" });
  const body = await res.text();
  const rendersOverview = body.includes("Overview") && body.includes(ORG);
  const notLogin = !body.includes("Create account");
  if (res.status === 200 && rendersOverview && notLogin) {
    ok(`authenticated / renders Overview for "${ORG}" (HTTP 200)`);
  } else {
    bad(`authenticated / did not render Overview (status ${res.status}, hasOrg=${body.includes(ORG)}, hasOverview=${body.includes("Overview")}, looksLikeLogin=${body.includes("Create account")})`);
  }
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log("  cleanup done");
}
console.log(failed ? "\nAUTH PAGE VERIFY: FAILED" : "\nAUTH PAGE VERIFY: PASSED");
process.exit(failed ? 1 : 0);
