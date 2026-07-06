// Operator helper: find the org for a given owner email and mint one API key for
// it (stores only the hash; prints the raw key once). Used to unblock the Render
// deploy when the owner can't log in yet. Usage: node scripts/mint-key.mjs <email> [label]
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const email = (process.argv[2] || "").trim().toLowerCase();
const label = process.argv[3] || "render-checkpoint";

const { data: prof } = await admin
  .from("profiles")
  .select("org_id, email, organizations(name)")
  .ilike("email", email)
  .maybeSingle();

if (!prof) {
  // maybe the auth user exists but has no profile/org
  const { data: list } = await admin.auth.admin.listUsers();
  const u = (list?.users ?? []).find((x) => (x.email || "").toLowerCase() === email);
  console.log(JSON.stringify({ found: false, authUserExists: !!u, note: u ? "auth user exists but has NO profile/org (signup didn't finish)" : "no such user" }, null, 2));
  process.exit(0);
}

const raw = "sk_live_" + randomBytes(24).toString("hex");
const { error } = await admin.from("api_keys").insert({
  org_id: prof.org_id,
  label,
  key_hash: createHash("sha256").update(raw).digest("hex"),
  key_prefix: raw.slice(0, 12),
});
if (error) { console.log(JSON.stringify({ found: true, minted: false, error: error.message })); process.exit(1); }

console.log(JSON.stringify({
  found: true,
  minted: true,
  org: prof.organizations?.name,
  org_id: prof.org_id,
  api_key: raw,
}, null, 2));
