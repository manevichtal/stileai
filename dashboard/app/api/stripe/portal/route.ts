import { stripe } from "@/lib/stripe";
import { getProfileContext } from "@/lib/getProfile";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://stileai.com";

export async function POST() {
  const ctx = await getProfileContext();
  if (!ctx) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });
  if (ctx.role !== "admin") return new Response(JSON.stringify({ error: "Only an admin can manage billing." }), { status: 403, headers: { "Content-Type": "application/json" } });
  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("stripe_customer_id").eq("id", ctx.orgId).maybeSingle();
  if (!org?.stripe_customer_id) return new Response(JSON.stringify({ error: "No billing account yet." }), { status: 400, headers: { "Content-Type": "application/json" } });
  const s = await stripe.billingPortal.sessions.create({ customer: org.stripe_customer_id, return_url: `${APP_URL}/billing` });
  return new Response(JSON.stringify({ url: s.url }), { headers: { "Content-Type": "application/json" } });
}
