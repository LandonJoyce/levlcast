import Link from "next/link";

export const metadata = { title: "LevlCast · Desktop", robots: { index: false, follow: false } };

export default function DesktopMockup() {
  return (
    <div className="dt-page">
      <style>{css}</style>

      <div className="dt-window">
        {/* Title bar */}
        <div className="dt-titlebar">
          <div className="dt-tl-dots">
            <span className="dt-dot dt-red" />
            <span className="dt-dot dt-yellow" />
            <span className="dt-dot dt-green" />
          </div>
          <div className="dt-tl-title">LevlCast.app — Stream Report</div>
          <div className="dt-tl-meta">v1.0.2</div>
        </div>

        {/* Main */}
        <div className="dt-main">
          {/* Sidebar */}
          <aside className="dt-sidebar">
            <div className="dt-sb-section">
              <div className="dt-sb-h">Workspace</div>
              <div className="dt-sb-item dt-sb-active">⌂&nbsp;&nbsp;Dashboard</div>
              <div className="dt-sb-item">▷&nbsp;&nbsp;VODs <span className="dt-sb-badge">8</span></div>
              <div className="dt-sb-item">✂&nbsp;&nbsp;Clips <span className="dt-sb-badge">10</span></div>
              <div className="dt-sb-item">⚙&nbsp;&nbsp;Account</div>
            </div>
            <div className="dt-sb-section">
              <div className="dt-sb-h">Pages</div>
              <div className="dt-sb-item">→&nbsp;&nbsp;What is this</div>
              <div className="dt-sb-item">→&nbsp;&nbsp;How it works</div>
              <div className="dt-sb-item">→&nbsp;&nbsp;Pricing</div>
              <div className="dt-sb-item">→&nbsp;&nbsp;FAQ</div>
            </div>
            <div className="dt-sb-foot">
              <div className="dt-sb-user">
                <div className="dt-sb-avatar">L</div>
                <div>
                  <div className="dt-sb-name">demo_user</div>
                  <div className="dt-sb-plan">Free plan</div>
                </div>
              </div>
            </div>
          </aside>

          {/* Content */}
          <section className="dt-content">
            {/* Header row */}
            <div className="dt-content-head">
              <div>
                <div className="dt-breadcrumb">Workspace / Welcome</div>
                <h1 className="dt-h1">Read your last stream like a tape, not a dashboard.</h1>
                <p className="dt-sub">
                  LevlCast pulls your last Twitch VOD, watches the entire thing,
                  and hands you the moment your audience left and the clip you
                  should have posted instead. One report. No tabs to dig through.
                </p>
                <div className="dt-cta-row">
                  <Link href="/auth/login" className="dt-btn dt-btn-primary">Get your first report — free</Link>
                  <Link href="/auth/login" className="dt-btn">See a sample report</Link>
                </div>
              </div>
            </div>

            {/* Status cards */}
            <div className="dt-cards">
              <div className="dt-card">
                <div className="dt-card-label">Streams analyzed</div>
                <div className="dt-card-num">3,184</div>
                <div className="dt-card-delta">+47 this week</div>
              </div>
              <div className="dt-card">
                <div className="dt-card-label">Clips generated</div>
                <div className="dt-card-num">12,902</div>
                <div className="dt-card-delta">+219 this week</div>
              </div>
              <div className="dt-card">
                <div className="dt-card-label">Hours read</div>
                <div className="dt-card-num">9,441</div>
                <div className="dt-card-delta">avg 2.9h per stream</div>
              </div>
            </div>

            {/* The problem panel */}
            <div className="dt-panel">
              <div className="dt-panel-head">
                <span className="dt-panel-tag">01 · The problem</span>
                <h2 className="dt-panel-title">Twitch tells you what. Not when.</h2>
              </div>
              <div className="dt-panel-body">
                <p>
                  You stream four hours. The dashboard says average viewers, follows,
                  subs, total minutes. None of those tell you the moment your audience
                  walked. Or what was on screen when they did. Or whether the bit you
                  thought was your best moment actually landed.
                </p>
                <p>
                  Most streamers fill that gap with vibes. We watched a top-100 streamer
                  burn three weeks on the wrong fix because they thought their start
                  time was the problem. It wasn&apos;t. It was a fourteen-minute dead
                  patch in game two where they stopped narrating.
                </p>
              </div>
            </div>

            {/* How it works panel */}
            <div className="dt-panel">
              <div className="dt-panel-head">
                <span className="dt-panel-tag">02 · How it works</span>
                <h2 className="dt-panel-title">Three steps. Twelve minutes per VOD hour.</h2>
              </div>
              <div className="dt-panel-body">
                <div className="dt-flow">
                  <div className="dt-flow-step">
                    <div className="dt-flow-n">01</div>
                    <div className="dt-flow-t">Connect Twitch</div>
                    <div className="dt-flow-b">One click. Your last VOD shows up in the queue.</div>
                  </div>
                  <div className="dt-flow-arrow">→</div>
                  <div className="dt-flow-step">
                    <div className="dt-flow-n">02</div>
                    <div className="dt-flow-t">We watch the tape</div>
                    <div className="dt-flow-b">Transcribed, diarized, run through Claude Sonnet.</div>
                  </div>
                  <div className="dt-flow-arrow">→</div>
                  <div className="dt-flow-step">
                    <div className="dt-flow-n">03</div>
                    <div className="dt-flow-t">Score + clips</div>
                    <div className="dt-flow-b">A score, the one thing to fix, three clips ready to post.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Report panel */}
            <div className="dt-panel">
              <div className="dt-panel-head">
                <span className="dt-panel-tag">03 · The report</span>
                <h2 className="dt-panel-title">What you actually get.</h2>
              </div>
              <div className="dt-panel-body">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/la/ss-coach-report.png" alt="" className="dt-shot" />
                <div className="dt-shot-caption">Live screenshot. One screen. No fluff.</div>
              </div>
            </div>

            {/* Pricing panel */}
            <div className="dt-panel">
              <div className="dt-panel-head">
                <span className="dt-panel-tag">04 · Pricing</span>
                <h2 className="dt-panel-title">Two tiers.</h2>
              </div>
              <div className="dt-panel-body">
                <table className="dt-pricing-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Free</th>
                      <th>Pro · $9.99/mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>VOD analyses / month</td><td>1</td><td>15</td></tr>
                    <tr><td>Clips / month</td><td>5</td><td>20</td></tr>
                    <tr><td>Stream length</td><td>up to 6h</td><td>up to 10h</td></tr>
                    <tr><td>YouTube Shorts post</td><td>—</td><td>✓</td></tr>
                    <tr><td>Priority processing</td><td>—</td><td>✓</td></tr>
                  </tbody>
                </table>
                <div className="dt-cta-row" style={{ marginTop: 20 }}>
                  <Link href="/auth/login" className="dt-btn dt-btn-primary">Start free</Link>
                  <Link href="/auth/login" className="dt-btn">Get Pro</Link>
                </div>
              </div>
            </div>

            <div className="dt-end-note">
              Founding price. Goes up at 100 users. No marketing trick.
            </div>
          </section>
        </div>

        {/* Status bar */}
        <div className="dt-statusbar">
          <span><span className="dt-status-dot" /> Connected · api.levlcast.com</span>
          <span>1 stream queued · last sync 2m ago</span>
          <span>v1.0.2 · build 2401</span>
        </div>
      </div>
    </div>
  );
}

const css = `
.dt-page {
  background: #0e0e10;
  min-height: 100vh;
  padding: 24px;
  font-family: -apple-system, "SF Pro Text", ui-sans-serif, sans-serif;
  color: #e8e8eb;
}
.dt-page * { box-sizing: border-box; margin: 0; }

.dt-window {
  max-width: 1240px; margin: 0 auto;
  background: #15151a;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05);
}

/* Title bar */
.dt-titlebar {
  display: flex; align-items: center;
  background: linear-gradient(to bottom, #2a2a30, #1f1f24);
  padding: 10px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.4);
}
.dt-tl-dots { display: flex; gap: 8px; flex-shrink: 0; }
.dt-dot { width: 12px; height: 12px; border-radius: 50%; display: block; }
.dt-red { background: #ff5f57; }
.dt-yellow { background: #febc2e; }
.dt-green { background: #28c840; }
.dt-tl-title {
  flex: 1; text-align: center;
  font-size: 12px; color: rgba(255,255,255,0.6);
  letter-spacing: 0.02em;
}
.dt-tl-meta {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px; color: rgba(255,255,255,0.35);
  flex-shrink: 0;
}

/* Main layout */
.dt-main {
  display: grid; grid-template-columns: 220px 1fr;
  min-height: calc(100vh - 80px);
}

/* Sidebar */
.dt-sidebar {
  background: #101014;
  border-right: 1px solid rgba(255,255,255,0.06);
  padding: 20px 0;
  display: flex; flex-direction: column;
}
.dt-sb-section { padding: 0 14px 24px; }
.dt-sb-h {
  font-size: 10px; letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.35);
  padding: 0 6px 8px;
}
.dt-sb-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 10px;
  font-size: 13px;
  color: rgba(255,255,255,0.75);
  border-radius: 5px;
  cursor: default;
}
.dt-sb-active {
  background: rgba(255,255,255,0.06);
  color: #fff;
}
.dt-sb-badge {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px;
  background: rgba(255,255,255,0.08);
  padding: 1px 6px; border-radius: 4px;
  color: rgba(255,255,255,0.6);
}
.dt-sb-foot {
  margin-top: auto; padding: 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.dt-sb-user { display: flex; align-items: center; gap: 10px; }
.dt-sb-avatar {
  width: 30px; height: 30px; border-radius: 6px;
  background: linear-gradient(135deg, #6366f1, #ec4899);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 600; color: #fff;
}
.dt-sb-name { font-size: 13px; color: #fff; }
.dt-sb-plan { font-size: 11px; color: rgba(255,255,255,0.45); }

/* Content */
.dt-content {
  padding: 32px 40px 48px;
  background: #15151a;
  overflow-x: hidden;
}
.dt-breadcrumb {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 16px;
}
.dt-h1 {
  font-size: clamp(28px, 3.4vw, 42px);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 12px;
  color: #fff;
}
.dt-sub {
  font-size: 15px; line-height: 1.6;
  color: rgba(255,255,255,0.65);
  max-width: 640px;
  margin-bottom: 24px;
}
.dt-cta-row { display: flex; gap: 10px; flex-wrap: wrap; }
.dt-btn {
  display: inline-block;
  padding: 9px 16px;
  font-size: 13px; font-weight: 500;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  border-radius: 6px;
  text-decoration: none;
}
.dt-btn-primary {
  background: #fff; color: #0e0e10;
  border-color: #fff;
}

/* Cards */
.dt-cards {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 12px; margin: 32px 0 0;
}
.dt-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 18px;
}
.dt-card-label {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px; letter-spacing: 0.1em;
  color: rgba(255,255,255,0.5);
  text-transform: uppercase;
  margin-bottom: 10px;
}
.dt-card-num {
  font-size: 28px; font-weight: 600;
  letter-spacing: -0.015em;
  color: #fff;
}
.dt-card-delta {
  font-size: 12px; color: rgba(120,220,150,0.8);
  margin-top: 4px;
}

/* Panel */
.dt-panel {
  margin-top: 32px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  overflow: hidden;
}
.dt-panel-head {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: rgba(0,0,0,0.2);
}
.dt-panel-tag {
  display: inline-block;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin-bottom: 6px;
}
.dt-panel-title {
  font-size: 20px; font-weight: 600;
  letter-spacing: -0.015em;
  color: #fff;
}
.dt-panel-body { padding: 20px; }
.dt-panel-body p {
  font-size: 14px; line-height: 1.65;
  color: rgba(255,255,255,0.72);
  margin-bottom: 12px;
}
.dt-panel-body p:last-child { margin-bottom: 0; }

/* Flow */
.dt-flow {
  display: flex; align-items: stretch; gap: 12px;
}
.dt-flow-step {
  flex: 1;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 6px;
  padding: 14px 16px;
}
.dt-flow-n {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px; color: rgba(255,255,255,0.4);
  letter-spacing: 0.1em;
  margin-bottom: 6px;
}
.dt-flow-t {
  font-size: 14px; font-weight: 600;
  color: #fff; margin-bottom: 4px;
}
.dt-flow-b {
  font-size: 12px;
  color: rgba(255,255,255,0.55);
  line-height: 1.5;
}
.dt-flow-arrow {
  display: flex; align-items: center;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 18px;
  color: rgba(255,255,255,0.3);
}

/* Screenshot */
.dt-shot {
  display: block; width: 100%;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
}
.dt-shot-caption {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  margin-top: 8px;
  text-align: center;
}

/* Pricing table */
.dt-pricing-table {
  width: 100%; border-collapse: collapse;
  font-size: 13px;
}
.dt-pricing-table th, .dt-pricing-table td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.dt-pricing-table th {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  font-weight: 500;
}
.dt-pricing-table td {
  color: rgba(255,255,255,0.8);
}
.dt-pricing-table td:first-child {
  color: rgba(255,255,255,0.55);
}

.dt-end-note {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  text-align: center;
  margin-top: 24px;
  padding: 16px;
  border-top: 1px dashed rgba(255,255,255,0.1);
}

/* Status bar */
.dt-statusbar {
  display: flex; justify-content: space-between;
  background: #0c0c10;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 8px 14px;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  letter-spacing: 0.04em;
}
.dt-status-dot {
  display: inline-block;
  width: 6px; height: 6px; border-radius: 50%;
  background: #28c840;
  margin-right: 4px;
  box-shadow: 0 0 6px rgba(40,200,64,0.6);
}

@media (max-width: 800px) {
  .dt-main { grid-template-columns: 1fr; }
  .dt-sidebar { display: none; }
  .dt-cards { grid-template-columns: 1fr; }
  .dt-flow { flex-direction: column; }
  .dt-flow-arrow { transform: rotate(90deg); }
  .dt-statusbar { flex-direction: column; gap: 4px; align-items: flex-start; }
}
`;
