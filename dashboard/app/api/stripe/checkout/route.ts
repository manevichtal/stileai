import { stripe, priceIdForPlan, PLANS, type PlanId } from "@/lib/stripe";
import { getProfileContext } from "@/lib/getProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stileai.vercel.app";

export async function POST(req: Request) {
  const ctx = await getProfileContext();
  if (!ctx) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (ctx.role !== "admin") return new Response(JSON.stringify({ error: "Only an admin can start billing." }), { status: 403, headers: { "Content-Type": "application/json" } });
  const orgId = ctx.orgId; // derive from the session — never trust the client body
  const { plan, seats } = await req.json();
  const price = priceIdForPlan(plan as PlanId);
  const min = PLANS[plan as PlanId]?.minSeats ?? 1;
  if (!price) return new Response(JSON.stringify({ error: "Choose Starter or Business (Enterprise is contact-sales)." }), { status: 400, headers: { "Content-Type": "application/json" } });
  const qty = Math.max(min, Number(seats) || min);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription", client_reference_id: orgId,
    line_items: [{ price, quantity: qty }],
    success_url: `${APP_URL}/dashboard`, cancel_url: `${APP_URL}/billing/inactive`,
  });
  return new Response(JSON.stringify({ url: session.url }), { headers: { "Content-Type": "application/json" } });
}
