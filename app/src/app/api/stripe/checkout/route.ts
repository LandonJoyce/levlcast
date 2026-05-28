/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the Pro subscription and returns
 * the hosted checkout URL. The client redirects to it immediately.
 */

export const dynamic = "force-dynamic";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe, priceIdForPlan, type CheckoutPlan } from "@/lib/stripe";
import { computeTrialDiscountStatus } from "@/lib/trial-discount";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

const REFERRAL_COOKIE = "lc_promo";

/**
 * Look up a Stripe promotion code by its customer-facing code text and
 * return the promo_xxx id (which is what checkout sessions accept on
 * the `discounts` field). Returns null when the code isn't found, isn't
 * active, or Stripe is unavailable — we never want a bad referral cookie
 * to break the checkout flow.
 */
async function resolvePromotionCodeId(code: string): Promise<string | null> {
  try {
    const res = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    return res.data[0]?.id ?? null;
  } catch (err) {
    console.warn("[stripe/checkout] promo lookup failed for", code, err instanceof Error ? err.message : err);
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let plan: CheckoutPlan = "monthly";
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.plan === "annual") plan = "annual";
    else if (body?.plan === "pro_plus") plan = "pro_plus";
    else if (body?.plan === "pro_plus_annual") plan = "pro_plus_annual";
  } catch {
    // No body — default to monthly
  }

  // Partner referral attribution: if the visitor arrived via /r/[code]
  // their referral cookie is set. Look up the corresponding Stripe
  // promotion code id so we can pre-apply the discount on the checkout
  // session (visitor doesn't have to type the code at the Stripe page).
  // Pro Plus checkouts intentionally do NOT auto-apply partner discounts
  // because partner codes are scoped to the Pro product in Stripe and
  // would silently no-op there anyway — keeping it explicit avoids any
  // future bug where someone scopes a code to both.
  const cookieStore = await cookies();
  const referralCode = cookieStore.get(REFERRAL_COOKIE)?.value;
  const shouldApplyReferral = referralCode && plan !== "pro_plus" && plan !== "pro_plus_annual";
  const referralPromoId = shouldApplyReferral
    ? await resolvePromotionCodeId(referralCode!)
    : null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, twitch_display_name, trial_discount_started_at")
    .eq("id", user.id)
    .single();

  // First-analysis 72-hour discount. Applies only to monthly Pro checkout.
  // Partner referral wins if both are present (partner needs attribution).
  // Annual + Pro Plus intentionally skipped: annual is one upfront charge so
  // a 3-month repeating coupon would behave oddly, and Pro Plus is its own
  // segment with its own conversion model.
  const trialDiscount = computeTrialDiscountStatus(
    (profile as { trial_discount_started_at: string | null } | null)?.trial_discount_started_at ?? null
  );
  const trialDiscountCouponId = process.env.STRIPE_TRIAL_DISCOUNT_COUPON_ID;
  const shouldApplyTrialDiscount =
    trialDiscount.isActive &&
    !referralPromoId &&
    plan === "monthly" &&
    !!trialDiscountCouponId;

  // Reuse existing Stripe customer so payment methods are remembered
  let customerId = profile?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: profile?.twitch_display_name ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.levlcast.com";

  // Only attribute the referral when the promo actually resolved. If the
  // cookie holds a stale or invalid code (shouldn't happen post /r/[code]
  // validation, but defense-in-depth), don't pollute payout metadata.
  const attributedReferral = referralPromoId ? referralCode : undefined;

  // Stripe rule: a checkout session can't have both `discounts` and
  // `allow_promotion_codes`. When we have a resolved referral, pre-apply
  // it via `discounts`. Otherwise leave `allow_promotion_codes` on so
  // direct visitors can still type a code at checkout if they have one.
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings?success=stripe`,
    cancel_url: `${appUrl}/dashboard/settings`,
    subscription_data: {
      metadata: {
        user_id: user.id,
        plan,
        ...(attributedReferral ? { referral_code: attributedReferral } : {}),
      },
    },
    metadata: {
      user_id: user.id,
      plan,
      ...(attributedReferral ? { referral_code: attributedReferral } : {}),
    },
  };

  if (referralPromoId) {
    sessionParams.discounts = [{ promotion_code: referralPromoId }];
  } else if (shouldApplyTrialDiscount) {
    // Accept either a coupon id (cou_xxx) or a promotion code id (promo_xxx)
    // in STRIPE_TRIAL_DISCOUNT_COUPON_ID — they go in different Stripe fields
    // and which one Stripe Dashboard surfaces depends on whether the user
    // created via Coupons or Promotion Codes tab.
    const id = trialDiscountCouponId!;
    if (id.startsWith("promo_")) {
      sessionParams.discounts = [{ promotion_code: id }];
    } else {
      sessionParams.discounts = [{ coupon: id }];
    }
  } else {
    sessionParams.allow_promotion_codes = true;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
