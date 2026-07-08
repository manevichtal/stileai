import { stripe } from "@/lib/stripe";
import { requireProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await requireProfileContext();
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("stripe_customer_id").eq("id", ctx.orgId).maybeSingle();
  if (!org?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: "No billing account yet." }), { status: 400 });
  }
  const origin = req.headers.get("origin") ?? "https://stileai.vercel.app";
  const s = await stripe.billingPortal.sessions.create({ customer: org.stripe_customer_id, return_url: `${origin}/billing` });
  return new Response(JSON.stringify({ url: s.url }), { headers: { "Content-Type": "application/json" } });
}
