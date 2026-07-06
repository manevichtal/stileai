// Phase 3 verification: exercises all eight MCP-facing API routes against the
// running dev server with a real API key, checking shapes + auth. Cleans up.
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
  // seed org + settings + one policy + api key
  const { data: org } = await admin.from("organizations").insert({ name: "API Test Org" }).select("id").single();
  orgId = org.id;
  await admin.from("org_policy_settings").insert({
    org_id: orgId, default_effect: "require_approval",
    default_reason: "No policy matched — defaulting to human approval.",
  });
  await admin.from("policies").insert({
    org_id: orgId, policy_id: "approve-large-payments", effect: "require_approval",
    priority: 41, actor: "*", action: "payment.charge", resource: "*",
    approvals_required: 1,
    conditions: [{ field: "amount", op: "gt", value: 100 }],
    description: "Charges over $100 require one human approval.", enabled: true,
  });
  await admin.from("api_keys").insert({
    org_id: orgId, label: "test", key_hash: keyHash, key_prefix: rawKey.slice(0, 12),
  });
  ok("seeded org, settings, policy, api key");

  // 1. auth rejection
  const noauth = await fetch(`${BASE}/api/policies`);
  const badauth = await fetch(`${BASE}/api/policies`, { headers: { Authorization: "Bearer sk_live_wrong" } });
  if (noauth.status === 401 && badauth.status === 401) ok("401 on missing + wrong key");
  else bad(`auth: missing=${noauth.status} wrong=${badauth.status} (expected 401/401)`);

  // 2. GET /api/policies shape
  const pol = await j(await fetch(`${BASE}/api/policies`, { headers: H }));
  const p0 = pol.policies?.[0];
  const shapeOk = pol.default_effect === "require_approval" && p0 &&
    p0.id === "approve-large-payments" && p0.effect === "require_approval" &&
    p0.priority === 41 && Array.isArray(p0.conditions) && p0.conditions[0].op === "gt";
  if (shapeOk) ok("GET /api/policies returns engine-shaped ruleset");
  else bad("GET /api/policies shape wrong: " + JSON.stringify(pol));

  // 3. GET /api/policies/version
  const ver1 = await j(await fetch(`${BASE}/api/policies/version`, { headers: H }));
  if (ver1.version && typeof ver1.version === "string") ok(`GET /api/policies/version -> ${ver1.version}`);
  else bad("version missing: " + JSON.stringify(ver1));

  // version bumps when a policy changes
  await admin.from("policies").update({ description: "edited" }).eq("org_id", orgId).eq("policy_id", "approve-large-payments");
  const ver2 = await j(await fetch(`${BASE}/api/policies/version`, { headers: H }));
  if (Number(ver2.version) > Number(ver1.version)) ok(`version bumped on edit (${ver1.version} -> ${ver2.version})`);
  else bad(`version did NOT bump: ${ver1.version} -> ${ver2.version}`);

  // 4. POST /api/audit then GET
  const decisionId = "dec-" + randomBytes(6).toString("hex");
  const auditPost = await fetch(`${BASE}/api/audit`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      decision_id: decisionId, timestamp: new Date().toISOString(),
      actor: "agent:support-bot", action: "payment.charge", resource: "customer:1234",
      params: { amount: 5000, card_number: "***REDACTED***" },
      effect: "require_approval", matched_policy: "approve-large-payments",
      reason: "Charges over $100 require one human approval.", status: "pending",
    }),
  });
  if (auditPost.status === 201) ok("POST /api/audit accepted (201)");
  else bad("POST /api/audit status " + auditPost.status);

  const auditRows = await j(await fetch(`${BASE}/api/audit?limit=10&actor=agent:support-bot`, { headers: H }));
  const a0 = auditRows.find((r) => r.decision_id === decisionId);
  if (a0 && a0.timestamp && a0.params.card_number === "***REDACTED***" && a0.effect === "require_approval")
    ok("GET /api/audit returns the entry (redaction preserved, ts as `timestamp`)");
  else bad("GET /api/audit wrong: " + JSON.stringify(auditRows));

  // 5. POST /api/approvals then GET list + single
  await fetch(`${BASE}/api/approvals`, {
    method: "POST", headers: H,
    body: JSON.stringify({
      decision_id: decisionId, actor: "agent:support-bot", action: "payment.charge",
      resource: "customer:1234", params: { amount: 5000 },
      reason: "Charges over $100 require one human approval.",
      matched_policy: "approve-large-payments", approvals_required: 1,
      status: "pending", approvals: [],
    }),
  });
  const pending = await j(await fetch(`${BASE}/api/approvals?status=pending`, { headers: H }));
  const single = await j(await fetch(`${BASE}/api/approvals/${decisionId}`, { headers: H }));
  if (pending.some((p) => p.decision_id === decisionId) && single.decision_id === decisionId && single.status === "pending")
    ok("POST + GET /api/approvals (list + single) work");
  else bad("approvals list/single wrong: " + JSON.stringify({ pending, single }));

  // 6. resolve -> approved
  const resolved = await j(await fetch(`${BASE}/api/approvals/${decisionId}/resolve`, {
    method: "POST", headers: H,
    body: JSON.stringify({ approver: "user:manager", approved: true, note: "verified with finance" }),
  }));
  if (resolved.status === "approved" && resolved.approvals.length === 1) ok("resolve -> status approved, vote recorded");
  else bad("resolve wrong: " + JSON.stringify(resolved));

  // audit row mirrored to approved
  const auditAfter = await j(await fetch(`${BASE}/api/audit?limit=10`, { headers: H }));
  const mirror = auditAfter.find((r) => r.decision_id === decisionId);
  if (mirror?.status === "approved") ok("audit row status mirrored to approved");
  else bad("audit mirror status: " + JSON.stringify(mirror?.status));
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  if (orgId) await admin.from("organizations").delete().eq("id", orgId);
  console.log("  cleanup done");
}
console.log(failed ? "\nPHASE 3 API VERIFY: FAILED" : "\nPHASE 3 API VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
