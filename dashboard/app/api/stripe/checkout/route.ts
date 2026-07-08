import { stripe, priceIdForPlan, PLANS, type PlanId } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { orgId, plan, seats } = await req.json();
  const price = priceIdForPlan(plan as PlanId);
  const min = PLANS[plan as PlanId]?.minSeats ?? 1;
  if (!price) {
    return new Response(JSON.stringify({ error: "Choose Starter or Business (Enterprise is contact-sales)." }), { status: 400 });
  }
  const qty = Math.max(min, Number(seats) || min);
  const origin = req.headers.get("origin") ?? "https://stileai.vercel.app";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: orgId,
    line_items: [{ price, quantity: qty }],
    success_url: `${origin}/dashboard`,
    cancel_url: `${origin}/billing/inactive`,
  });
  return new Response(JSON.stringify({ url: session.url }), { headers: { "Content-Type": "application/json" } });
}
