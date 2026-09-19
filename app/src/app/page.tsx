import Link from "next/link";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";
import UrlPasteHero from "@/components/landing/UrlPasteHero";
import "./home.css";

/**
 * Homepage.
 *
 * The organising idea is that the VOD is the page. Every other streaming
 * tool's site is a centred headline over a product screenshot; this one is
 * built around a timeline, because a timeline is the only object this
 * product is actually about. The hero art is not decoration or a glow, it
 * is a stream drawn to scale with the things LevlCast finds marked on it.
 *
 * Principles here, so later edits don't undo them:
 *  - Left-aligned, not centre-stacked. Everything centred is the house
 *    style of generated pages.
 *  - No cards. Structure comes from rules, indents and mono labels.
 *  - Far less prose. Most sections are a line, not a paragraph.
 *  - The accent is spent in one place, the timeline. Everything else is
 *    neutral so that one thing lands.
 *  - Plain English throughout. No jargon a new streamer has to decode.
 *
 * The previous design is preserved at /v1 so this can be reverted by
 * swapping two files if it converts worse.
 */

export const metadata: Metadata = {
  title: "LevlCast - Your Personal Streaming Manager",
  description:
    "Paste a Twitch stream link and read a real coaching report on it. Dead air, weak openings, the moments worth clipping. No account, no card.",
  alternates: { canonical: "/" },
};

/** Marks on the hero timeline. Percentages are positions across the stream. */
const MARKS = [
  { at: 4, label: "Slow start", note: "8 minutes before anything happened", tone: "warn" },
  { at: 31, label: "Best bit", note: "You never clipped this one", tone: "good" },
  { at: 58, label: "Quiet", note: "17 minutes where nobody said much", tone: "bad" },
  { at: 86, label: "Ending", note: "You ran out of steam by hour three", tone: "warn" },
] as const;

export default function HomePage() {
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
        {/* The dim half is the setup, not the punch. "You streamed four
            hours" is a fact the reader already knows, so it steps back and
            the question it sets up gets the weight. Asking something also
            beats asserting something: a claim invites disagreement, a
            question invites the reader to answer it, and the honest answer
            is the reason to paste a link. */}
        <h1 className="lv2-h1">
          <span className="lv2-h1-soft">You streamed four hours.</span><br />
          But did you perform?
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
          {/* Was "a score out of 100". The product does not lead with that
              number any more, so promising it here set up the wrong
              expectation before anyone even signed in. */}
          <div className="lv2-def">
            <dt>Points</dt>
            <dd>Every stream earns or loses points toward your next rank.</dd>
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

      {/* ── Rank ──
          Written the way the rest of the page is: short sentences, no
          marketing voice, nothing a streamer has to decode. The emblems do
          the selling, so the copy just explains the rule and gets out. */}
      <section className="lv2-sec" id="rank">
        <h2 className="lv2-h2">You get ranked</h2>
        <p className="lv2-rank-lede">
          Every stream you analyze earns or loses points toward your next rank,
          like any ladder you already grind. Iron at the bottom, Grandmaster at
          the top.
        </p>

        <div className="lv2-rank-strip" aria-hidden="true">
          {["iron", "bronze", "silver", "gold", "platinum", "diamond", "master", "grandmaster"].map((tier) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={tier} src={`/ranks/${tier}.png`} alt="" loading="lazy" />
          ))}
        </div>

        <dl className="lv2-defs">
          <div className="lv2-def">
            <dt>You climb</dt>
            <dd>By beating your own last few streams. Not by being big.</dd>
          </div>
          <div className="lv2-def">
            <dt>Bad night</dt>
            <dd>Costs you less than a good one earns. One stream never drops your rank.</dd>
          </div>
          <div className="lv2-def">
            <dt>Going up</dt>
            <dd>Gets harder the higher you are. Iron is quick. Grandmaster is not.</dd>
          </div>
          <div className="lv2-def">
            <dt>Everyone sees it</dt>
            <dd>
              The <Link href="/leaderboard">top 50</Link> are public.
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Clip editor ──
          Landon's screenshot. Given room rather than framed in a card, with
          the caption set as a single line above it, because the shot is
          detailed enough to be the whole argument on its own. */}
      <section className="lv2-sec" id="features">
        <h2 className="lv2-h2">The clip editor</h2>
        <p className="lv2-shot-cap">
          Trim it, fix the captions, pick the cover frame. Post it to YouTube without leaving.
        </p>
        <figure className="lv2-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/la/clip-editor.png"
            alt="The LevlCast clip editor: trim sliders, an editable caption list, caption style picker, hook frame chooser, and format and destination options"
            loading="lazy"
          />
        </figure>
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

      {/* ── iOS ──
          Landon's phone shot. Sits at the bottom as the closing pitch, and
          it is the one place a second image earns its keep: the dashboard
          on a real phone says "this is finished software" faster than any
          sentence about it could. */}
      <section className="lv2-ios-sec">
        <div className="lv2-ios-copy">
          <h2 className="lv2-h2">On your phone</h2>
          <p className="lv2-ios-h">
            Read the report in bed<br />
            <span className="lv2-h1-soft">right after you go offline.</span>
          </p>
          <p className="lv2-ios-b">
            Same reports, same clips, on iOS. Free either way, no credit card.
          </p>
          <div className="lv2-ios-btns">
            <a
              className="lv2-store"
              href="https://apps.apple.com/us/app/levlcast/id6761281566"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="17" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.6 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.3.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.2-2.5.7-.9 1.3-2.1 1.7-3.4-2.5-1-3.3-3.6-3.3-3.6Zm-2.6-7c.7-.9 1.2-2.1 1.1-3.3-1 .1-2.3.7-3 1.6-.7.7-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z"/>
              </svg>
              <span>
                <span className="lv2-store-top">Download on the</span>
                <span className="lv2-store-main">App Store</span>
              </span>
            </a>
            <Link href="/auth/login" className="lv2-cta">Get your first report free</Link>
          </div>
        </div>
        <div className="lv2-ios-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/la/newphone.png" alt="The LevlCast dashboard on iPhone" loading="lazy" />
        </div>
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
