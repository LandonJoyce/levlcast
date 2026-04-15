import { createClient, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const PAYPAL_BASE = "https://api-m.paypal.com";

async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET!;

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error("Failed to get PayPal access token");
  }
  return data.access_token;
}

/**
 * POST /api/subscription/paypal
 * Body: { action: 'activate', subscriptionId: string } | { action: 'cancel' }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "activate") {
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Missing subscriptionId" },
        { status: 400 }
      );
    }

    try {
      // Reject if this subscription ID is already claimed by a different user
      const { data: existingOwner } = await admin
        .from("profiles")
        .select("id")
        .eq("paypal_subscription_id", subscriptionId)
        .neq("id", user.id)
        .maybeSingle();

      if (existingOwner) {
        console.warn(`[subscription] Subscription ${subscriptionId} already claimed by another user`);
        return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
      }

      const token = await getPayPalToken();

      // Verify subscription is active with PayPal
      const sub = await fetch(
        `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      ).then((r) => r.json());

      if (sub.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Subscription is not active", status: sub.status },
          { status: 400 }
        );
      }

      // Verify the PayPal subscription was created for THIS user.
      // upgrade-modal.tsx sets custom_id to the user's Supabase ID at
      // subscription creation. If another user tries to activate someone
      // else's subscription (e.g. from a leaked ID), custom_id won't match.
      // Older subscriptions created before custom_id was added won't have it
      // — we allow those through to avoid breaking existing Pro users.
      const customId = sub.custom_id ?? sub.custom ?? null;
      if (customId && customId !== user.id) {
        console.warn(
          `[subscription] custom_id mismatch — user ${user.id} tried to activate subscription owned by ${customId}`
        );
        return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
      }

      // Set expiry 35 days from now (5-day buffer over 30-day billing cycle)
      // If PayPal fails to deliver a renewal webhook, access lapses automatically
      const expiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();

      // Update profile plan to pro
      await admin
        .from("profiles")
        .update({
          plan: "pro",
          paypal_subscription_id: subscriptionId,
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      // Upsert subscription record
      await admin.from("subscriptions").upsert(
        {
          user_id: user.id,
          paypal_subscription_id: subscriptionId,
          plan: "pro",
          status: "active",
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      return NextResponse.json({ success: true, plan: "pro" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[subscription] activate error:", message);
      return NextResponse.json(
        { error: "Failed to activate subscription. Please try again or contact support." },
        { status: 500 }
      );
    }
  }

  if (action === "cancel") {
    try {
      // Get current subscription id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("paypal_subscription_id")
        .eq("id", user.id)
        .single();

      const subscriptionId = profile?.paypal_subscription_id;

      if (subscriptionId) {
        const token = await getPayPalToken();

        // Cancel via PayPal API — stop future billing
        const cancelRes = await fetch(
          `${PAYPAL_BASE}/v1/billing/subscriptions/${subscriptionId}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason: "User requested cancellation" }),
          }
        );

        // PayPal returns 204 on success. 422 means already cancelled — both are fine.
        // Any other error means we failed to cancel on PayPal's side — don't proceed.
        if (!cancelRes.ok && cancelRes.status !== 422) {
          const body = await cancelRes.text().catch(() => "");
          console.error(`[subscription] PayPal cancel failed ${cancelRes.status}:`, body);
          return NextResponse.json(
            { error: "Failed to cancel with PayPal. Please try again or contact support." },
            { status: 502 }
          );
        }
      }

      // Clear the subscription ID so renewal webhooks no longer extend access.
      // Keep plan="pro" and subscription_expires_at as-is — the user keeps access
      // until the end of their billing period, then getUserUsage() auto-downgrades them.
      await admin
        .from("profiles")
        .update({
          paypal_subscription_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      await admin
        .from("subscriptions")
        .update({
          status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return NextResponse.json({ success: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[subscription] cancel error:", message);
      return NextResponse.json(
        { error: "Failed to cancel subscription. Please try again or contact support." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
