import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === "live"
    ? "https://api.paypal.com"
    : "https://api.sandbox.paypal.com";

/**
 * Verify a PayPal webhook event using PayPal's own verification API.
 * This is the only way to confirm the event actually came from PayPal.
 * Returns true only if PayPal responds with verification_status === "SUCCESS".
 */
async function verifyPayPalWebhook(
  rawBody: string,
  headers: Headers
): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("[webhook/paypal] PAYPAL_WEBHOOK_ID env var not set");
    return false;
  }

  // Get a PayPal access token to call their verification API
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    console.error("[webhook/paypal] Failed to get PayPal access token for verification");
    return false;
  }

  const { access_token } = await tokenRes.json();

  // Call PayPal's webhook verification endpoint
  const verifyRes = await fetch(
    `${PAYPAL_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    }
  );

  if (!verifyRes.ok) {
    console.error("[webhook/paypal] Verification API call failed:", verifyRes.status);
    return false;
  }

  const { verification_status } = await verifyRes.json();
  return verification_status === "SUCCESS";
}

/**
 * POST /api/webhooks/paypal
 * Handles PayPal subscription lifecycle webhook events.
 * Verifies webhook signature before processing any event.
 */
export async function POST(request: Request) {
  // Read raw body first — needed for signature verification
  const rawBody = await request.text();

  // Verify the webhook came from PayPal before touching the database
  const verified = await verifyPayPalWebhook(rawBody, request.headers);
  if (!verified) {
    console.warn("[webhook/paypal] Signature verification failed — rejecting event");
    // Return 200 so PayPal doesn't keep retrying a legitimately rejected event,
    // but log it so we can investigate if something goes wrong
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const admin = createAdminClient();

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const eventType: string = body?.event_type ?? "";
  const subscriptionId: string =
    body?.resource?.id ?? body?.resource?.billing_agreement_id ?? "";

  console.log(`[webhook/paypal] Verified event=${eventType} subscription=${subscriptionId}`);

  if (!subscriptionId) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // Look up user by paypal_subscription_id in subscriptions table
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("paypal_subscription_id", subscriptionId)
    .single();

  let userId: string | null = subscription?.user_id ?? null;

  // Fallback: check profiles table
  if (!userId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("paypal_subscription_id", subscriptionId)
      .single();
    userId = profile?.id ?? null;
  }

  // Orphaned payment recovery: if the browser disconnected before onApprove
  // fired, the subscription record was never written. Recover via custom_id
  // (set when we created the subscription in upgrade-modal.tsx) and backfill.
  if (!userId) {
    const customId: string | null =
      body?.resource?.custom_id ?? body?.resource?.custom ?? null;

    if (customId) {
      // Confirm the user actually exists before trusting the custom_id
      const { data: recoveredProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("id", customId)
        .single();

      if (recoveredProfile?.id) {
        userId = recoveredProfile.id;
        console.warn(
          `[webhook/paypal] Recovered orphaned subscription ${subscriptionId} for user ${userId} via custom_id`
        );

        // Backfill profile link so future webhook lookups succeed normally
        await admin
          .from("profiles")
          .update({
            paypal_subscription_id: subscriptionId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        // Upsert a subscriptions row so it's tracked properly
        await admin
          .from("subscriptions")
          .upsert(
            {
              user_id: userId,
              paypal_subscription_id: subscriptionId,
              plan: "pro",
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );
      }
    }
  }

  if (!userId) {
    console.warn(`[webhook/paypal] No user found for subscription ${subscriptionId}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // 35-day expiry window — 5-day buffer over the 30-day billing cycle.
  // Extended on every successful payment so lapsed billing auto-revokes access.
  const renewedExpiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "PAYMENT.SALE.COMPLETED": {
      await admin
        .from("profiles")
        .update({ plan: "pro", subscription_expires_at: renewedExpiresAt, updated_at: new Date().toISOString() })
        .eq("id", userId);

      await admin
        .from("subscriptions")
        .update({ plan: "pro", status: "active", subscription_expires_at: renewedExpiresAt, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      console.log(`[webhook/paypal] User ${userId} pro access extended to ${renewedExpiresAt} (${eventType})`);
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
