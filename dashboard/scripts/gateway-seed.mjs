// Task 9 gateway e2e: seed or clean up the fixtures the enforced-gateway
// end-to-end test drives against (org + policy settings + 3 policies + an
// api key + one `connected_tools` row pointing at the stdio sample server).
//
// Default mode (no args): seed a fresh org and print exactly one JSON line
// as the LAST line of stdout: {"orgId":"...","apiKey":"sk_live_...","token":"..."}
// so a controller/orchestrator script can capture it.
//
// Cleanup mode: `node gateway-seed.mjs --cleanup <orgId>` deletes the org;
// FK `on delete cascade` removes org_policy_settings/policies/api_keys/
// connected_tools rows with it.
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SVC, { auth: { persistSession: false } });

const POLICIES = [
  { policy_id: "allow-read", effect: "allow", priority: 10, action: "read_data" },
  { policy_id: "deny-delete", effect: "deny", priority: 10, action: "delete_records" },
  {
    policy_id: "approve-charge", effect: "require_approval", priority: 10,
    action: "charge_card", approvals_required: 1,
  },
];

async function seed() {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: "Gateway E2E Org" })
    .select("id")
    .single();
  if (orgErr) throw new Error("org insert failed: " + orgErr.message);
  const orgId = org.id;

  const { error: settingsErr } = await admin.from("org_policy_settings").insert({
    org_id: orgId,
    default_effect: "deny",
    default_reason: "No policy matched — defaulting to deny (gateway e2e).",
  });
  if (settingsErr) throw new Error("org_policy_settings insert failed: " + settingsErr.message);

  for (const p of POLICIES) {
    const { error } = await admin.from("policies").insert({
      org_id: orgId, actor: "*", resource: "*", enabled: true, ...p,
    });
    if (error) throw new Error(`policy '${p.policy_id}' insert failed: ` + error.message);
  }

  const rawKey = "sk_live_" + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const { error: keyErr } = await admin.from("api_keys").insert({
    org_id: orgId, label: "gateway-e2e", key_hash: keyHash, key_prefix: rawKey.slice(0, 12),
  });
  if (keyErr) throw new Error("api_keys insert failed: " + keyErr.message);

  // SAMPLE_CMD is a JSON-array string, e.g. ["C:/.../python.exe","-m","sample_tools.server"]
  // — the controller passes the venv's absolute python so stdio launch works
  // regardless of PATH/cwd when the gateway process spawns it.
  const target = process.env.SAMPLE_CMD || JSON.stringify(["python", "-m", "sample_tools.server"]);
  const { error: toolErr } = await admin.from("connected_tools").insert({
    org_id: orgId, name: "sample", transport: "stdio", target, auth: null, enabled: true,
  });
  if (toolErr) throw new Error("connected_tools insert failed: " + toolErr.message);

  const token = process.env.GW_TOKEN || randomBytes(24).toString("hex");

  // Exactly one JSON line, last line of stdout — the controller parses this.
  console.log(JSON.stringify({ orgId, apiKey: rawKey, token }));
}

async function cleanup(orgId) {
  if (!orgId) {
    console.error("usage: node gateway-seed.mjs --cleanup <orgId>");
    process.exit(1);
  }
  const { error } = await admin.from("organizations").delete().eq("id", orgId);
  if (error) {
    console.error("cleanup failed: " + error.message);
    process.exit(1);
  }
  console.log("cleaned " + orgId);
}

const args = process.argv.slice(2);
try {
  if (args[0] === "--cleanup") {
    await cleanup(args[1]);
  } else {
    await seed();
  }
} catch (err) {
  console.error("gateway-seed failed: " + (err.message || err));
  process.exit(1);
}
