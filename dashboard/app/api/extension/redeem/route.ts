import { redeemInvite } from "@/lib/employees";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// POST /api/extension/redeem  <- { token }
// Redeems a one-time connect link: mints the seat's key and returns it once so the
// browser extension can store it. Authenticated by the token itself (invited users
// may not have a dashboard login), so this route is intentionally public.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // The token is the only credential here, so throttle by IP to stop guessing.
  const rl = await rateLimit(`redeem:${clientIp(req)}`, 20, 60);
  if (!rl.allowed) {
    return Response.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { token?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
  const token = typeof body?.token === "string" ? body.token : "";
  const seat = await redeemInvite(token);
  if (!seat) {
    return Response.json(
      { error: "This connect link is invalid or has already been used. Ask your admin to re-issue it." },
      { status: 400 },
    );
  }
  return Response.json({ key: seat.key, label: seat.label });
}
