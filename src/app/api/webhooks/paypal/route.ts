import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/webhooks/paypal
 * Handles PayPal subscription lifecycle webhook events.
 * Always returns 200 so PayPal does not retry.
 */
export async function POST(request: Request) {
  const admin = createAdminClient();

  let body: any;
  try {
    body = await request.json();
  } catch {
    // Malformed body — still return 200 to stop retries
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const eventType: string = body?.event_type ?? "";
  const subscriptionId: string =
    body?.resource?.id ?? body?.resource?.billing_agreement_id ?? "";

  console.log(`[webhook/paypal] event=${eventType} subscription=${subscriptionId}`);

  if (!subscriptionId) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Look up user by paypal_subscription_id in subscriptions table
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("paypal_subscription_id", subscriptionId)
    .single();

  // If not found by subscriptions table, try profiles table
  let userId: string | null = subscription?.user_id ?? null;

  if (!userId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("paypal_subscription_id", subscriptionId)
      .single();
    userId = profile?.id ?? null;
  }

  if (!userId) {
    console.warn(`[webhook/paypal] No user found for subscription ${subscriptionId}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED": {
      await admin
        .from("profiles")
        .update({ plan: "pro", updated_at: new Date().toISOString() })
        .eq("id", userId);

      await admin
        .from("subscriptions")
        .update({ plan: "pro", status: "active", updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      console.log(`[webhook/paypal] User ${userId} upgraded to pro`);
      break;
    }

    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
    case "BILLING.SUBSCRIPTION.SUSPENDED": {
      await admin
        .from("profiles")
        .update({
          plan: "free",
          paypal_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      const statusMap: Record<string, string> = {
        "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
        "BILLING.SUBSCRIPTION.EXPIRED": "expired",
        "BILLING.SUBSCRIPTION.SUSPENDED": "cancelled",
      };

      await admin
        .from("subscriptions")
        .update({
          plan: "free",
          status: statusMap[eventType] ?? "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      console.log(`[webhook/paypal] User ${userId} downgraded to free (${eventType})`);
      break;
    }

    default:
      console.log(`[webhook/paypal] Unhandled event: ${eventType}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
