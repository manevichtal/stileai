// Phase 4 final step: independently confirm (straight from Supabase) that the
// decisions the real MCP made actually landed — audit rows, secret redaction,
// and the pending-approval queue — then delete the test org.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const info = JSON.parse(readFileSync(process.argv[2], "utf8"));
const orgId = info.orgId;
let failed = false;
const ok = (m) => console.log("  OK  " + m);
const bad = (m) => { console.log("  BAD " + m); failed = true; };

try {
  const { data: audit } = await admin
    .from("audit_log").select("*").eq("org_id", orgId).order("ts", { ascending: false });
  if ((audit?.length ?? 0) >= 6) ok(`audit_log has ${audit.length} decisions for the org`);
  else bad(`expected >=6 audit rows, got ${audit?.length}`);

  const deny = audit.find((r) => r.matched_policy === "deny-prod-db-drop");
  if (deny?.effect === "deny") ok("deny decision persisted (db.drop* -> deny)");
  else bad("deny decision missing");

  const large = audit.find((r) => r.matched_policy === "approve-large-payments");
  if (large && large.effect === "require_approval") ok("large-payment decision persisted (require_approval)");
  else bad("large-payment audit row missing");
  if (large && large.params?.card_number === "***REDACTED***" && large.params?.amount === 5000)
    ok("SECRET REDACTED in audit: card_number = ***REDACTED*** (amount kept)");
  else bad("redaction failed: " + JSON.stringify(large?.params));

  const { data: approvals } = await admin
    .from("approvals").select("*").eq("org_id", orgId).eq("status", "pending");
  const hasLarge = approvals?.some((a) => a.matched_policy === "approve-large-payments");
  const hasEmail = approvals?.some((a) => a.matched_policy === "approve-external-email");
  if (hasLarge && hasEmail) ok(`approvals queue holds the ${approvals.length} pending decisions`);
  else bad("pending approvals missing: " + JSON.stringify(approvals?.map((a) => a.matched_policy)));
} catch (err) {
  bad("exception: " + (err.message || err));
} finally {
  await admin.from("organizations").delete().eq("id", orgId);
  console.log("  cleanup done (test org deleted)");
}
console.log(failed ? "\nPHASE 4 DB VERIFY: FAILED" : "\nPHASE 4 DB VERIFY: ALL CHECKS PASSED");
process.exit(failed ? 1 : 0);
