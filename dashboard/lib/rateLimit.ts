import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/apiKeys";

// Fixed-window rate limiting backed by the rate_limits table + rate_limit_hit()
// RPC (see supabase/migration_rate_limits.sql). Every check is one atomic round
// trip. It FAILS OPEN: if the RPC errors or the migration hasn't been applied
// yet, the request is allowed — a limiter must never become an outage or a DoS
// vector of its own. Abuse protection degrades gracefully; correctness does not.

export type RateLimitResult = { allowed: boolean; retryAfter: number };

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) return { allowed: true, retryAfter: 0 };
    return { allowed: data === true, retryAfter: data === true ? 0 : windowSeconds };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

// Best-effort client IP for unauthenticated endpoints (login, redeem). Behind
// Vercel the real client is the first entry in x-forwarded-for.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// A stable, non-reversible bucket id for an API key (never store the raw key).
export function keyBucket(prefix: string, rawKey: string): string {
  return `${prefix}:${hashApiKey(rawKey).slice(0, 32)}`;
}

// 429 response with a Retry-After header. `extra` merges in any CORS headers the
// caller already uses so preflight/cross-origin behavior is unchanged.
export function tooManyRequests(retryAfter: number, extra: Record<string, string> = {}) {
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded. Slow down and try again shortly." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, retryAfter)),
        ...extra,
      },
    },
  );
}
