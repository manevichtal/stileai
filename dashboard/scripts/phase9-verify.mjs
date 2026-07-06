// Phase 9 independent verification: confirm straight from Supabase that the LIVE
// checkpoint's decisions landed in the owner's org, with redaction + a pending approval.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = (process.argv[2] || "manevichtal@gmail.com").toLowerCase();
let failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

const { data: prof } = await admin.from("profiles").select("org_id, organizations(name)").ilike("email", email).maybeSingle();
if (!prof) { console.log("no org for " + email); process.exit(1); }
const orgId = prof.org_id;
console.log("org: " + prof.organizations?.name + " (" + orgId + ")");

const { data: audit } = await admin.from("audit_log").select("*").eq("org_id", orgId).order("ts", { ascending: false }).limit(20);
const byPolicy = (p) => (audit ?? []).find((r) => r.matched_policy === p);
if (byPolicy("allow-reads")?.effect === "allow") ok("live allow decision persisted (allow-reads)"); else bad("allow decision missing");
if (byPolicy("deny-prod-db-drop")?.effect === "deny") ok("live deny decision persisted (deny-prod-db-drop)"); else bad("deny decision missing");
const large = byPolicy("approve-large-payments");
if (large?.effect === "require_approval") ok("live require_approval decision persisted"); else bad("approval decision missing");
if (large?.params?.card_number === "***REDACTED***" && large?.params?.amount === 5000) ok("SECRET REDACTED live: card_number = ***REDACTED*** (amount 5000 kept)"); else bad("redaction failed: " + JSON.stringify(large?.params));

const { data: pending } = await admin.from("approvals").select("*").eq("org_id", orgId).eq("status", "pending");
if ((pending ?? []).some((a) => a.matched_policy === "approve-large-payments")) ok(`approvals queue holds ${pending.length} pending decision(s) awaiting a human`); else bad("no pending approval found");

console.log(failed ? "\nPHASE 9 DB VERIFY: FAILED" : "\nPHASE 9 DB VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
