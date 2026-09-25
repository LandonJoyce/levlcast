/**
 * Partner codes.
 *
 * A partner code is a Stripe promotion code shaped HANDLE + viewer
 * discount, e.g. MLEPLAYS20. Stripe holds the deal itself (the coupon,
 * including how long it lasts); everything here is derived from the code
 * and that coupon so the landing line, the partner kit and the checkout
 * can never disagree.
 *
 * The one thing a code can't carry is how the partner writes their own
 * name: "MLEPLAYS" would otherwise print as "Mleplays". Add a line to
 * PARTNER_NAMES when a partner's code is created. A code missing from it
 * falls back to a title-cased handle, so it reads slightly off, never
 * broken.
 */

export const PARTNER_NAMES: Record<string, string> = {
  MLEPLAYS20: "MLEplays",
};

/** Pro's monthly sticker price. The discounted price shown to viewers is worked out from it. */
export const PRO_MONTHLY_PRICE = 14.99;

/** Codes that are well-formed enough to look up. Mirrors /r/[code]. */
export const PARTNER_CODE_PATTERN = /^[A-Z0-9_-]{3,40}$/;

export interface PartnerCodeInfo {
  code: string;
  /** How to print the partner's name, or null if the code has no handle part. */
  name: string | null;
  /** Viewer discount parsed from the trailing digits, or null. */
  percentOff: number | null;
}

function titleCase(raw: string): string {
  return raw
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function parsePartnerCode(rawCode: string): PartnerCodeInfo {
  const code = rawCode.trim().toUpperCase();
  const match = code.match(/^([A-Z][A-Z_-]+?)(\d{1,2})$/);
  return {
    code,
    name: PARTNER_NAMES[code] ?? (match ? titleCase(match[1]) : null),
    percentOff: match ? Number(match[2]) : null,
  };
}

/**
 * How long a partner discount lasts, as set on the Stripe coupon.
 *
 * Partners are not all on the same terms: some codes are forever, some
 * last the first few months. Every sentence that promises a discount
 * reads this rather than assuming, because "for as long as you stay" on
 * a three-month coupon is a promise the checkout then breaks.
 */
export interface DiscountTerms {
  duration: "forever" | "once" | "repeating";
  /** Months the discount applies; null when forever. */
  months: number | null;
}

export function termsFromCoupon(coupon: { duration?: string | null; duration_in_months?: number | null } | null): DiscountTerms | null {
  if (!coupon?.duration) return null;
  if (coupon.duration === "forever") return { duration: "forever", months: null };
  if (coupon.duration === "once") return { duration: "once", months: 1 };
  if (coupon.duration === "repeating" && coupon.duration_in_months) {
    return { duration: "repeating", months: coupon.duration_in_months };
  }
  return null;
}

/** Cookie form, written by /r/[code] next to the code: "forever", "once", or "m3". */
export function encodeTerms(terms: DiscountTerms): string {
  if (terms.duration === "repeating" && terms.months) return `m${terms.months}`;
  return terms.duration;
}

export function decodeTerms(raw: string | null | undefined): DiscountTerms | null {
  if (raw === "forever") return { duration: "forever", months: null };
  if (raw === "once") return { duration: "once", months: 1 };
  const match = raw?.match(/^m(\d{1,2})$/);
  return match ? { duration: "repeating", months: Number(match[1]) } : null;
}

/**
 * The length of the deal in words, for "you" (a viewer reading it) or
 * "they" (a partner reading about their viewers):
 * "for as long as you stay", "for your first 3 months", "on your first month".
 */
export function termsPhrase(terms: DiscountTerms, who: "you" | "they"): string {
  if (terms.duration === "forever") {
    return who === "you" ? "for as long as you stay" : "for as long as they stay subscribed";
  }
  const whose = who === "you" ? "your" : "their";
  const months = terms.months ?? 1;
  return months === 1 ? `on ${whose} first month` : `for ${whose} first ${months} months`;
}

/** What a viewer pays per month with a given discount, to the cent. */
export function discountedMonthly(percentOff: number): number {
  return Math.round(PRO_MONTHLY_PRICE * (1 - percentOff / 100) * 100) / 100;
}

/**
 * The partner's revenue share for a viewer discount. Founding partners
 * give viewers 20% off and take 30%; standard partners give 15% and take
 * 25%. Anything else gets the standard rate, so the kit never promises
 * more than the deal.
 */
export function revSharePctFor(percentOff: number | null): number {
  return percentOff === 20 ? 30 : 25;
}
