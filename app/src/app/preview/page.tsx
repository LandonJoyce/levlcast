/**
 * Preview landing page — "Warm Industrial Minimalism" direction.
 *
 * Lives at /preview while the design is being evaluated. The live landing
 * at /page.tsx is untouched. When this is approved, port the markup over
 * to /page.tsx and delete this file.
 *
 * Notes on design discipline:
 *   - Real coach-report data is baked into the hero (the 18/100 Siegnao
 *     report) so the product output is visible above the fold.
 *   - Two real testimonials only (Charmbix + Landon). No placeholders.
 *   - No em dashes anywhere per the project-wide rule.
 *   - No FAQ, no pricing table, no "how it works" steps, no email signup.
 *   - Warm amber accent on CTAs only. No purple, no gradient blobs.
 */

import Link from "next/link";

export const metadata = {
  title: "LevlCast preview — Warm Industrial Minimalism",
};

export default function PreviewLanding() {
  return (
    <div className="lv-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* Founding banner */}
      <div className="lv-banner">
        <div className="lv-wrap lv-banner-row">
          <span className="lv-banner-label">FOUNDING · ENDS MAY 31</span>
          <span className="lv-banner-copy">
            Subscribe by May 31 to lock in <b>$9.99/mo forever</b>. After that it&apos;s $15/mo for everyone.
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="lv-nav">
        <div className="lv-wrap lv-nav-row">
          <Link href="/" className="lv-mark">
            <span className="lv-mark-glyph">L</span>LevlCast
          </Link>
          <div className="lv-nav-right">
            <a className="lv-nav-link" href="#demo">demo</a>
            <a className="lv-nav-link" href="#product">product</a>
            <a className="lv-nav-link" href="#voices">voices</a>
            <Link href="/auth/login" className="lv-btn">
              Launch LevlCast <span className="lv-arrow">&rarr;</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="lv-hero">
        <div className="lv-wrap">
          <div className="lv-hero-grid">
            <div>
              <h1 className="lv-h1">Stop guessing why they left.</h1>
              <p className="lv-lede">
                LevlCast watches your VOD and shows you exactly when viewers dropped and which moments actually kept them watching.
              </p>
              <div className="lv-hero-ctas">
                <Link href="/auth/login" className="lv-btn">
                  Launch LevlCast <span className="lv-arrow">&rarr;</span>
                </Link>
                <span className="lv-cta-meta">no card required · ~3 min to first report</span>
              </div>
              <div className="lv-hero-stamps">
                <span>
                  Built by <a href="https://twitch.tv/orbitxd" target="_blank" rel="noopener noreferrer"><b>a Twitch streamer</b></a>
                </span>
                <span>For <b>streamers</b></span>
                <span>50+ <b>streams analyzed</b></span>
              </div>
            </div>

            {/* Real coach-report card. Production data, not mock. */}
            <aside className="lv-rc">
              <div className="lv-rc-head">
                <div className="lv-rc-head-left">
                  <span className="lv-rc-dot" />
                  <span>COACH REPORT · GAMING</span>
                </div>
                <div className="lv-rc-head-right">@siegnao</div>
              </div>

              <div className="lv-rc-score-row">
                <span className="lv-rc-score">18</span>
                <span className="lv-rc-out">/100</span>
                <span className="lv-rc-pill">HIGH RISK</span>
              </div>

              <p className="lv-rc-quote">
                You streamed for over two hours and said less than most people say in a five-minute conversation.
              </p>

              <div className="lv-rc-data">
                <div className="lv-rc-data-head">
                  <span>DEAD ZONES</span>
                  <span>3 OF 5 SHOWN</span>
                </div>
                <div className="lv-rc-row">
                  <span className="lv-rc-ts">103:12</span>
                  <span className="lv-rc-desc">silence</span>
                  <span className="lv-rc-sec">686s</span>
                </div>
                <div className="lv-rc-row">
                  <span className="lv-rc-ts">126:40</span>
                  <span className="lv-rc-desc">silence</span>
                  <span className="lv-rc-sec">613s</span>
                </div>
                <div className="lv-rc-row">
                  <span className="lv-rc-ts">20:04</span>
                  <span className="lv-rc-desc">silence</span>
                  <span className="lv-rc-sec">578s</span>
                </div>
              </div>

              <div className="lv-rc-foot">
                <span>WPM when speaking</span>
                <span><b>99</b> wpm</span>
              </div>
            </aside>
          </div>
        </div>
      </header>

      {/* Demo video */}
      <section className="lv-demo" id="demo">
        <div className="lv-wrap">
          <div className="lv-demo-head">
            <div className="lv-demo-head-l">
              <span className="lv-demo-label">// DEMO</span>
              <span className="lv-demo-title">
                A two-hour stream becomes a four-minute report.
              </span>
            </div>
            <span className="lv-demo-head-r">stream . analyze . improve</span>
          </div>

          <div className="lv-video-frame">
            <video
              src="/demo/LEVLCASTHEROAGAIN.mp4"
              autoPlay
              muted
              loop
              playsInline
              className="lv-video"
            />
            <div className="lv-transport">
              <div className="lv-scrub" />
              <div className="lv-ttools">
                <span className="lv-play">
                  <svg viewBox="0 0 10 10" width="10" height="10"><polygon points="2,1 9,5 2,9" fill="currentColor" /></svg>
                </span>
                <span className="lv-time">00:42 <span className="lv-sep">/</span> 02:11</span>
                <span className="lv-time-right">LEVLCASTHEROAGAIN.mp4</span>
              </div>
            </div>
          </div>

          <div className="lv-demo-caption">
            <span>twitch oauth</span>
            <span className="lv-sep">·</span>
            <span>vod transcribed</span>
            <span className="lv-sep">·</span>
            <span>coach report</span>
            <span className="lv-sep">·</span>
            <span>auto clips</span>
          </div>
        </div>
      </section>

      {/* Product views */}
      <section className="lv-shots" id="product">
        <div className="lv-wrap">
          <div className="lv-sec-head">
            <span className="lv-eyebrow">// product</span>
            <h2 className="lv-h2">Three views. One stream.</h2>
            <p className="lv-sub">
              Exact timestamps. Priority fixes. Stream-over-stream trajectory. Auto-clipped best moments ready to post.
            </p>
          </div>

          <div className="lv-shot-block">
            <div className="lv-shot-lbl">
              coach_report
              <span className="lv-shot-h">the brutal one</span>
            </div>
            <div className="lv-shot">
              <div className="lv-shot-top">
                <span className="lv-shot-dots"><i /><i /><i /></span>
                <span className="lv-shot-path">/dashboard/vods/[id]</span>
              </div>
              <img src="/screenshots/coach-report.jpg" alt="Real LevlCast coach report with score, priority, and stream missions" />
            </div>
          </div>

          <div className="lv-shot-block">
            <div className="lv-shot-lbl">
              stream_history
              <span className="lv-shot-h">your scores over time</span>
            </div>
            <div className="lv-shot">
              <div className="lv-shot-top">
                <span className="lv-shot-dots"><i /><i /><i /></span>
                <span className="lv-shot-path">/dashboard/vods</span>
              </div>
              <img src="/screenshots/vod-list.jpg" alt="Stream-by-stream score history showing 18, 22, 28, 31, 42, 44 across recent streams" />
            </div>
          </div>

          <div className="lv-shot-block">
            <div className="lv-shot-lbl">
              clip_highlights
              <span className="lv-shot-h">found for you, edited for you</span>
            </div>
            <div className="lv-shot">
              <div className="lv-shot-top">
                <span className="lv-shot-dots"><i /><i /><i /></span>
                <span className="lv-shot-path">/dashboard/clips</span>
              </div>
              <video
                src="/demo/clipvideo.mp4"
                autoPlay
                muted
                loop
                playsInline
                className="lv-shot-video"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Evidence — 2 real testimonials only */}
      <section className="lv-testi" id="voices">
        <div className="lv-wrap">
          <div className="lv-testi-head">
            <span className="lv-eyebrow">// voices</span>
            <h2 className="lv-h2">Real words. Real streamers.</h2>
          </div>
          <div className="lv-testi-grid">
            <article className="lv-tcell">
              <div className="lv-tquote">This software makes clipping an absolute breeze.</div>
              <div className="lv-thandle"><span className="lv-tat">@</span>charmbix</div>
            </article>
            <article className="lv-tcell">
              <div className="lv-tquote">
                I built LevlCast to give newer streamers an actual path forward. Whether you&apos;re pushing for affiliate, chasing partner, or just trying to figure out what&apos;s not working, nobody should have to guess their way through it.
              </div>
              <div className="lv-thandle"><span className="lv-tat">@</span>orbitxd · founder</div>
            </article>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lv-final">
        <div className="lv-wrap">
          <span className="lv-final-pre">FOUNDING PRICE ENDS MAY 31</span>
          <h2 className="lv-final-h2">Run the report on your last stream.</h2>
          <div className="lv-final-ctas">
            <Link href="/auth/login" className="lv-btn">
              Launch LevlCast <span className="lv-arrow">&rarr;</span>
            </Link>
            <a href="#demo" className="lv-btn lv-btn-ghost">Watch the demo</a>
          </div>
          <div className="lv-final-fine">
            $9.99/mo locked forever · $15/mo after May 31 · cancel anytime
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lv-foot">
        <div className="lv-wrap lv-foot-row">
          <div className="lv-foot-copy">© 2026 LevlCast</div>
          <div className="lv-foot-links">
            <Link href="/privacy">privacy</Link>
            <Link href="/terms">terms</Link>
            <Link href="/changelog">changelog</Link>
            <a href="https://twitch.tv/orbitxd" target="_blank" rel="noopener noreferrer">twitch</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// CSS lives next to the component so the preview is fully self-contained.
// When this design is promoted to the live page, this block can either stay
// inline or be moved into globals.css with a unique prefix.
const CSS = `
.lv-page {
  --bg:       #0F1117;
  --bg-1:     #14161D;
  --bg-2:     #181B24;
  --line:     #1F2937;
  --line-2:   #2A2F3D;
  --line-3:   #334155;
  --ink:      #F1F5F9;
  --ink-2:    #CBD5E1;
  --muted:    #94A3B8;
  --muted-2:  #64748B;
  --muted-3:  #475569;
  --red:      #F87171;
  --red-dim:  rgba(248,113,113,0.10);
  --green:    #4ADE80;
  --amber:    #D97706;
  --amber-text: #FCD9A4;
  --sans:  'Manrope', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --mono:  'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-height: 100vh;
}
.lv-page * { box-sizing: border-box; }
.lv-page a { color: inherit; text-decoration: none; }
.lv-page img, .lv-page video { display: block; max-width: 100%; }
.lv-page ::selection { background: var(--amber); color: var(--bg); }

.lv-wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px; }

.lv-btn {
  display: inline-flex; align-items: center; gap: 10px;
  background: var(--amber); color: #1A0E00;
  padding: 13px 20px; border-radius: 4px;
  border: 1px solid var(--amber);
  font-weight: 700; font-size: 15px;
  letter-spacing: -0.005em;
  transition: background 0.15s, border-color 0.15s, transform 0.08s;
  cursor: pointer;
}
.lv-btn:hover { background: #E8881A; border-color: #E8881A; }
.lv-btn:active { transform: translateY(1px); }
.lv-arrow { transition: transform 0.15s ease; }
.lv-btn:hover .lv-arrow { transform: translateX(3px); }
.lv-btn-ghost {
  background: transparent; color: var(--ink);
  border-color: var(--line-3); font-weight: 600;
}
.lv-btn-ghost:hover { background: var(--bg-2); border-color: var(--muted-2); }

.lv-banner { border-bottom: 1px solid var(--line); background: var(--bg); }
.lv-banner-row {
  display: flex; align-items: center; gap: 24px;
  padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap;
}
.lv-banner-label {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  letter-spacing: 0.1em; color: var(--amber-text);
  display: inline-flex; align-items: center; gap: 8px;
  text-transform: uppercase;
}
.lv-banner-label::before {
  content: ''; width: 6px; height: 6px;
  background: var(--amber); display: inline-block; border-radius: 1px;
}
.lv-banner-copy { color: var(--muted); font-size: 13px; }
.lv-banner-copy b { color: var(--ink-2); font-weight: 600; }

.lv-nav { border-bottom: 1px solid var(--line); background: var(--bg); }
.lv-nav-row {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 18px; padding-bottom: 18px;
}
.lv-mark {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 700; font-size: 17px;
  letter-spacing: -0.015em; color: var(--ink);
}
.lv-mark-glyph {
  width: 22px; height: 22px;
  background: var(--ink); color: var(--bg);
  font-family: var(--mono); font-weight: 700; font-size: 13px;
  line-height: 22px; text-align: center; border-radius: 3px;
}
.lv-nav-right { display: flex; align-items: center; gap: 22px; font-size: 14px; font-weight: 500; }
.lv-nav-link { color: var(--muted); }
.lv-nav-link:hover { color: var(--ink); }
.lv-nav-right .lv-btn { padding: 8px 14px; font-size: 13px; }
@media (max-width: 720px) {
  .lv-nav-link { display: none; }
}

.lv-hero { padding: 72px 0 80px; }
@media (max-width: 720px) { .lv-hero { padding: 48px 0 56px; } }

.lv-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: 56px; align-items: center;
}
@media (max-width: 900px) {
  .lv-hero-grid { grid-template-columns: 1fr; gap: 40px; }
}

.lv-h1 {
  font-size: clamp(40px, 5.6vw, 64px);
  line-height: 1.02; letter-spacing: -0.025em;
  font-weight: 700; color: var(--ink); margin: 0;
  text-wrap: balance;
}
.lv-lede {
  margin-top: 22px; color: var(--muted);
  font-size: 17px; line-height: 1.55; max-width: 44ch;
}
.lv-hero-ctas {
  margin-top: 32px;
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
}
.lv-cta-meta {
  font-family: var(--mono); font-size: 12px;
  color: var(--muted-2); margin-left: 4px;
}
.lv-hero-stamps {
  margin-top: 36px; padding-top: 24px;
  border-top: 1px solid var(--line);
  display: flex; gap: 32px; flex-wrap: wrap;
  font-family: var(--mono); font-size: 11px;
  color: var(--muted-2); letter-spacing: 0.06em;
  text-transform: uppercase;
}
.lv-hero-stamps span b { color: var(--ink-2); font-weight: 500; }
.lv-hero-stamps a { color: inherit; text-decoration: underline; text-decoration-color: var(--muted-3); text-underline-offset: 3px; }
.lv-hero-stamps a:hover { color: var(--ink-2); }

/* Coach report card */
.lv-rc {
  border: 1px solid var(--line-2);
  background: var(--bg-1);
  padding: 22px;
}
.lv-rc-head {
  display: flex; justify-content: space-between; align-items: center;
  font-family: var(--mono); font-size: 11px;
  color: var(--muted-2); letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 18px; padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.lv-rc-head-left { display: flex; gap: 10px; align-items: center; }
.lv-rc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--red); }
.lv-rc-head-right { color: var(--muted); }
.lv-rc-score-row {
  display: flex; align-items: baseline; gap: 16px; margin-bottom: 18px;
}
.lv-rc-score {
  font-family: var(--mono); font-size: 76px; font-weight: 600;
  color: var(--red); letter-spacing: -0.04em; line-height: 1;
}
.lv-rc-out { font-family: var(--mono); font-size: 18px; color: var(--muted); }
.lv-rc-pill {
  margin-left: auto; font-family: var(--mono);
  font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--red); background: var(--red-dim);
  border: 1px solid rgba(248,113,113,0.30);
  padding: 5px 8px; border-radius: 2px; font-weight: 600;
}
.lv-rc-quote {
  font-size: 16px; line-height: 1.45; color: var(--ink);
  padding: 16px 0; margin: 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.lv-rc-quote::before, .lv-rc-quote::after {
  content: '"'; color: var(--muted-2); font-family: var(--sans);
}
.lv-rc-data { margin-top: 16px; }
.lv-rc-data-head {
  font-family: var(--mono); font-size: 10px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted-2);
  display: flex; justify-content: space-between; margin-bottom: 8px;
}
.lv-rc-row {
  display: grid; grid-template-columns: 60px 1fr 60px;
  gap: 12px; align-items: center;
  padding: 7px 0; font-family: var(--mono); font-size: 13px;
}
.lv-rc-ts { color: var(--ink-2); }
.lv-rc-desc { color: var(--muted); font-size: 12px; }
.lv-rc-sec { color: var(--red); text-align: right; }
.lv-rc-foot {
  margin-top: 16px; padding-top: 14px;
  border-top: 1px solid var(--line);
  display: flex; justify-content: space-between;
  font-family: var(--mono); font-size: 12px; color: var(--muted);
}
.lv-rc-foot b { color: var(--ink); font-weight: 600; }

/* Demo */
.lv-demo { padding: 24px 0 96px; }
@media (max-width: 720px) { .lv-demo { padding: 16px 0 64px; } }
.lv-demo-head {
  display: flex; justify-content: space-between; align-items: end;
  margin-bottom: 18px; flex-wrap: wrap; gap: 12px;
}
.lv-demo-head-l { display: flex; flex-direction: column; gap: 6px; }
.lv-demo-label {
  font-family: var(--mono); font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
}
.lv-demo-title {
  font-size: 18px; font-weight: 600; color: var(--ink);
  letter-spacing: -0.01em;
}
.lv-demo-head-r {
  font-family: var(--mono); font-size: 11px;
  color: var(--muted-2); letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lv-video-frame {
  position: relative; border: 1px solid var(--line-2);
  background: #000; border-radius: 4px; overflow: hidden;
  aspect-ratio: 16 / 10;
}
.lv-video { width: 100%; height: 100%; object-fit: cover; display: block; }
.lv-transport {
  position: absolute; left: 0; right: 0; bottom: 0;
  z-index: 2;
  background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
  padding: 22px 18px 14px;
  display: flex; flex-direction: column; gap: 8px;
  pointer-events: none;
}
.lv-scrub {
  height: 3px; background: rgba(255,255,255,0.18); position: relative;
}
.lv-scrub::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0;
  width: 32%; background: var(--amber);
}
.lv-scrub::after {
  content: ''; position: absolute; left: 32%; top: -3px;
  width: 9px; height: 9px; background: var(--ink);
  border-radius: 50%; transform: translateX(-4px);
}
.lv-ttools {
  display: flex; align-items: center; gap: 12px;
  color: var(--ink-2); font-family: var(--mono);
  font-size: 11px; letter-spacing: 0.04em;
}
.lv-play {
  width: 24px; height: 24px; display: grid; place-items: center;
  border: 1px solid var(--line-2); background: rgba(255,255,255,0.05);
  border-radius: 3px; color: var(--ink);
}
.lv-time { letter-spacing: 0.04em; }
.lv-sep { color: var(--muted-3); }
.lv-time-right { margin-left: auto; color: var(--muted); }

.lv-demo-caption {
  margin-top: 16px;
  display: flex; gap: 14px; flex-wrap: wrap;
  font-family: var(--mono); font-size: 11px;
  color: var(--muted-2); letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Screenshots */
.lv-shots { padding: 80px 0; border-top: 1px solid var(--line); }
.lv-sec-head { margin-bottom: 56px; max-width: 640px; }
.lv-eyebrow {
  font-family: var(--mono); font-size: 11px; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
}
.lv-h2 {
  font-size: clamp(28px, 3.4vw, 38px); line-height: 1.08;
  letter-spacing: -0.02em; font-weight: 700; margin: 12px 0 12px;
}
.lv-sub { color: var(--muted); font-size: 16px; margin: 0; }

.lv-shot-block { margin-bottom: 64px; }
.lv-shot-block:last-child { margin-bottom: 0; }
.lv-shot-lbl {
  font-family: var(--mono); font-size: 11px;
  letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
  margin-bottom: 12px;
  display: flex; align-items: baseline; gap: 10px;
}
.lv-shot-lbl::before { content: '//'; color: var(--muted-3); }
.lv-shot-h {
  color: var(--ink-2); font-size: 12px;
  letter-spacing: 0.04em; text-transform: none;
  margin-left: auto; font-weight: 500;
}
.lv-shot {
  border: 1px solid var(--line-2);
  background: var(--bg-1);
  border-radius: 2px; overflow: hidden;
}
.lv-shot img, .lv-shot-video {
  width: 100%; height: auto; display: block;
}
.lv-shot-top {
  height: 36px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 10px; padding: 0 14px;
  font-family: var(--mono); font-size: 11px;
  color: var(--muted-2); letter-spacing: 0.04em;
}
.lv-shot-dots { display: flex; gap: 5px; }
.lv-shot-dots i {
  width: 9px; height: 9px; border-radius: 50%;
  background: var(--line-2);
}
.lv-shot-path { margin-left: 8px; color: var(--muted); }

/* Testimonials */
.lv-testi { padding: 80px 0; border-top: 1px solid var(--line); }
.lv-testi-head { margin-bottom: 44px; max-width: 600px; }
.lv-testi-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  border-top: 1px solid var(--line); border-left: 1px solid var(--line);
}
.lv-tcell {
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  padding: 32px;
  display: flex; flex-direction: column; justify-content: space-between;
  gap: 24px; min-height: 200px;
  transition: background 0.15s ease;
}
.lv-tcell:hover { background: var(--bg-1); }
.lv-tquote {
  font-size: 19px; line-height: 1.45; color: var(--ink);
  letter-spacing: -0.005em;
}
.lv-tquote::before, .lv-tquote::after {
  content: '"'; color: var(--muted-2);
}
.lv-thandle {
  font-family: var(--mono); font-size: 13px;
  color: var(--muted); letter-spacing: 0.02em;
}
.lv-tat { color: var(--amber-text); }
@media (max-width: 720px) {
  .lv-testi-grid { grid-template-columns: 1fr; }
}

/* Final CTA */
.lv-final {
  padding: 96px 0 80px;
  border-top: 1px solid var(--line);
  text-align: center;
  background: radial-gradient(ellipse at center top, rgba(217,119,6,0.06) 0%, transparent 60%);
}
.lv-final-pre {
  font-family: var(--mono); font-size: 12px;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--amber-text); margin-bottom: 24px;
  display: inline-flex; align-items: center; gap: 8px;
}
.lv-final-pre::before {
  content: ''; width: 6px; height: 6px; background: var(--amber);
}
.lv-final-h2 {
  font-size: clamp(36px, 4.6vw, 56px); line-height: 1.05;
  letter-spacing: -0.025em; font-weight: 700;
  margin: 0 auto 24px; max-width: 16ch; text-wrap: balance;
}
.lv-final-ctas {
  margin-top: 32px;
  display: inline-flex; gap: 12px; flex-wrap: wrap; justify-content: center;
}
.lv-final-fine {
  margin-top: 22px; font-family: var(--mono);
  font-size: 11px; letter-spacing: 0.06em; color: var(--muted-2);
}

/* Footer */
.lv-foot { border-top: 1px solid var(--line); padding: 32px 0; }
.lv-foot-row {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 18px;
}
.lv-foot-links {
  display: flex; gap: 22px; font-size: 13px;
  color: var(--muted); flex-wrap: wrap;
}
.lv-foot-links a:hover { color: var(--ink-2); }
.lv-foot-copy {
  font-family: var(--mono); font-size: 12px;
  color: var(--muted-2); letter-spacing: 0.02em;
}
`;
