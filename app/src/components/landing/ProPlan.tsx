"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * The Pro column of the homepage pricing, with a monthly/yearly switch.
 * The yearly plan ($149) has existed in checkout all along but the
 * homepage only ever offered monthly, so nobody saw it before paying.
 * Both links go through sign-in, which hands the plan to checkout.
 */
const CYCLES = {
  monthly: { price: "$14.99", per: "/mo", note: null, plan: "monthly" },
  yearly: { price: "$149", per: "/yr", note: "That’s about two months free.", plan: "annual" },
} as const;

export default function ProPlan() {
  const [cycle, setCycle] = useState<keyof typeof CYCLES>("monthly");
  const c = CYCLES[cycle];

  return (
    <div className="v3-plan v3-plan-lead">
      <p className="v3-plan-n">Pro</p>
      <div className="v3-cycle" role="group" aria-label="Billing">
        {(Object.keys(CYCLES) as Array<keyof typeof CYCLES>).map((k) => (
          <button key={k} type="button" aria-pressed={cycle === k} onClick={() => setCycle(k)}>
            {k === "monthly" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>
      <p className="v3-plan-p">
        {c.price}
        <span>{c.per}</span>
      </p>
      <p className="v3-plan-b">
        For streamers going live more than twice a week. Fifteen streams a month, twenty clips, and posting straight to
        YouTube.
        {c.note && <> {c.note}</>}
      </p>
      <Link href={`/auth/login?plan=${c.plan}`} className="v3-btn">
        Go Pro
      </Link>
    </div>
  );
}
