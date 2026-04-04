import { createClientFromRequest, createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST /api/subscription/revenuecat
 * Called by the mobile app after a successful in-app purchase.
 * Verifies the entitlement with RevenueCat server-side, then upgrades
 * the user's plan in Supabase. Requires Bearer token auth.
 */
export async function POST(request: Request) {
  const supabase = await createClientFromRequest(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (!secretKey) {
    console.error("[revenuecat] REVENUECAT_SECRET_KEY not set");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Verify entitlement with RevenueCat using the user's Supabase ID as app_user_id
  const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${user.id}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!rcRes.ok) {
    console.error(`[revenuecat] API error ${rcRes.status} for user ${user.id}`);
    return NextResponse.json({ error: "Failed to verify subscription" }, { status: 502 });
  }

  const rcData = await rcRes.json();
  const proEntitlement = rcData?.subscriber?.entitlements?.pro;
  const isActive = proEntitlement && new Date(proEntitlement.expires_date) > new Date();

  if (!isActive) {
    return NextResponse.json({ error: "No active pro entitlement found" }, { status: 400 });
  }

  // Set expiry from RevenueCat's expires_date (+ 1 day buffer)
  const rcExpiry = new Date(proEntitlement.expires_date);
  rcExpiry.setDate(rcExpiry.getDate() + 1);
  const expiresAt = rcExpiry.toISOString();

  const admin = createAdminClient();

  await admin.from("profiles").update({
    plan: "pro",
    subscription_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);

  await admin.from("subscriptions").upsert({
    user_id: user.id,
    plan: "pro",
    status: "active",
    subscription_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  console.log(`[revenuecat] User ${user.id} upgraded to pro, expires ${expiresAt}`);
  return NextResponse.json({ success: true, plan: "pro" });
}
