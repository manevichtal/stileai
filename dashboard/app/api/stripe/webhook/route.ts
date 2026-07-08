import { stripe } from "@/lib/stripe";
import { billingFromSubscription } from "@/lib/billingSync";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature") ?? "";
  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  const admin = createAdminClient();
  if (event.type === "checkout.session.completed") {
    const s: any = event.data.object;
    const orgId = s.client_reference_id;
    const sub: any = await stripe.subscriptions.retrieve(s.subscription);
    await admin.from("organizations").update({ stripe_customer_id: s.customer, ...billingFromSubscription(sub) }).eq("id", orgId);
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub: any = event.data.object;
    const patch = event.type === "customer.subscription.deleted"
      ? { subscription_status: "canceled" } : billingFromSubscription(sub);
    await admin.from("organizations").update(patch).eq("stripe_subscription_id", sub.id);
  }
  return new Response("ok", { status: 200 });
}
