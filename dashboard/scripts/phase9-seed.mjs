// Phase 9: seed a small starter policy set into the owner's org so the LIVE
// checkpoint demonstrates allow / deny / require_approval. Idempotent.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = (process.argv[2] || "manevichtal@gmail.com").toLowerCase();

const { data: prof } = await admin.from("profiles").select("org_id, organizations(name)").ilike("email", email).maybeSingle();
if (!prof) { console.log("no org for " + email); process.exit(1); }
const orgId = prof.org_id;

const POLICIES = [
  { policy_id: "deny-prod-db-drop", effect: "deny", priority: 10, action: "db.drop*", description: "Dropping tables/databases is never allowed via an agent." },
  { policy_id: "allow-reads", effect: "allow", priority: 30, action: "*.read", description: "Read-only actions are permitted for any actor." },
  { policy_id: "approve-large-payments", effect: "require_approval", priority: 41, action: "payment.charge", approvals_required: 1, conditions: [{ field: "amount", op: "gt", value: 100 }], description: "Charges over $100 require one human approval." },
];
for (const p of POLICIES) {
  await admin.from("policies").upsert({ org_id: orgId, actor: "*", action: "*", resource: "*", enabled: true, ...p }, { onConflict: "org_id,policy_id" });
}
const { data: org } = await admin.from("organizations").select("policy_version").eq("id", orgId).single();
console.log(JSON.stringify({ org: prof.organizations?.name, org_id: orgId, seeded: POLICIES.length, policy_version: org.policy_version }));
