/**
 * POST /api/stripe/webhook
 * Handles Stripe subscription lifecycle events.
 * Must be registered in Stripe Dashboard → Webhooks.
 *
 * Events handled:
 *   checkout.session.completed       — first payment, activate Pro
 *   customer.subscription.updated    — plan change / renewal
 *   customer.subscription.deleted    — cancellation took effect
 *   invoice.payment_succeeded        — recurring renewal, extend expiry
 *   invoice.payment_failed           — payment failed, warn (don't downgrade yet)
 */

import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const runtime = "nodejs";

async function getUserId(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  metadata?: Stripe.Metadata | null
): Promise<string | null> {
  if (metadata?.user_id) return metadata.user_id;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

// Add 5-day buffer on top of period end so access doesn't lapse on the exact renewal day
function expiryFromPeriodEnd(periodEnd: number): string {
  return new Date(periodEnd * 1000 + 5 * 24 * 60 * 60 * 1000).toISOString();
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("[webhook/stripe] Missing signature or webhook secret");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[webhook/stripe] Signature verification failed:", msg);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  console.log(`[webhook/stripe] event=${event.type} id=${event.id}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const customerId = session.customer as string;
        const userId = await getUserId(admin, customerId, session.metadata);
        if (!userId) {
          console.error(`[webhook/stripe] No user found for customer ${customerId}`);
          break;
        }

        // Retrieve subscription to get accurate period end
        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? "";
        const sub = await stripe.subscriptions.retrieve(subId);
        const expiresAt = expiryFromPeriodEnd((sub as any).current_period_end ?? (sub as any).billing_cycle_anchor ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);

        await admin.from("profiles").update({
          plan: "pro",
          stripe_customer_id: customerId,
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);

        await admin.from("subscriptions").upsert({
          user_id: userId,
          plan: "pro",
          status: "active",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        console.log(`[webhook/stripe] checkout.completed — user ${userId} upgraded to Pro (expires ${expiresAt})`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // checkout.session.completed handles the first payment
        if ((invoice as any).billing_reason === "subscription_create") break;

        const customerId = invoice.customer as string;
        const userId = await getUserId(admin, customerId, null);
        if (!userId) {
          console.error(`[webhook/stripe] No user found for customer ${customerId}`);
          break;
        }

        // Get period end from parent subscription
        const subId = (invoice as any).subscription as string | undefined;
        let expiresAt: string;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          expiresAt = expiryFromPeriodEnd((sub as any).current_period_end ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
        } else {
          expiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
        }

        await admin.from("profiles").update({
          plan: "pro",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);

        await admin.from("subscriptions").update({
          plan: "pro",
          status: "active",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        console.log(`[webhook/stripe] renewal — user ${userId} Pro extended to ${expiresAt}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await getUserId(admin, customerId, sub.metadata);
        if (!userId) break;

        const isActive = ["active", "trialing"].includes(sub.status);
        const periodEnd = (sub as any).current_period_end as number | undefined;
        const expiresAt = isActive && periodEnd ? expiryFromPeriodEnd(periodEnd) : null;

        await admin.from("profiles").update({
          plan: isActive ? "pro" : "free",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);

        await admin.from("subscriptions").update({
          plan: isActive ? "pro" : "free",
          status: sub.status,
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        console.log(`[webhook/stripe] subscription.updated — user ${userId} status=${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await getUserId(admin, customerId, sub.metadata);
        if (!userId) break;

        await admin.from("profiles").update({
          plan: "free",
          subscription_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);

        await admin.from("subscriptions").update({
          plan: "free",
          status: "cancelled",
          subscription_expires_at: null,
          updated_at: new Date().toISOString(),
        }).eq("user_id", userId);

        console.log(`[webhook/stripe] subscription.deleted — user ${userId} downgraded to free`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await getUserId(admin, customerId, null);
        // Don't downgrade yet — Stripe retries automatically. subscription_expires_at lapses naturally.
        console.warn(`[webhook/stripe] payment_failed — customer ${customerId} user ${userId ?? "unknown"}`);
        break;
      }

      default:
        console.log(`[webhook/stripe] Unhandled event: ${event.type}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook/stripe] Handler error for ${event.type}:`, msg);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
