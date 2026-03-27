import { NextResponse } from "next/server";

/**
 * One-time endpoint to create the PayPal product + subscription plan.
 * DELETE THIS FILE after running it once.
 */
export async function GET() {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;

  // Get access token
  const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    return NextResponse.json({ error: "Token failed", detail: err }, { status: 500 });
  }

  const { access_token } = await tokenRes.json();

  // Create product
  const productRes = await fetch("https://api-m.paypal.com/v1/catalogs/products", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "LevlCast Pro",
      description: "Unlimited VOD analyses and clip generation",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });

  const product = await productRes.json();
  if (!product.id) {
    return NextResponse.json({ error: "Product failed", detail: product }, { status: 500 });
  }

  // Create plan
  const planRes = await fetch("https://api-m.paypal.com/v1/billing/plans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: product.id,
      name: "LevlCast Pro Monthly",
      description: "Unlimited VOD analyses and clip generation",
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: "9.99", currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: { value: "0", currency_code: "USD" },
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });

  const plan = await planRes.json();

  return NextResponse.json({
    product_id: product.id,
    plan_id: plan.id,
    plan_status: plan.status,
  });
}
