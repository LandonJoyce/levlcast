import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/webhooks/revenuecat
 * Handles RevenueCat server-to-server webhook events for iOS/Android subscriptions.
 * Keeps Supabase plan + subscription_expires_at in sync with Apple/Google billing
 * so users don't lose Pro access on renewal even if they don't open the app.
 *
 * VERIFICATION:
 *   RevenueCat sends Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>
 *   We reject any request without the correct secret.
 *
 * EVENTS HANDLED:
 *   INITIAL_PURCHASE  — new subscriber, extend Pro access
 *   RENEWAL           — successful renewal, extend Pro access
 *   UNCANCELLATION    — user re-enabled a cancelled subscription
 *   PRODUCT_CHANGE    — plan change, extend Pro access
 *   CANCELLATION      — user cancelled, keep Pro until expiration_at_ms then auto-lapse
 *   BILLING_ISSUE     — payment failed, keep as-is (Apple retries for up to 60 days)
 *   EXPIRATION        — subscription has fully lapsed, downgrade to free
 *
 * SETUP:
 *   Set REVENUECAT_WEBHOOK_SECRET in Vercel env vars, then configure the webhook
 *   URL in RevenueCat Dashboard → Project Settings → Integrations → Webhooks.
 *   URL: https://levlcast.vercel.app/api/webhooks/revenuecat
 */
export async function POST(request: Request) {
  // Verify the shared secret before touching anything
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook/rc] REVENUECAT_WEBHOOK_SECRET not set");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    console.warn("[webhook/rc] Invalid authorization — rejecting");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const event = body?.event;
  if (!event) {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const eventType: string = event.type ?? "";
  const appUserId: string = event.app_user_id ?? "";
  const expirationMs: number | null = event.expiration_at_ms ?? null;

  console.log(`[webhook/rc] event=${eventType} user=${appUserId} expires=${expirationMs}`);

  if (!appUserId) {
    console.warn("[webhook/rc] No app_user_id in event");
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const admin = createAdminClient();

  // Verify the user exists
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", appUserId)
    .single();

  if (!profile) {
    console.warn(`[webhook/rc] No user found for app_user_id ${appUserId}`);
    return NextResponse.json({ received: true }, { status: 200 });
  }

  switch (eventType) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE": {
      // Extend Pro access — use expiration_at_ms from RevenueCat + 1 day buffer
      let expiresAt: string;
      if (expirationMs) {
        const expiry = new Date(expirationMs);
        expiry.setDate(expiry.getDate() + 1); // 1-day buffer
        expiresAt = expiry.toISOString();
      } else {
        // Fallback: 35 days from now if RevenueCat didn't send an expiry
        expiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
      }

      await Promise.all([
        admin.from("profiles").update({
          plan: "pro",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("id", appUserId),
        admin.from("subscriptions").upsert({
          user_id: appUserId,
          plan: "pro",
          status: "active",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" }),
      ]);

      console.log(`[webhook/rc] Pro extended for ${appUserId} until ${expiresAt} (${eventType})`);
      break;
    }

    case "CANCELLATION": {
      // User cancelled — don't downgrade immediately.
      // Keep plan="pro" and let subscription_expires_at auto-lapse.
      // Update expiry to match RevenueCat's expiration_at_ms so getUserUsage()
      // knows exactly when access ends.
      if (expirationMs) {
        const expiresAt = new Date(expirationMs).toISOString();
        await Promise.all([
          admin.from("profiles").update({
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }).eq("id", appUserId),
          admin.from("subscriptions").update({
            status: "cancelled",
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          }).eq("user_id", appUserId),
        ]);
        console.log(`[webhook/rc] Cancelled for ${appUserId}, access until ${expiresAt}`);
      }
      break;
    }

    case "EXPIRATION": {
      // Subscription fully lapsed — downgrade to free now
      await Promise.all([
        admin.from("profiles").update({
          plan: "free",
          updated_at: new Date().toISOString(),
        }).eq("id", appUserId),
        admin.from("subscriptions").update({
          plan: "free",
          status: "expired",
          updated_at: new Date().toISOString(),
        }).eq("user_id", appUserId),
      ]);
      console.log(`[webhook/rc] Expired — downgraded ${appUserId} to free`);
      break;
    }

    case "BILLING_ISSUE": {
      // Payment failed — Apple retries for up to 60 days. Don't downgrade yet.
      // The existing subscription_expires_at will auto-lapse if Apple gives up.
      await admin.from("subscriptions").update({
        status: "billing_issue",
        updated_at: new Date().toISOString(),
      }).eq("user_id", appUserId);
      console.log(`[webhook/rc] Billing issue for ${appUserId} — keeping Pro during retry window`);
      break;
    }

    default:
      console.log(`[webhook/rc] Unhandled event type: ${eventType}`);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
