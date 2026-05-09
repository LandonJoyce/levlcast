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

export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { sendProWelcomeEmail } from "@/lib/email";
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

/**
 * Reads `current_period_end` from a Stripe subscription, handling both the
 * legacy location (`subscription.current_period_end`) and the new location
 * introduced in API version 2025-08+ where each subscription item carries
 * its own period timestamps. Returns undefined if neither is present.
 *
 * Why this matters: when only the old field is read on a newer API version
 * (e.g. 2026-04-22.dahlia), it's `undefined`, the handler falls through to
 * `billing_cycle_anchor`, and users end up with a 5-day Pro window starting
 * at signup instead of the 35-day cycle they paid for.
 */
function getCurrentPeriodEnd(sub: Stripe.Subscription): number | undefined {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number") return legacy;
  const items = (sub as unknown as { items?: { data?: Array<{ current_period_end?: number }> } }).items?.data;
  if (Array.isArray(items)) {
    for (const item of items) {
      if (typeof item.current_period_end === "number") return item.current_period_end;
    }
  }
  return undefined;
}

/**
 * Resolve the subscription id off an Invoice. The `invoice.subscription`
 * field is being phased out in newer Stripe API versions; the canonical
 * locations are `invoice.parent.subscription_details.subscription` or
 * `invoice.lines.data[i].subscription`. Try all three.
 */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const direct = (invoice as unknown as { subscription?: string | { id?: string } }).subscription;
  if (typeof direct === "string") return direct;
  if (direct && typeof direct === "object" && typeof direct.id === "string") return direct.id;

  const parentSub = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id?: string } } };
  }).parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") return parentSub;
  if (parentSub && typeof parentSub === "object" && typeof parentSub.id === "string") return parentSub.id;

  const lineSub = (invoice as unknown as {
    lines?: { data?: Array<{ subscription?: string | { id?: string } }> };
  }).lines?.data?.[0]?.subscription;
  if (typeof lineSub === "string") return lineSub;
  if (lineSub && typeof lineSub === "object" && typeof lineSub.id === "string") return lineSub.id;

  return undefined;
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

        // Retrieve subscription to get accurate period end. getCurrentPeriodEnd
        // checks both legacy (subscription.current_period_end) and new
        // (subscription.items.data[0].current_period_end) locations — newer
        // Stripe API versions moved the field onto each subscription item.
        const subId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? "";
        const sub = await stripe.subscriptions.retrieve(subId);
        const periodEnd = getCurrentPeriodEnd(sub);
        const expiresAt = expiryFromPeriodEnd(
          periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
        );
        if (!periodEnd) {
          console.warn(`[webhook/stripe] checkout.completed — no current_period_end on subscription ${subId}, falling back to now+30d`);
        }

        // Founding-member tagging stopped on 2026-05-06 when Pro dropped from 20/20 to 15/20.
        // Existing founding members are flagged manually via SQL and keep their 20/20 cap forever.
        // New subscribers get the standard 15/20 cap.
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

        // Welcome email — fire and forget
        try {
          const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId);
          const { data: profile } = await admin.from("profiles").select("twitch_display_name").eq("id", userId).single();
          if (authUser?.email) {
            const name = profile?.twitch_display_name ?? authUser.email.split("@")[0];
            await sendProWelcomeEmail(authUser.email, name);
          }
        } catch (emailErr) {
          console.warn("[webhook/stripe] Pro welcome email failed:", emailErr instanceof Error ? emailErr.message : String(emailErr));
        }
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

        // Get period end from parent subscription. The invoice.subscription
        // field was relocated in newer Stripe API versions; resolve it via
        // helpers that try every known location.
        const subId = getInvoiceSubscriptionId(invoice);
        let expiresAt: string;
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          const periodEnd = getCurrentPeriodEnd(sub);
          expiresAt = expiryFromPeriodEnd(
            periodEnd ?? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
          );
          if (!periodEnd) {
            console.warn(`[webhook/stripe] renewal — no current_period_end on subscription ${subId}, falling back to now+30d`);
          }
        } else {
          console.warn(`[webhook/stripe] renewal — no subscription id resolvable from invoice ${invoice.id}, falling back to now+35d`);
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
        const periodEnd = getCurrentPeriodEnd(sub);
        const expiresAt = isActive && periodEnd ? expiryFromPeriodEnd(periodEnd) : null;
        if (isActive && !periodEnd) {
          console.warn(`[webhook/stripe] subscription.updated — active sub ${sub.id} but no current_period_end, writing NULL expiry`);
        }

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
