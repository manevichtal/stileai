import { stripe, priceIdForPlan, PLANS, type PlanId } from "@/lib/stripe";
import { getProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stileai.com";
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function POST(req: Request) {
  const ctx = await getProfileContext();
  if (!ctx) return json({ error: "Not signed in." }, 401);
  if (ctx.role !== "admin") return json({ error: "Only an admin can start billing." }, 403);

  let plan: string | undefined;
  let seats: unknown;
  try {
    ({ plan, seats } = await req.json());
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!plan || !(plan in PLANS) || plan === "enterprise") {
    return json({ error: "Choose Starter or Business (Enterprise is contact-sales)." }, 400);
  }
  const price = priceIdForPlan(plan as PlanId);
  if (!price) return json({ error: "This plan is not available for self-serve checkout." }, 400);

  const min = PLANS[plan as PlanId].minSeats ?? 1;
  const qty = Math.min(Math.max(min, Number(seats) || min), 1000);

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("stripe_customer_id, subscription_status")
    .eq("id", ctx.orgId)
    .maybeSingle();
  if (org?.subscription_status === "active" || org?.subscription_status === "trialing") {
    return json({ error: "This organization already has an active subscription. Manage it from Billing." }, 400);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: ctx.orgId,
    ...(org?.stripe_customer_id ? { customer: org.stripe_customer_id } : {}),
    line_items: [{ price, quantity: qty }],
    success_url: `${APP_URL}/dashboard`,
    cancel_url: `${APP_URL}/complete-setup`,
  });
  return json({ url: session.url });
}
