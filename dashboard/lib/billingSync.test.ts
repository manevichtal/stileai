import { describe, it, expect, beforeEach } from "vitest";
import { billingFromSubscription } from "./billingSync";

beforeEach(() => { process.env.STRIPE_PRICE_BUSINESS = "price_B"; });

it("maps a subscription to org billing columns", () => {
  const sub: any = { id: "sub_1", status: "active",
    items: { data: [{ quantity: 7, price: { id: "price_B" }, current_period_end: 1893456000 }] } };
  const b = billingFromSubscription(sub);
  expect(b.stripe_subscription_id).toBe("sub_1");
  expect(b.plan).toBe("business");
  expect(b.plan_seats).toBe(7);
  expect(b.subscription_status).toBe("active");
  expect(b.current_period_end).toContain("2030"); // epoch 1893456000 -> 2030
});
