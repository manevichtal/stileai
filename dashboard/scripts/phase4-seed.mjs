// Phase 4 step 1: seed a test org with the reference policies + an API key, so the
// real MCP (api mode) can pull them. Writes {orgId, apiKey} for the next steps.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const HANDOFF = process.argv[2];

const POLICIES = [
  { policy_id: "deny-prod-db-drop", effect: "deny", priority: 10, action: "db.drop*", description: "Dropping tables/databases is never allowed via an agent." },
  { policy_id: "deny-mass-delete", effect: "deny", priority: 15, action: "db.delete", resource: "table:*", description: "Table-level deletes are blocked; delete specific records only." },
  { policy_id: "allow-admin-writes", effect: "allow", priority: 20, actor: "user:admin*", action: "db.*", description: "Admin users may perform database writes (except hard-denied)." },
  { policy_id: "allow-reads", effect: "allow", priority: 30, action: "*.read", description: "Read-only actions are permitted for any actor." },
  { policy_id: "allow-small-payments", effect: "allow", priority: 40, action: "payment.charge", conditions: [{ field: "amount", op: "lte", value: 100 }], description: "Charges of $100 or less are auto-approved." },
  { policy_id: "approve-large-payments", effect: "require_approval", priority: 41, action: "payment.charge", approvals_required: 1, conditions: [{ field: "amount", op: "gt", value: 100 }], description: "Charges over $100 require one human approval." },
  { policy_id: "approve-external-email", effect: "require_approval", priority: 51, action: "email.send", approvals_required: 1, description: "Email to external addresses requires approval." },
];

const { data: org } = await admin.from("organizations").insert({ name: "StileAI Loop Test" }).select("id").single();
await admin.from("org_policy_settings").insert({
  org_id: org.id, default_effect: "require_approval",
  default_reason: "No policy matched — defaulting to human approval (fail-safe).",
});
for (const p of POLICIES) {
  await admin.from("policies").insert({ org_id: org.id, actor: "*", action: "*", resource: "*", ...p });
}
const rawKey = "sk_live_" + randomBytes(24).toString("hex");
await admin.from("api_keys").insert({
  org_id: org.id, label: "phase4-loop-test",
  key_hash: createHash("sha256").update(rawKey).digest("hex"),
  key_prefix: rawKey.slice(0, 12),
});

writeFileSync(HANDOFF, JSON.stringify({ orgId: org.id, apiKey: rawKey }, null, 2));
console.log("seeded org " + org.id + " with " + POLICIES.length + " policies + api key");
