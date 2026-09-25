import Link from "next/link";
import ReferralLine from "@/components/landing/ReferralLine";
import {
  discountedMonthly,
  parsePartnerCode,
  PRO_MONTHLY_PRICE,
  revSharePctFor,
  termsFromCoupon,
  termsPhrase,
} from "@/lib/partners";
import { CopyButton, OverlayPreview } from "./kit-client";

/**
 * The partner kit.
 *
 * Rebuilt on the homepage's own layout: left-aligned, rules instead of
 * boxes, mono labels, one filled button. The old kit was a centred column
 * of nine cards under a coloured glow, which read like a different
 * product from the site a partner's viewers land on.
 *
 * Ordered by what a partner comes back for: the deal once, the link every
 * time, then lines to paste, then the rest. Server-rendered; only the copy
 * buttons and the overlay preview run in the browser.
 */

export interface PartnerKitData {
  code: string;
  couponName: string | null;
  percentOff: number | null;
  duration: string | null;
  durationInMonths: number | null;
}

export function PartnerKit({ data }: { data: PartnerKitData }) {
  const info = parsePartnerCode(data.code);
  const code = info.code;
  // Stripe's coupon is the source of truth for the discount and how long
  // it lasts; the digits on the end of the code are only a fallback.
  const percent = data.percentOff ?? info.percentOff ?? 20;
  const share = revSharePctFor(percent);
  const terms = termsFromCoupon({ duration: data.duration, duration_in_months: data.durationInMonths });
  const monthly = discountedMonthly(percent).toFixed(2);
  const linkText = `levlcast.com/r/${code}`;
  const linkUrl = `https://www.levlcast.com/r/${code}`;
  const name = info.name ?? code;

  // The offer as a viewer hears it. Forever reads as plain "20% off Pro";
  // a limited coupon says how long, so nobody is told a promise the
  // checkout won't keep.
  const months = terms?.duration === "once" ? 1 : terms?.months ?? null;
  const offer =
    !terms || terms.duration === "forever"
      ? `${percent}% off Pro`
      : months === 1
      ? `${percent}% off your first month of Pro`
      : `${percent}% off your first ${months} months of Pro`;
  const dealLine = !terms
    ? `Pro. $${monthly} a month instead of $${PRO_MONTHLY_PRICE.toFixed(2)}.`
    : terms.duration === "forever"
    ? `Pro, ${termsPhrase(terms, "they")}. $${monthly} a month instead of $${PRO_MONTHLY_PRICE.toFixed(2)}.`
    : `Pro ${termsPhrase(terms, "they")}. $${monthly} a month instead of $${PRO_MONTHLY_PRICE.toFixed(2)}, then the normal price.`;

  const lines = [
    { label: "Bio", text: `LevlCast: ${percent}% off with ${code} → ${linkText}` },
    { label: "Chat", text: `Coach report on your last stream, free to try. ${offer} with my link: ${linkText}` },
    {
      label: "Chat, longer",
      text: `If you stream, paste your last VOD into LevlCast. It shows you where people stopped watching, down to the minute, and cuts clips from your best bits. Free to try, and ${offer} with my link: ${linkText}`,
    },
    {
      label: "Group chat",
      text: `Been using LevlCast on my streams. You paste a VOD and it tells you where people left and what to fix next time, and every stream ranks you on a ladder, Iron to Grandmaster, with weekly leagues. Free to try without an account, and ${offer} with my link: ${linkText}`,
    },
  ];

  return (
    <div className="ll-page lv2 pk">
      <header className="lv2-bar">
        <Link href="/" className="lv2-mark">LevlCast</Link>
        <span className="pk-bar-tag">Partner kit</span>
      </header>

      <section className="lv2-hero pk-hero">
        <p className="lv2-kicker">Partner kit · {code}</p>
        <h1 className="lv2-h1 pk-h1">
          <span className="lv2-h1-soft">Welcome in,</span>
          <br />
          {name}.
        </h1>
        <p className="lv2-sub">
          Everything for your link lives on this page. Bookmark it and come back whenever you need a line to paste.
        </p>
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">The deal</h2>
        <div className="lv2-price">
          <div className="lv2-plan">
            <p className="lv2-plan-n">Your viewers</p>
            <p className="lv2-plan-p">{percent}% off</p>
            <p className="lv2-plan-b">{dealLine}</p>
          </div>
          <div className="lv2-plan lv2-plan-lead">
            <p className="lv2-plan-n">You</p>
            <p className="lv2-plan-p">{share}%</p>
            <p className="lv2-plan-b">Of the revenue from every subscriber who comes through your link, every month they stay.</p>
          </div>
        </div>
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">Your link</h2>
        <div className="pk-link">
          <span className="pk-link-url">{linkText}</span>
          <CopyButton value={linkUrl} label="Copy link" />
        </div>
        <div className="pk-code">
          <span>
            The code <b>{code}</b> works too, typed at checkout.
          </span>
          <CopyButton value={code} label="Copy code" />
        </div>
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">What your viewers see</h2>
        <p className="pk-lede">
          This is the first thing on the homepage when someone arrives through your link. The discount comes off by
          itself when they upgrade, nothing to type.
        </p>
        <div className="pk-preview">
          <ReferralLine code={code} terms={terms} />
        </div>
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">Copy and paste</h2>
        <dl className="lv2-defs pk-lines">
          {lines.map((line) => (
            <div className="lv2-def" key={line.label}>
              <dt>{line.label}</dt>
              <dd>
                <span>{line.text}</span>
                <CopyButton value={line.text} />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">What to tell people</h2>
        <ol className="lv2-lines">
          <li>Paste any Twitch VOD. <em>Free, no account.</em></li>
          <li>It shows where people stopped watching. <em>Down to the minute.</em></li>
          <li>Every stream ranks you. <em>Iron to Grandmaster, with weekly leagues.</em></li>
          <li>Cozy and life-sim streams too. <em>The Sims, Stardew, Animal Crossing, inZOI.</em></li>
        </ol>
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">Your overlay</h2>
        <p className="pk-lede">
          Drop it into OBS as an image source, pin it in chat, or post it. Need a Twitch panel or a story size? Ask.
        </p>
        <OverlayPreview src={`/partners/${code.toLowerCase()}/banner.png`} code={code} />
      </section>

      <section className="lv2-sec pk-sec">
        <h2 className="lv2-h2">How you get paid</h2>
        <ol className="pk-steps">
          <li>Someone clicks your link. Your code stays saved in their browser for 30 days, so it still counts if they come back later.</li>
          <li>When they go Pro, the {percent}% comes off automatically and their subscription is tagged with your code.</li>
          <li>Every month Landon adds up the net revenue from your subscribers and sends you {share}% of it.</li>
          <li>If someone cancels, their share stops. As long as they stay, it keeps coming.</li>
          <li>Your first payout goes out once your first sale clears Stripe&apos;s 7-day chargeback window.</li>
        </ol>
      </section>

      <section className="lv2-sec pk-sec pk-contact">
        <h2 className="lv2-h2">Questions</h2>
        <p>
          A different banner size, a question about a payout, anything at all:{" "}
          <a href="mailto:Landon@LevlCast.com">Landon@LevlCast.com</a>
        </p>
      </section>

      <footer className="lv2-foot">
        <span>LevlCast</span>
        <span className="lv2-foot-links">
          <Link href="/">Home</Link>
          <Link href="/leaderboard">Leaderboard</Link>
        </span>
      </footer>
    </div>
  );
}
