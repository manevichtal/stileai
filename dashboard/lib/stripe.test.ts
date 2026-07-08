import { describe, it, expect, beforeEach } from "vitest";
import { PLANS, priceIdForPlan, planForPriceId } from "./stripe";

beforeEach(() => { process.env.STRIPE_PRICE_STARTER = "price_S"; process.env.STRIPE_PRICE_BUSINESS = "price_B"; });

describe("plans", () => {
  it("has per-seat pricing", () => {
    expect(PLANS.starter.perSeat).toBe(25);
    expect(PLANS.business.perSeat).toBe(59);
    expect(PLANS.enterprise.perSeat).toBeNull();
  });
  it("maps plan -> price id and back", () => {
    expect(priceIdForPlan("starter")).toBe("price_S");
    expect(planForPriceId("price_B")).toBe("business");
    expect(planForPriceId("price_unknown")).toBeNull();
    expect(priceIdForPlan("enterprise")).toBeNull();
  });
});
