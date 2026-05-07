import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";

const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  axes: ["opsz", "SOFT"],
  variable: "--mk-display",
});
const body = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--mk-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--mk-mono" });

export const metadata = { title: "LevlCast · Mockup", robots: { index: false, follow: false } };

export default function MockupEditorial() {
  return (
    <div className={`${display.variable} ${body.variable} ${mono.variable} mk-page`}>
      <style>{css}</style>

      {/* Masthead */}
      <header className="mk-masthead">
        <div className="mk-masthead-row">
          <span className="mk-mono">Issue №01</span>
          <span className="mk-mono mk-masthead-title">LEVLCAST</span>
          <span className="mk-mono">May · 2026</span>
        </div>
        <div className="mk-rule" />
      </header>

      {/* Hero — asymmetric, editorial */}
      <section className="mk-hero">
        <div className="mk-hero-grid">
          <div className="mk-hero-meta">
            <div className="mk-mono mk-tag">§ 00 · Cover Story</div>
            <div className="mk-mono mk-byline">
              by L. Joyce<br />
              <span className="mk-dim">Vancouver, WA</span>
            </div>
          </div>

          <h1 className="mk-headline">
            Why your stream is<br />
            <em className="mk-em">losing people</em><br />
            <span className="mk-headline-thin">at minute&nbsp;47.</span>
          </h1>

          <aside className="mk-hero-sidenote">
            <div className="mk-mono mk-sidenote-label">Editor's note</div>
            <p>
              Most streamers blame their game, their schedule, or the algorithm.
              The VOD usually tells a different story. We built a tool that
              reads the tape and shows you the moment your audience checked out.
            </p>
          </aside>
        </div>

        <div className="mk-rule" />

        <div className="mk-lead-grid">
          <p className="mk-lead">
            <span className="mk-dropcap">Y</span>ou stream four hours. Forty-three
            people watched the start. By the end, eleven are left. The
            dashboard tells you nobody clipped, nobody resubbed, and the
            average watch time was twenty-two minutes. None of those numbers
            tell you <em>why</em>. LevlCast does. We watch the tape, mark the
            moment people leave, and hand you the clip that should have been
            posted instead.
          </p>

          <div className="mk-lead-cta">
            <Link href="/auth/login" className="mk-btn">Read your first stream — free</Link>
            <div className="mk-mono mk-cta-note">
              No credit card. One VOD per month at no charge.<sup>1</sup>
            </div>
          </div>
        </div>
      </section>

      {/* § 01 — The problem */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-mono mk-section-num">§ 01</span>
          <h2 className="mk-section-title">The problem with the dashboard you already have.</h2>
        </div>

        <div className="mk-cols">
          <div className="mk-col-text">
            <p>
              Twitch tells you <em>what</em> happened. Average viewers, follows,
              subs, total minutes. It does not tell you <em>when</em> your audience
              left the room. Or what was happening on screen when they did. Or
              whether the bit you thought was good actually landed.
            </p>
            <p>
              Most streamers fill that gap with vibes. We watched a top-100
              category streamer burn three weeks rebuilding their schedule
              because they thought their start time was the problem. It wasn't.
              The problem was a fourteen-minute dead patch around the second
              game where they stopped narrating. Numbers can't show you that.
              The tape can.
            </p>
          </div>

          <figure className="mk-figure">
            <img src="/la/ss-timeline.png" alt="" className="mk-fig-img" />
            <figcaption className="mk-figcap">
              <span className="mk-mono">Fig. 1</span> &nbsp;A real VOD timeline.
              The drop at <span className="mk-mono">28:14</span> cost this streamer
              22% of their concurrent viewers in three minutes.
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="mk-divider">
        <span className="mk-mono">·   ·   ·</span>
      </div>

      {/* Pull quote */}
      <section className="mk-quote-section">
        <blockquote className="mk-quote">
          <span className="mk-quote-mark">&ldquo;</span>
          I'd been streaming for two years and I never knew the part I thought was
          my best moment was actually where everyone left. The report is brutal.
          I needed it.
        </blockquote>
        <div className="mk-quote-attr">
          <span className="mk-mono">— Charmbix · Variety streamer · 2.4k followers</span>
        </div>
      </section>

      {/* § 02 — How it works */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-mono mk-section-num">§ 02</span>
          <h2 className="mk-section-title">How the report gets made.</h2>
        </div>

        <ol className="mk-steps">
          <li className="mk-step">
            <div className="mk-step-num">i.</div>
            <div className="mk-step-body">
              <h3 className="mk-step-title">We pull your last VOD straight from Twitch.</h3>
              <p>
                One click. No file uploads, no OBS recordings to dig out of a
                folder you forgot about. We auth through Twitch and your last
                stream shows up in the queue.
              </p>
            </div>
          </li>

          <li className="mk-step">
            <div className="mk-step-num">ii.</div>
            <div className="mk-step-body">
              <h3 className="mk-step-title">A model with no ego watches the whole thing.</h3>
              <p>
                We transcribe with diarization, isolate your voice from game audio,
                and feed the tape to Claude Sonnet. It marks the moments worth
                clipping, the moments people probably left, and the patterns
                across your last five streams.
              </p>
            </div>
          </li>

          <li className="mk-step">
            <div className="mk-step-num">iii.</div>
            <div className="mk-step-body">
              <h3 className="mk-step-title">You get a one-page report and three clips.</h3>
              <p>
                Score, the single thing to fix before next stream, and a short
                list of timestamps you can scrub to. Plus the actual clips,
                ready to post. No dashboard tabs to click through.
              </p>
            </div>
          </li>
        </ol>
      </section>

      {/* The report — annotated screenshot */}
      <section className="mk-section">
        <div className="mk-section-head">
          <span className="mk-mono mk-section-num">§ 03</span>
          <h2 className="mk-section-title">What the report actually looks like.</h2>
        </div>

        <figure className="mk-figure mk-figure-wide">
          <img src="/la/ss-coach-report.png" alt="" className="mk-fig-img" />
          <figcaption className="mk-figcap">
            <span className="mk-mono">Fig. 2</span> &nbsp;An actual report from
            a paid user, redacted. Score, the one thing to fix, and the moments
            worth clipping. We do not generate filler insights to pad the page.
          </figcaption>
        </figure>
      </section>

      <div className="mk-divider">
        <span className="mk-mono">·   ·   ·</span>
      </div>

      {/* Pricing — editorial endnote style */}
      <section className="mk-section mk-pricing">
        <div className="mk-section-head">
          <span className="mk-mono mk-section-num">§ 04</span>
          <h2 className="mk-section-title">What it costs.</h2>
        </div>

        <div className="mk-price-grid">
          <div className="mk-price-block">
            <div className="mk-mono mk-price-tag">Free</div>
            <div className="mk-price-num">$0</div>
            <p className="mk-price-body">
              One stream analyzed per month. Five clips. Streams up to six hours.
              Enough to find out if the report tells you anything you didn't
              already know.
            </p>
          </div>

          <div className="mk-price-block mk-price-pro">
            <div className="mk-mono mk-price-tag">Pro</div>
            <div className="mk-price-num">$9.99<span className="mk-price-cycle"> / mo</span></div>
            <p className="mk-price-body">
              Fifteen analyses per month. Twenty clips, ten-hour streams,
              priority processing, post straight to YouTube Shorts. Founding
              price; goes up at 100 users.
            </p>
            <Link href="/auth/login" className="mk-btn mk-btn-pro">Start with Pro</Link>
          </div>
        </div>
      </section>

      {/* Footnotes / signature */}
      <footer className="mk-foot">
        <div className="mk-rule" />
        <ol className="mk-footnotes">
          <li>
            <sup>1</sup> Free tier is one VOD per calendar month, up to six hours.
            We don't take credit card details until you decide to upgrade.
          </li>
        </ol>

        <div className="mk-sig">
          <div className="mk-sig-line">— L. Joyce</div>
          <div className="mk-mono mk-sig-meta">
            Founder, LevlCast · <Link href="/" className="mk-link">levlcast.com</Link>
          </div>
        </div>

        <div className="mk-mono mk-colophon">
          Set in Fraunces &amp; Inter. Hand-built in Vancouver, WA.<br />
          © 2026 LevlCast. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

const css = `
.mk-page {
  --mk-paper: #f6f1e8;
  --mk-ink: #1a1a18;
  --mk-ink-soft: #4a4842;
  --mk-ink-dim: #8a877e;
  --mk-rule: #1a1a18;
  --mk-accent: #b03a2e;
  background: var(--mk-paper);
  color: var(--mk-ink);
  font-family: var(--mk-body), -apple-system, sans-serif;
  font-size: 17px;
  line-height: 1.6;
  min-height: 100vh;
  padding: 0;
}
.mk-page * { box-sizing: border-box; }
.mk-mono { font-family: var(--mk-mono), monospace; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
.mk-dim { color: var(--mk-ink-dim); }
.mk-em { font-family: var(--mk-display), serif; font-style: italic; font-weight: 400; }
.mk-link { color: var(--mk-ink); text-decoration: underline; text-underline-offset: 3px; }
.mk-rule { height: 1px; background: var(--mk-rule); margin: 12px 0; }

/* Masthead */
.mk-masthead { padding: 24px 48px 0; max-width: 1100px; margin: 0 auto; }
.mk-masthead-row {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: 11px;
}
.mk-masthead-title { font-size: 13px; letter-spacing: 0.18em; font-weight: 500; }

/* Hero */
.mk-hero { max-width: 1100px; margin: 0 auto; padding: 32px 48px 48px; }
.mk-hero-grid {
  display: grid;
  grid-template-columns: 140px 1fr 220px;
  gap: 40px;
  align-items: start;
}
.mk-hero-meta { padding-top: 8px; }
.mk-tag { color: var(--mk-ink-dim); margin-bottom: 24px; }
.mk-byline { line-height: 1.6; color: var(--mk-ink); }

.mk-headline {
  font-family: var(--mk-display), serif;
  font-weight: 900;
  font-size: clamp(56px, 7.5vw, 104px);
  line-height: 0.95;
  letter-spacing: -0.025em;
  margin: 0;
  font-variation-settings: "opsz" 144;
}
.mk-headline .mk-em {
  font-weight: 400;
  font-style: italic;
  color: var(--mk-accent);
  font-variation-settings: "opsz" 144, "SOFT" 100;
}
.mk-headline-thin { font-weight: 400; font-style: italic; }

.mk-hero-sidenote {
  border-top: 1px solid var(--mk-ink);
  padding-top: 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--mk-ink-soft);
}
.mk-sidenote-label { color: var(--mk-ink); margin-bottom: 8px; }
.mk-hero-sidenote p { margin: 0; }

.mk-lead-grid {
  display: grid;
  grid-template-columns: 140px 1fr 220px;
  gap: 40px;
  margin-top: 32px;
  align-items: start;
}
.mk-lead {
  grid-column: 2;
  font-family: var(--mk-display), serif;
  font-size: 22px;
  line-height: 1.45;
  font-weight: 400;
  margin: 0;
  letter-spacing: -0.005em;
}
.mk-lead em { font-style: italic; }
.mk-dropcap {
  float: left;
  font-family: var(--mk-display), serif;
  font-weight: 900;
  font-size: 88px;
  line-height: 0.85;
  padding: 6px 10px 0 0;
  color: var(--mk-accent);
  font-variation-settings: "opsz" 144;
}
.mk-lead-cta { grid-column: 3; padding-top: 8px; }
.mk-cta-note { margin-top: 12px; color: var(--mk-ink-dim); line-height: 1.6; }

.mk-btn {
  display: inline-block;
  background: var(--mk-ink);
  color: var(--mk-paper);
  padding: 12px 18px;
  font-family: var(--mk-mono), monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  border: 1px solid var(--mk-ink);
  transition: all 150ms;
}
.mk-btn:hover { background: var(--mk-paper); color: var(--mk-ink); }
.mk-btn-pro { background: var(--mk-accent); border-color: var(--mk-accent); }
.mk-btn-pro:hover { background: var(--mk-paper); color: var(--mk-accent); border-color: var(--mk-accent); }

/* Sections */
.mk-section { max-width: 1100px; margin: 0 auto; padding: 56px 48px; }
.mk-section-head {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: 40px;
  margin-bottom: 32px;
  align-items: baseline;
  border-top: 2px solid var(--mk-ink);
  padding-top: 16px;
}
.mk-section-num { color: var(--mk-ink-dim); }
.mk-section-title {
  font-family: var(--mk-display), serif;
  font-weight: 700;
  font-size: clamp(28px, 3.4vw, 44px);
  line-height: 1.1;
  letter-spacing: -0.015em;
  margin: 0;
  font-variation-settings: "opsz" 96;
}

/* Two-column body */
.mk-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: start; }
.mk-col-text p { margin: 0 0 16px; }
.mk-col-text p:last-child { margin-bottom: 0; }

.mk-figure { margin: 0; }
.mk-figure-wide { grid-column: 1 / -1; max-width: 900px; margin: 0 auto; }
.mk-fig-img {
  display: block; width: 100%;
  border: 1px solid var(--mk-ink);
  background: #fff;
}
.mk-figcap {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--mk-ink-soft);
  font-style: italic;
  font-family: var(--mk-display), serif;
}
.mk-figcap .mk-mono { font-style: normal; color: var(--mk-ink); }

/* Divider */
.mk-divider {
  text-align: center;
  padding: 24px 0;
  color: var(--mk-ink-dim);
  letter-spacing: 0.4em;
}

/* Pull quote */
.mk-quote-section {
  max-width: 800px;
  margin: 0 auto;
  padding: 48px 48px;
  text-align: center;
}
.mk-quote {
  font-family: var(--mk-display), serif;
  font-size: clamp(24px, 3.2vw, 36px);
  line-height: 1.3;
  font-style: italic;
  font-weight: 400;
  margin: 0 0 16px;
  font-variation-settings: "opsz" 144;
  color: var(--mk-ink);
  position: relative;
}
.mk-quote-mark {
  font-family: var(--mk-display), serif;
  font-size: 80px;
  line-height: 0;
  position: relative;
  top: 20px;
  color: var(--mk-accent);
  margin-right: 4px;
}
.mk-quote-attr { color: var(--mk-ink-dim); }

/* Steps */
.mk-steps { list-style: none; padding: 0; margin: 0; }
.mk-step {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 32px;
  padding: 24px 0;
  border-top: 1px solid rgba(26,26,24,0.15);
  align-items: baseline;
}
.mk-step:first-child { border-top: 0; padding-top: 0; }
.mk-step-num {
  font-family: var(--mk-display), serif;
  font-style: italic;
  font-size: 32px;
  font-weight: 400;
  color: var(--mk-accent);
}
.mk-step-title {
  font-family: var(--mk-display), serif;
  font-size: 22px;
  font-weight: 500;
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}
.mk-step-body p { margin: 0; color: var(--mk-ink-soft); }

/* Pricing */
.mk-price-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.mk-price-block {
  border: 1px solid var(--mk-ink);
  padding: 28px;
  background: rgba(255,255,255,0.4);
}
.mk-price-pro { background: var(--mk-ink); color: var(--mk-paper); border-color: var(--mk-ink); }
.mk-price-pro .mk-price-body { color: rgba(246,241,232,0.75); }
.mk-price-tag { margin-bottom: 16px; color: var(--mk-ink-dim); }
.mk-price-pro .mk-price-tag { color: rgba(246,241,232,0.6); }
.mk-price-num {
  font-family: var(--mk-display), serif;
  font-size: 56px;
  font-weight: 900;
  line-height: 1;
  margin-bottom: 16px;
  font-variation-settings: "opsz" 144;
}
.mk-price-cycle { font-size: 16px; font-weight: 400; font-style: italic; color: var(--mk-ink-dim); }
.mk-price-body { font-size: 15px; line-height: 1.55; margin: 0 0 20px; color: var(--mk-ink-soft); }

/* Footer */
.mk-foot { max-width: 1100px; margin: 0 auto; padding: 32px 48px 64px; }
.mk-footnotes {
  list-style: none; padding: 0; margin: 24px 0;
  font-size: 13px; line-height: 1.6; color: var(--mk-ink-soft);
}
.mk-footnotes li { margin-bottom: 8px; }
.mk-footnotes sup { color: var(--mk-accent); margin-right: 4px; }
.mk-sig { margin: 32px 0 24px; }
.mk-sig-line {
  font-family: var(--mk-display), serif;
  font-style: italic;
  font-size: 28px;
  font-weight: 400;
}
.mk-sig-meta { color: var(--mk-ink-dim); margin-top: 4px; }
.mk-colophon { color: var(--mk-ink-dim); line-height: 1.6; margin-top: 24px; }

/* Responsive */
@media (max-width: 900px) {
  .mk-hero-grid, .mk-lead-grid, .mk-section-head {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .mk-lead { grid-column: 1; }
  .mk-lead-cta { grid-column: 1; }
  .mk-cols { grid-template-columns: 1fr; gap: 32px; }
  .mk-price-grid { grid-template-columns: 1fr; }
  .mk-step { grid-template-columns: 1fr; gap: 8px; }
  .mk-masthead, .mk-hero, .mk-section, .mk-foot, .mk-quote-section { padding-left: 24px; padding-right: 24px; }
}
`;
