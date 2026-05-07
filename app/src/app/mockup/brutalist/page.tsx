import Link from "next/link";

export const metadata = { title: "LevlCast · Brutalist", robots: { index: false, follow: false } };

export default function Brutalist() {
  return (
    <div className="bru-page">
      <style>{css}</style>

      {/* Top bar */}
      <header className="bru-top">
        <span className="bru-mark">LEVLCAST</span>
        <span className="bru-top-meta">EST. 2026 · VANCOUVER, WA · INDEX 001</span>
        <Link href="/auth/login" className="bru-top-cta">START →</Link>
      </header>

      {/* Hero — manifesto */}
      <section className="bru-hero">
        <div className="bru-hero-tag">FILE 01 · WHY WE EXIST</div>
        <h1 className="bru-h1">
          YOUR<br />
          DASHBOARD<br />
          <span className="bru-h1-strike">DOESN&apos;T KNOW</span><br />
          WHY YOU&apos;RE<br />
          <span className="bru-h1-accent">LOSING.</span>
        </h1>
        <div className="bru-hero-sub">
          THE TAPE DOES. WE READ IT FOR YOU.
        </div>
      </section>

      <div className="bru-band-thick" />

      {/* Big stats */}
      <section className="bru-stats">
        <div className="bru-stat">
          <div className="bru-stat-num">14<span className="bru-stat-unit">MIN</span></div>
          <div className="bru-stat-label">AVERAGE DEAD PATCH PER STREAM</div>
        </div>
        <div className="bru-stat">
          <div className="bru-stat-num">22<span className="bru-stat-unit">%</span></div>
          <div className="bru-stat-label">OF VIEWERS LOST IN UNDER 3 MIN</div>
        </div>
        <div className="bru-stat">
          <div className="bru-stat-num">0</div>
          <div className="bru-stat-label">DASHBOARDS THAT TELL YOU WHEN</div>
        </div>
      </section>

      <div className="bru-band-black">
        <div className="bru-band-text">WE READ THE TAPE. YOU FIX THE STREAM. NEXT.</div>
      </div>

      {/* The problem */}
      <section className="bru-block">
        <div className="bru-block-num">02</div>
        <div className="bru-block-title">WHAT TWITCH WON&apos;T TELL YOU.</div>
        <div className="bru-block-body">
          <p>TWITCH SHOWS YOU NUMBERS. AVG VIEWERS. FOLLOWS. SUBS. MINUTES WATCHED.</p>
          <p>NUMBERS DON&apos;T HAVE TIMESTAMPS. WHEN PEOPLE LEFT. WHAT WAS ON SCREEN. WHAT YOU SAID. WHAT YOU DIDN&apos;T.</p>
          <p>THE TAPE HAS ALL OF IT. NOBODY IS WATCHING THE TAPE.</p>
          <p className="bru-block-emph">UNTIL NOW.</p>
        </div>
      </section>

      <div className="bru-rule" />

      {/* How it works — three cards as hard blocks */}
      <section className="bru-block">
        <div className="bru-block-num">03</div>
        <div className="bru-block-title">PROCESS.</div>
        <div className="bru-steps">
          <div className="bru-step">
            <div className="bru-step-n">I</div>
            <div className="bru-step-t">CONNECT TWITCH</div>
            <div className="bru-step-b">ONE CLICK. WE PULL YOUR LAST VOD. NO UPLOADS. NO OBS FILES.</div>
          </div>
          <div className="bru-step">
            <div className="bru-step-n">II</div>
            <div className="bru-step-t">WE WATCH THE TAPE</div>
            <div className="bru-step-b">TRANSCRIBE. DIARIZE. ANALYZE. ABOUT 12 MINUTES PER HOUR OF VOD.</div>
          </div>
          <div className="bru-step">
            <div className="bru-step-n">III</div>
            <div className="bru-step-t">SCORE + CLIPS</div>
            <div className="bru-step-b">A SCORE OUT OF 100. THE ONE THING TO FIX. THREE CLIPS READY TO POST.</div>
          </div>
        </div>
      </section>

      <div className="bru-band-accent">
        <div className="bru-band-text bru-band-text-dark">NO FILLER. NO &ldquo;INSIGHTS.&rdquo; NO BULLSHIT.</div>
      </div>

      {/* The report — annotated screenshot */}
      <section className="bru-block">
        <div className="bru-block-num">04</div>
        <div className="bru-block-title">THE REPORT.</div>
        <div className="bru-shot-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/la/ss-coach-report.png" alt="" className="bru-shot" />
          <div className="bru-shot-caption">FIG. A · ACTUAL OUTPUT. NOT A MOCKUP. NOT A RENDER.</div>
        </div>
      </section>

      <div className="bru-rule" />

      {/* Pricing */}
      <section className="bru-block">
        <div className="bru-block-num">05</div>
        <div className="bru-block-title">PRICE.</div>
        <div className="bru-prices">
          <div className="bru-price">
            <div className="bru-price-tier">FREE</div>
            <div className="bru-price-num">$0</div>
            <ul className="bru-price-list">
              <li>1 STREAM / MONTH</li>
              <li>5 CLIPS</li>
              <li>UP TO 6 HOURS</li>
            </ul>
            <Link href="/auth/login" className="bru-price-cta">CLAIM →</Link>
          </div>
          <div className="bru-price bru-price-pro">
            <div className="bru-price-tier">PRO</div>
            <div className="bru-price-num">$9.99<span className="bru-price-cycle">/MO</span></div>
            <ul className="bru-price-list">
              <li>15 STREAMS / MONTH</li>
              <li>20 CLIPS</li>
              <li>UP TO 10 HOURS</li>
              <li>POST TO YOUTUBE SHORTS</li>
              <li>PRIORITY PROCESSING</li>
            </ul>
            <Link href="/auth/login" className="bru-price-cta bru-price-cta-pro">SUBSCRIBE →</Link>
          </div>
        </div>
        <div className="bru-price-note">FOUNDING PRICE. GOES UP AT 100 USERS. THIS IS NOT A MARKETING TRICK.</div>
      </section>

      {/* Final band */}
      <div className="bru-band-thick" />
      <section className="bru-final">
        <div className="bru-final-h">
          STOP GUESSING.<br />
          <span className="bru-final-h-accent">START READING THE TAPE.</span>
        </div>
        <Link href="/auth/login" className="bru-final-cta">GET YOUR FIRST REPORT →</Link>
      </section>

      <footer className="bru-foot">
        <span>LEVLCAST · 2026</span>
        <span>NOT VENTURE BACKED · BUILT BY ONE PERSON</span>
        <span>VANCOUVER, WA</span>
      </footer>
    </div>
  );
}

const css = `
.bru-page {
  --bru-bg: #f4f1e8;
  --bru-ink: #000;
  --bru-accent: #ff4500;
  background: var(--bru-bg);
  color: var(--bru-ink);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 500;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.bru-page * { box-sizing: border-box; margin: 0; }

.bru-top {
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 3px solid var(--bru-ink);
  padding: 16px 32px;
  font-size: 11px; letter-spacing: 0.18em; font-weight: 700;
  text-transform: uppercase;
}
.bru-mark { font-weight: 900; font-size: 14px; letter-spacing: 0.2em; }
.bru-top-cta {
  color: var(--bru-bg); background: var(--bru-ink);
  padding: 8px 14px; text-decoration: none;
}

/* Hero */
.bru-hero { padding: 64px 32px 80px; max-width: 1400px; margin: 0 auto; }
.bru-hero-tag { font-size: 11px; letter-spacing: 0.2em; font-weight: 700; margin-bottom: 24px; }
.bru-h1 {
  font-size: clamp(64px, 11vw, 180px);
  line-height: 0.85;
  letter-spacing: -0.04em;
  font-weight: 900;
  text-transform: uppercase;
}
.bru-h1-strike { text-decoration: line-through; text-decoration-thickness: 8px; }
.bru-h1-accent { color: var(--bru-accent); }
.bru-hero-sub {
  font-size: 18px; letter-spacing: 0.1em; font-weight: 700;
  text-transform: uppercase; margin-top: 32px;
  border-top: 2px solid var(--bru-ink);
  padding-top: 16px;
}

/* Bands */
.bru-band-thick { height: 24px; background: var(--bru-ink); }
.bru-rule { height: 2px; background: var(--bru-ink); margin: 0 32px; }
.bru-band-black {
  background: var(--bru-ink); color: var(--bru-bg);
  padding: 32px;
  text-align: center;
}
.bru-band-accent {
  background: var(--bru-accent); color: var(--bru-ink);
  padding: 32px;
  text-align: center;
}
.bru-band-text {
  font-size: clamp(20px, 3.5vw, 38px);
  font-weight: 900; letter-spacing: -0.01em;
  text-transform: uppercase;
}

/* Stats */
.bru-stats {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  border-top: 2px solid var(--bru-ink);
  border-bottom: 2px solid var(--bru-ink);
}
.bru-stat {
  padding: 48px 32px;
  border-right: 2px solid var(--bru-ink);
}
.bru-stat:last-child { border-right: 0; }
.bru-stat-num {
  font-size: clamp(80px, 11vw, 160px);
  font-weight: 900; line-height: 0.9;
  letter-spacing: -0.04em;
}
.bru-stat-unit {
  font-size: 0.4em; vertical-align: super;
  margin-left: 4px;
}
.bru-stat-label {
  font-size: 12px; font-weight: 700; letter-spacing: 0.15em;
  margin-top: 16px; text-transform: uppercase;
}

/* Blocks */
.bru-block { padding: 80px 32px; max-width: 1400px; margin: 0 auto; }
.bru-block-num {
  font-size: 14px; font-weight: 900; letter-spacing: 0.2em;
  margin-bottom: 16px;
}
.bru-block-title {
  font-size: clamp(40px, 6vw, 80px);
  font-weight: 900; line-height: 0.9; letter-spacing: -0.03em;
  text-transform: uppercase;
  margin-bottom: 48px;
  padding-bottom: 24px;
  border-bottom: 3px solid var(--bru-ink);
}
.bru-block-body p {
  font-size: clamp(20px, 2.5vw, 32px);
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.2;
  text-transform: uppercase;
  margin-bottom: 24px;
  max-width: 1200px;
}
.bru-block-emph { color: var(--bru-accent); }

/* Steps */
.bru-steps {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 0; border: 3px solid var(--bru-ink);
}
.bru-step {
  padding: 32px;
  border-right: 3px solid var(--bru-ink);
}
.bru-step:last-child { border-right: 0; }
.bru-step-n {
  font-size: 80px; font-weight: 900; line-height: 1;
  margin-bottom: 24px; letter-spacing: -0.04em;
}
.bru-step-t {
  font-size: 18px; font-weight: 900; letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--bru-ink);
}
.bru-step-b {
  font-size: 14px; font-weight: 600; letter-spacing: 0.05em;
  text-transform: uppercase; line-height: 1.5;
}

/* Screenshot */
.bru-shot-wrap { border: 3px solid var(--bru-ink); }
.bru-shot { display: block; width: 100%; }
.bru-shot-caption {
  background: var(--bru-ink); color: var(--bru-bg);
  padding: 12px 20px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.2em;
}

/* Pricing */
.bru-prices {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  border: 3px solid var(--bru-ink);
}
.bru-price {
  padding: 40px;
  border-right: 3px solid var(--bru-ink);
}
.bru-price:last-child { border-right: 0; }
.bru-price-pro { background: var(--bru-ink); color: var(--bru-bg); }
.bru-price-tier {
  font-size: 12px; font-weight: 900; letter-spacing: 0.25em;
  margin-bottom: 16px;
}
.bru-price-num {
  font-size: clamp(60px, 8vw, 96px);
  font-weight: 900; line-height: 0.9; letter-spacing: -0.04em;
  margin-bottom: 24px;
}
.bru-price-cycle { font-size: 0.3em; font-weight: 700; }
.bru-price-list {
  list-style: none; padding: 0; margin: 0 0 32px;
}
.bru-price-list li {
  font-size: 13px; font-weight: 700; letter-spacing: 0.1em;
  padding: 8px 0; text-transform: uppercase;
  border-bottom: 1px solid currentColor;
}
.bru-price-cta {
  display: inline-block;
  background: var(--bru-ink); color: var(--bru-bg);
  padding: 14px 24px; text-decoration: none;
  font-size: 13px; font-weight: 900; letter-spacing: 0.2em;
}
.bru-price-cta-pro { background: var(--bru-accent); color: var(--bru-ink); }
.bru-price-note {
  font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; margin-top: 16px;
}

/* Final */
.bru-final {
  padding: 96px 32px; max-width: 1400px; margin: 0 auto;
  text-align: center;
}
.bru-final-h {
  font-size: clamp(48px, 8vw, 120px);
  font-weight: 900; line-height: 0.9; letter-spacing: -0.04em;
  text-transform: uppercase;
}
.bru-final-h-accent { color: var(--bru-accent); }
.bru-final-cta {
  display: inline-block; margin-top: 48px;
  background: var(--bru-ink); color: var(--bru-bg);
  padding: 24px 40px; text-decoration: none;
  font-size: clamp(16px, 2vw, 24px); font-weight: 900; letter-spacing: 0.15em;
}

.bru-foot {
  display: flex; justify-content: space-between;
  border-top: 3px solid var(--bru-ink);
  padding: 20px 32px;
  font-size: 11px; font-weight: 700; letter-spacing: 0.18em;
}

@media (max-width: 800px) {
  .bru-stats, .bru-steps, .bru-prices { grid-template-columns: 1fr; }
  .bru-stat, .bru-step, .bru-price { border-right: 0; border-bottom: 2px solid currentColor; }
  .bru-stat:last-child, .bru-step:last-child, .bru-price:last-child { border-bottom: 0; }
  .bru-foot { flex-direction: column; gap: 8px; }
}
`;
