"use client";

import { useEffect, useState } from "react";
import {
  decodeTerms,
  discountedMonthly,
  parsePartnerCode,
  PARTNER_CODE_PATTERN,
  PRO_MONTHLY_PRICE,
  termsPhrase,
  type DiscountTerms,
} from "@/lib/partners";

/**
 * "MLEplays sent you" at the top of the homepage.
 *
 * A partner tells their viewers there is 20% off; the viewer clicks and
 * lands here. Without this line the page said nothing about it, which
 * reads as a broken promise from someone they trust. The homepage lost the
 * old ReferralBadge when it was replaced, so referred visitors had been
 * landing on no confirmation at all.
 *
 * Reads only the cookies /r/[code] sets after validating the code against
 * Stripe: lc_promo for the code, lc_promo_terms for how long it lasts. The
 * old badge also trusted a ?ref= query param, so /?ref=ANYONE50 printed a
 * 50% badge nobody could redeem. The cookie is already there when the
 * redirect lands, so the fallback was never needed.
 *
 * With no terms (a cookie from before terms were stored) it names the
 * discount and makes no claim about how long it lasts, rather than guess.
 *
 * Pass `code` and `terms` to render it for a known code, as the partner
 * kit does to show a partner what their viewers see.
 */
export default function ReferralLine({
  code: fixedCode,
  terms: fixedTerms,
}: { code?: string; terms?: DiscountTerms | null } = {}) {
  const [code, setCode] = useState<string | null>(fixedCode ?? null);
  const [terms, setTerms] = useState<DiscountTerms | null>(fixedTerms ?? null);

  useEffect(() => {
    if (fixedCode) return;
    const read = (name: string) => {
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
      return match ? decodeURIComponent(match[1]) : null;
    };
    const value = read("lc_promo");
    if (value && PARTNER_CODE_PATTERN.test(value)) {
      setCode(value);
      setTerms(decodeTerms(read("lc_promo_terms")));
    }
  }, [fixedCode]);

  if (!code) return null;
  const { name, percentOff } = parsePartnerCode(code);
  const price = percentOff !== null ? `$${discountedMonthly(percentOff).toFixed(2)}` : null;
  const perMonth = terms?.duration === "once" ? "" : " a month";

  return (
    <div className="lv2-ref" role="status">
      <span className="lv2-ref-k">{name ? `${name} sent you` : "Partner discount"}</span>
      <p className="lv2-ref-main">
        {percentOff !== null ? (
          <>
            <b>
              {percentOff}% off Pro{terms ? `${terms.duration === "forever" ? "," : ""} ${termsPhrase(terms, "you")}` : ""}.
            </b>{" "}
            {price}
            {perMonth} instead of ${PRO_MONTHLY_PRICE.toFixed(2)}, taken off for you when you upgrade.
          </>
        ) : (
          <>
            <b>Your discount is saved.</b> It comes off for you when you upgrade.
          </>
        )}
      </p>
    </div>
  );
}
