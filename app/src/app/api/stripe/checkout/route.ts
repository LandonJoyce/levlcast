/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the Pro subscription and returns
 * the hosted checkout URL. The client redirects to it immediately.
 */

export const dynamic = "force-dynamic";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe, priceIdForPlan, type CheckoutPlan } from "@/lib/stripe";
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
    .select("stripe_customer_id, twitch_display_name")
    .eq("id", user.id)
    .single();

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
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
    },
    metadata: {
      user_id: user.id,
      plan,
      ...(referralCode ? { referral_code: referralCode } : {}),
    },
  };

  if (referralPromoId) {
    sessionParams.discounts = [{ promotion_code: referralPromoId }];
  } else {
    sessionParams.allow_promotion_codes = true;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return NextResponse.json({ url: session.url });
}
