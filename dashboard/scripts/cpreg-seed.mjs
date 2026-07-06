import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: org } = await admin.from("organizations").insert({ name: "CP Reg Test" }).select("id").single();
await admin.from("org_policy_settings").insert({ org_id: org.id });
const rawKey = "sk_live_" + randomBytes(24).toString("hex");
await admin.from("api_keys").insert({ org_id: org.id, label: "cpreg", key_hash: createHash("sha256").update(rawKey).digest("hex"), key_prefix: rawKey.slice(0, 12) });
writeFileSync(process.argv[2], JSON.stringify({ orgId: org.id, apiKey: rawKey }));
console.log("seeded org " + org.id);
