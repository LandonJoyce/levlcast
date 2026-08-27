import { notFound } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { PartnerKit } from "./PartnerKit";
import type { Metadata } from "next";

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
}

async function loadCode(code: string): Promise<ResolvedCode | null> {
  const normalized = code.trim().toUpperCase();
  if (!CODE_PATTERN.test(normalized)) return null;

  try {
    const res = await stripe.promotionCodes.list({
      code: normalized,
      active: true,
      limit: 1,
      expand: ["data.coupon"],
    });
    const promo = res.data[0];
    if (!promo || promo.code !== normalized) return null;

    // Stripe expand fills `coupon` with the full Coupon object on the
    // PromotionCode, but the SDK's static type still defines it as
    // string | Coupon. Cast to access the expanded fields cleanly.
    const couponField = (promo as unknown as {
      coupon?: string | { name?: string | null; percent_off?: number | null; duration?: string };
    }).coupon;
    const coupon = couponField && typeof couponField !== "string" ? couponField : null;
    return {
      code: normalized,
      couponName: coupon?.name ?? null,
      percentOff: coupon?.percent_off ?? null,
      duration: coupon?.duration ?? null,
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
  return {
    title: `${resolved.code} · LevlCast Partner Kit`,
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
