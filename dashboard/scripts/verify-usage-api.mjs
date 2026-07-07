// Verifies GET /api/usage: velocity counters derived from audit_log, for the
// key's org only. Seeds an org + api key + a few audit_log rows directly
// (bypassing the /api/audit route, since usage reads audit_log straight),
// hits the running dev server, asserts counts, then cleans up.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = "http://localhost:3000";
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

const rawKey = "sk_live_" + randomBytes(24).toString("hex");
const keyHash = createHash("sha256").update(rawKey).digest("hex");
const H = { Authorization: `Bearer ${rawKey}`, "Content-Type": "application/json" };

let orgId, failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };
const j = (r) => r.json();

try {
  // seed org + api key
  const { data: org } = await admin.from("organizations").insert({ name: "Usage API Test Org" }).select("id").single();
  orgId = org.id;
  await admin.from("api_keys").insert({
    org_id: orgId, label: "test", key_hash: keyHash, key_prefix: rawKey.slice(0, 12),
  });

  // seed audit_log rows: one money-velocity row (24h window), two 1h-window rows
  // for actor=agent:default.
  const now = Date.now();
  await admin.from("audit_log").insert([
    {
      org_id: orgId, decision_id: "usage-test-" + randomBytes(4).toString("hex"),
      ts: new Date(now - 2 * 3600_000).toISOString(), // 2h ago: inside 24h, outside 1h
      actor: "agent:other", action: "payment.charge", resource: "customer:1",
      params: { amount: 4000 }, effect: "allow", status: "completed",
    },
    {
      org_id: orgId, decision_id: "usage-test-" + randomBytes(4).toString("hex"),
      ts: new Date(now - 5 * 60_000).toISOString(), // 5m ago: inside 1h
      actor: "agent:default", action: "ticket.create", resource: "ticket:1",
      params: {}, effect: "allow", status: "completed",
    },
    {
      org_id: orgId, decision_id: "usage-test-" + randomBytes(4).toString("hex"),
      ts: new Date(now - 10 * 60_000).toISOString(), // 10m ago: inside 1h
      actor: "agent:default", action: "ticket.create", resource: "ticket:2",
      params: {}, effect: "allow", status: "completed",
    },
  ]);
  ok("seeded org, api key, 3 audit_log rows");

  // 1. auth rejection
  const noauth = await fetch(`${BASE}/api/usage?actor=agent:default`);
  if (noauth.status === 401) ok("401 on missing key");
  else bad(`expected 401 without key, got ${noauth.status}`);

  // 2. GET /api/usage with key
  const usage = await j(await fetch(`${BASE}/api/usage?actor=agent:default`, { headers: H }));
  const countOk = typeof usage.actor_action_count_1h === "number" && usage.actor_action_count_1h >= 2;
  const totalOk = typeof usage.daily_total === "number" && usage.daily_total >= 4000;
  if (countOk && totalOk) ok(`GET /api/usage -> ${JSON.stringify(usage)}`);
  else bad("GET /api/usage wrong: " + JSON.stringify(usage));
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  console.log("  cleanup done");
}
console.log(failed ? "\nUSAGE API VERIFY: FAILED" : "\nUSAGE API VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
