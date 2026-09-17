import Link from "next/link";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";
import UrlPasteHero from "@/components/landing/UrlPasteHero";
import "./v2.css";

/**
 * Alternative homepage, parked at /v2 so it can be compared against the
 * live page before anything replaces it.
 *
 * The organising idea is that the VOD is the page. Every other streaming
 * tool's site is a centred headline over a product screenshot; this one is
 * built around a timeline, because a timeline is the only object this
 * product is actually about. The hero art is not decoration or a glow, it
 * is a stream drawn to scale with the things LevlCast finds marked on it.
 *
 * Deliberate departures from the live page:
 *  - Left-aligned, not centre-stacked. Everything centred is the house
 *    style of generated pages.
 *  - No cards. Structure comes from rules, indents and mono labels.
 *  - Far less prose. Most sections are a line, not a paragraph.
 *  - The accent is spent in exactly one place, the timeline. Everything
 *    else is neutral so that one thing lands.
 */

export const metadata: Metadata = {
  title: "LevlCast",
  description:
    "Paste a Twitch VOD and read a coaching report on it. No account required.",
  robots: { index: false, follow: false },
};

/** Marks on the hero timeline. Percentages are positions across the stream. */
const MARKS = [
  { at: 4, label: "Slow start", note: "8 minutes before anything happened", tone: "warn" },
  { at: 31, label: "Best bit", note: "You never clipped this one", tone: "good" },
  { at: 58, label: "Quiet", note: "17 minutes where nobody said much", tone: "bad" },
  { at: 86, label: "Ending", note: "You ran out of steam by hour three", tone: "warn" },
] as const;

export default function V2Page() {
  return (
    <div className="ll-page lv2">

      {/* ── Bar ── */}
      <header className="lv2-bar">
        <Link href="/" className="lv2-mark">LevlCast</Link>
        <div className="lv2-bar-right">
          <a
            className="lv2-ios"
            href="https://apps.apple.com/us/app/levlcast/id6761281566"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            iOS
          </a>
          <Link href="/auth/login" className="lv2-signin">Sign in</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lv2-hero">
        <p className="lv2-kicker">Twitch VOD coaching</p>
        <h1 className="lv2-h1">
          You streamed four hours.<br />
          <span className="lv2-h1-soft">Nobody told you what happened.</span>
        </h1>
        <p className="lv2-sub">
          Paste a link. We listen to the whole stream and tell you what went wrong and when.
        </p>
        <div className="lv2-paste">
          <UrlPasteHero />
        </div>
        <p className="lv2-fine">No account. No card. Works on anyone&apos;s stream.</p>
      </section>

      {/* ── The timeline ──
          The hero art. A stream drawn to scale with what we find marked on
          it. Everything here is CSS, so it stays sharp at any zoom, costs
          nothing to load, and cannot look like stock art. */}
      <section className="lv2-tl-wrap" aria-label="What a report marks on a stream">
        <div className="lv2-tl-head">
          <span className="lv2-tl-t">00:00</span>
          <span className="lv2-tl-cap">one stream, start to finish</span>
          <span className="lv2-tl-t">04:11</span>
        </div>

        <div className="lv2-tl">
          <div className="lv2-tl-track" />
          <div className="lv2-tl-dead" style={{ left: "52%", width: "11%" }} />
          {MARKS.map((m) => (
            <div key={m.label} className={`lv2-pin lv2-pin-${m.tone}`} style={{ left: `${m.at}%` }}>
              <span className="lv2-pin-stem" />
              <span className="lv2-pin-dot" />
            </div>
          ))}
        </div>

        <ul className="lv2-legend">
          {MARKS.map((m) => (
            <li key={m.label} className={`lv2-leg lv2-leg-${m.tone}`}>
              <span className="lv2-leg-l">{m.label}</span>
              <span className="lv2-leg-n">{m.note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Three lines ── */}
      <section className="lv2-sec">
        <ol className="lv2-lines">
          <li>Paste a link. <em>Yours, or someone you watch.</em></li>
          <li>See where people stopped watching. <em>Down to the minute.</em></li>
          <li>Sign in when you want more. <em>Not before.</em></li>
        </ol>
      </section>

      {/* ── What comes back ── */}
      <section className="lv2-sec" id="report">
        <h2 className="lv2-h2">What you get</h2>
        <dl className="lv2-defs">
          <div className="lv2-def">
            <dt>Score</dt>
            <dd>A score out of 100, and why you got it.</dd>
          </div>
          <div className="lv2-def">
            <dt>Quotes</dt>
            <dd>The things you said that made people leave.</dd>
          </div>
          <div className="lv2-def">
            <dt>Clips</dt>
            <dd>Your best bits, cut and ready to post.</dd>
          </div>
          <div className="lv2-def">
            <dt>Progress</dt>
            <dd>Did you fix what we told you last time?</dd>
          </div>
        </dl>
      </section>

      {/* ── Price ── */}
      <section className="lv2-sec" id="pricing">
        <h2 className="lv2-h2">Price</h2>
        <div className="lv2-price">
          <div className="lv2-plan">
            <p className="lv2-plan-n">Free</p>
            <p className="lv2-plan-p">$0</p>
            <p className="lv2-plan-b">Try it on any stream with no account. Sign in and you get two full reports and five clips.</p>
          </div>
          <div className="lv2-plan lv2-plan-lead">
            <p className="lv2-plan-n">Pro</p>
            <p className="lv2-plan-p">$14.99<span>/mo</span></p>
            <p className="lv2-plan-b">Fifteen full streams a month, twenty clips, and a history that shows if you are getting better.</p>
            <Link href="/auth/login?plan=monthly" className="lv2-cta">Start free</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lv2-sec" id="faq">
        <h2 className="lv2-h2">Questions</h2>
        <FaqAccordion
          items={[
            { q: "Do I need an account?", a: "Not to try it. Paste any Twitch stream link and you get a real report on the start of it. You only sign in when you want the whole stream read instead of the start." },
            { q: "Do you keep my streams?", a: "No. We listen to the audio while we work, then throw it away. We keep the report and any clips you make." },
            { q: "How long does it take?", a: "About a minute for the free one. About five minutes for a full two hour stream." },
            { q: "Does it work on small channels?", a: "Any channel. It does not matter if you have three viewers." },
          ]}
        />
      </section>

      <footer className="lv2-foot">
        <span>LevlCast</span>
        <span className="lv2-foot-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/">Current site</Link>
        </span>
      </footer>
    </div>
  );
}
