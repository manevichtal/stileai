import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

export type PlanId = "starter" | "business" | "enterprise";

export const PLANS: Record<PlanId, { id: PlanId; label: string; perSeat: number | null; minSeats: number | null; priceEnv: string | null }> = {
  starter:    { id: "starter",    label: "Starter",    perSeat: 25,   minSeats: 5, priceEnv: "STRIPE_PRICE_STARTER" },
  business:   { id: "business",   label: "Business",   perSeat: 59,   minSeats: 1, priceEnv: "STRIPE_PRICE_BUSINESS" },
  enterprise: { id: "enterprise", label: "Enterprise", perSeat: null, minSeats: null, priceEnv: null },
};

export function priceIdForPlan(plan: PlanId): string | null {
  const p = PLANS[plan];
  return p.priceEnv ? (process.env[p.priceEnv] ?? null) : null;
}

export function planForPriceId(priceId: string): PlanId | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_STARTER) return "starter";
  if (priceId && priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return null;
}
