import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const info = JSON.parse(readFileSync(process.argv[2], "utf8"));
const expected = process.argv[3];
const { data } = await admin.from("organizations").select("checkpoint_url").eq("id", info.orgId).single();
const okReg = data?.checkpoint_url === expected;
console.log(okReg ? `  OK  checkpoint self-registered its URL: ${data.checkpoint_url}` : `  BAD  expected ${expected}, got ${data?.checkpoint_url}`);
await admin.from("organizations").delete().eq("id", info.orgId);
console.log("  cleanup done");
console.log(okReg ? "\nSELF-REGISTER: PASSED" : "\nSELF-REGISTER: FAILED");
process.exit(okReg ? 0 : 1);
