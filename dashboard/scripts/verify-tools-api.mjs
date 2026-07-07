// Verifies GET /api/tools: the config feed the gateway pulls on startup.
// Seeds an org + api key + one connected_tools row, hits the route with and
// without the key, checks shapes + auth. Cleans up.
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
  // seed org + api key + one connected_tools row
  const { data: org } = await admin.from("organizations").insert({ name: "Tools API Test Org" }).select("id").single();
  orgId = org.id;
  await admin.from("api_keys").insert({
    org_id: orgId, label: "test", key_hash: keyHash, key_prefix: rawKey.slice(0, 12),
  });
  await admin.from("connected_tools").insert({
    org_id: orgId, name: "sample", transport: "stdio", target: "[]", auth: null, enabled: true,
  });
  ok("seeded org, api key, connected_tools row");

  // 1. 401 without a key
  const noauth = await fetch(`${BASE}/api/tools`);
  if (noauth.status === 401) ok("401 on missing key");
  else bad(`expected 401 without key, got ${noauth.status}`);

  // 2. 200 with the key, correct tool returned
  const res = await fetch(`${BASE}/api/tools`, { headers: H });
  const body = await j(res);
  const t0 = body.tools?.find((t) => t.name === "sample");
  if (res.status === 200 && t0 && t0.transport === "stdio" && t0.enabled === true)
    ok("GET /api/tools returns the seeded tool (200)");
  else bad("GET /api/tools wrong: status=" + res.status + " body=" + JSON.stringify(body));
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  console.log("  cleanup done");
}
console.log(failed ? "\nFAILED" : "\nALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
