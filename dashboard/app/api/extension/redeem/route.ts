import { redeemInvite } from "@/lib/employees";

// POST /api/extension/redeem  <- { token }
// Redeems a one-time connect link: mints the seat's key and returns it once so the
// browser extension can store it. Authenticated by the token itself (invited users
// may not have a dashboard login), so this route is intentionally public.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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
