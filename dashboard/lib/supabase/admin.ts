import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client. BYPASSES Row Level Security — server-side ONLY.
// Never import this into a Client Component. Every query made with it MUST filter
// by org_id explicitly (see CLAUDE.md section 5). Used for:
//   - onboarding a brand-new user (create org + profile before they have one)
//   - the MCP-facing API routes, which authenticate by API key, not a session.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
