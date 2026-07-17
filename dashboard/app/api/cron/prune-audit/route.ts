import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/cron/prune-audit — daily retention job (scheduled in vercel.json).
// Deletes audit rows older than AUDIT_RETENTION_DAYS (default 90) via the
// prune_audit_log() function from migration_hardening.sql. Protected by
// CRON_SECRET: Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically
// when that env var is set, so an outsider cannot trigger a purge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = Number(process.env.AUDIT_RETENTION_DAYS || "90");

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== "Bearer " + secret) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("prune_audit_log", { p_days: RETENTION_DAYS });
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, deleted: data, days: RETENTION_DAYS }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
