/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for the Pro subscription and returns
 * the hosted checkout URL. The client redirects to it immediately.
 */

export const dynamic = "force-dynamic";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRO_PRICE_ID } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
    success_url: `${appUrl}/dashboard/settings?success=stripe`,
    cancel_url: `${appUrl}/dashboard/settings`,
    subscription_data: {
      metadata: { user_id: user.id },
    },
    metadata: { user_id: user.id },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
