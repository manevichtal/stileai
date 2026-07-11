import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/health — a lightweight status probe for monitoring and a "degraded mode"
// banner. Reports whether the database is reachable and whether deep inspection is
// configured. No secrets, no auth: it exposes only up/down status, never data.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "up" | "down" = "down";
  try {
    const admin = createAdminClient();
    // Cheapest possible round-trip: a head count on a tiny table.
    const { error } = await admin.from("organizations").select("id", { count: "exact", head: true }).limit(1);
    database = error ? "down" : "up";
  } catch {
    database = "down";
  }

  const deepInspection = process.env.ANTHROPIC_API_KEY ? "configured" : "off";
  // The core deterministic checks run in-process and have no external dependency, so
  // as long as the app is serving this response they are available.
  const localChecks = "up";

  const ok = database === "up";
  return new Response(
    JSON.stringify({ ok, checks: { database, localChecks, deepInspection }, ts: new Date().toISOString() }),
    { status: ok ? 200 : 503, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
