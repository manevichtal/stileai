import { planForPriceId } from "./stripe";

export function billingFromSubscription(sub: any) {
  const item = sub?.items?.data?.[0];
  const priceId = item?.price?.id ?? "";
  return {
    stripe_subscription_id: sub.id as string,
    plan: planForPriceId(priceId),
    plan_seats: (item?.quantity as number) ?? 0,
    subscription_status: sub.status as string,
    current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
  };
}
