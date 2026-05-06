import Stripe from "stripe";

export const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID!;
export const STRIPE_PRO_ANNUAL_PRICE_ID = process.env.STRIPE_PRO_ANNUAL_PRICE_ID;

export type CheckoutPlan = "monthly" | "annual";

export function priceIdForPlan(plan: CheckoutPlan): string {
  if (plan === "annual") {
    if (!STRIPE_PRO_ANNUAL_PRICE_ID) {
      throw new Error("STRIPE_PRO_ANNUAL_PRICE_ID is not set");
    }
    return STRIPE_PRO_ANNUAL_PRICE_ID;
  }
  return STRIPE_PRO_PRICE_ID;
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-04-22.dahlia",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop];
  },
});
