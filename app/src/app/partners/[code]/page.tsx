import { notFound } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { parsePartnerCode } from "@/lib/partners";
import { PartnerKit } from "./PartnerKit";
import type { Metadata } from "next";
// The kit is laid out with the homepage's own classes; see partners.css.
import "../../home.css";
import "./partners.css";

/**
 * /partners/[code] — public partner kit page.
 *
 * The streamer gets a single URL they can bookmark / return to that
 * shows them everything they need to push LevlCast to their community:
 *   - Their code and one-click-copy referral link
 *   - Their deal numbers (discount %, rev share %)
 *   - Bio template + chat copy variants
 *   - Banner downloads (when assets exist at /partners/[code]/...)
 *   - Pricing urgency talking points
 *   - Attribution explainer
 *
 * Public on purpose — none of this is sensitive (it's literally a
 * promo code that's meant to be shared). The slug IS the code; if
 * someone discovers a partner's URL by guessing, the worst that
 * happens is they see the same talking points the partner would
 * see, which doesn't help anyone "fake" anything because the
 * discount mechanics are enforced server-side at Stripe checkout.
 *
 * 404s on codes that don't exist in Stripe so the page isn't a way
 * to confirm whether a code is real (the /r/[code] route already
 * silently no-ops invalid codes too).
 */

const CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

interface ResolvedCode {
  code: string;
  /** Display name from Stripe coupon (e.g. "Chrysta -20% off forever"). */
  couponName: string | null;
  /** Discount percent (extracted from Stripe coupon if percent_off, else null). */
  percentOff: number | null;
  /** Stripe coupon duration: "once" | "repeating" | "forever". */
  duration: string | null;
  /** Months the discount lasts when duration is "repeating". */
  durationInMonths: number | null;
}

async function loadCode(code: string): Promise<ResolvedCode | null> {
  const normalized = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) return null;

  try {
    const res = await stripe.promotionCodes.list({
      code: normalized,
      active: true,
      limit: 1,
      // Since API 2025-09-30 the coupon sits under `promotion`. The old
      // `data.coupon` expand silently returned nothing, so every kit fell
      // back to reading the discount off the code's digits and could never
      // see how long a coupon lasts.
      expand: ["data.promotion.coupon"],
    });
    const promo = res.data[0];
    if (!promo || promo.code !== normalized) return null;

    const couponField = promo.promotion?.coupon;
    const coupon = couponField && typeof couponField === "object" ? couponField : null;
    return {
      code: normalized,
      couponName: coupon?.name ?? null,
      percentOff: coupon?.percent_off ?? null,
      duration: coupon?.duration ?? null,
      durationInMonths: coupon?.duration_in_months ?? null,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ code: string }> }
): Promise<Metadata> {
  const { code } = await params;
  const resolved = await loadCode(code);
  if (!resolved) return { title: "LevlCast Partner Kit" };
  const name = parsePartnerCode(resolved.code).name ?? resolved.code;
  return {
    title: `${name} · LevlCast Partner Kit`,
    description: `Your link, code, and assets for promoting LevlCast.`,
    robots: { index: false, follow: false }, // partner pages aren't for SEO
  };
}

export default async function PartnerKitPage(
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const resolved = await loadCode(code);
  if (!resolved) notFound();

  return <PartnerKit data={resolved} />;
}
