import Link from "next/link";

export const metadata = { title: "LevlCast · Chat", robots: { index: false, follow: false } };

type Msg =
  | { from: "user"; text: string; time: string }
  | { from: "bot"; text?: string; time: string; card?: "report" | "clip" | "pricing" };

const THREAD: Msg[] = [
  { from: "bot", time: "2:14 PM", text: "Hey. I'm LevlCast. I read Twitch VODs and tell you what to fix before your next stream. Want me to read your last one?" },
  { from: "user", time: "2:14 PM", text: "i guess. what do u actually do" },
  { from: "bot", time: "2:14 PM", text: "I pull your last VOD from Twitch (no uploads, no OBS files), watch the entire thing, and find the moment your audience left. Then I tell you why and hand you the clip you should have posted instead." },
  { from: "user", time: "2:15 PM", text: "twitch already gives me numbers tho" },
  { from: "bot", time: "2:15 PM", text: "Twitch tells you what. Average viewers, follows, subs, minutes. None of that has a timestamp on it. None of it tells you the part of your stream where you stopped narrating for 14 minutes." },
  { from: "bot", time: "2:15 PM", text: "I do." },
  { from: "user", time: "2:16 PM", text: "show me what the report looks like" },
  { from: "bot", time: "2:16 PM", card: "report" },
  { from: "user", time: "2:17 PM", text: "ok thats actually useful. how long does it take" },
  { from: "bot", time: "2:17 PM", text: "About 12 minutes per hour of VOD. You connect Twitch once, pick a stream, and the report drops in your inbox when it's done. You don't have to sit there." },
  { from: "user", time: "2:18 PM", text: "what about clips" },
  { from: "bot", time: "2:18 PM", text: "Three per stream. Already cut. Already captioned. Ready to post to YouTube Shorts in one click if you're on Pro." },
  { from: "bot", time: "2:18 PM", card: "clip" },
  { from: "user", time: "2:19 PM", text: "how much" },
  { from: "bot", time: "2:19 PM", card: "pricing" },
  { from: "user", time: "2:20 PM", text: "alright. how do i start" },
  { from: "bot", time: "2:20 PM", text: "Click below. Connect your Twitch. I'll have your first report ready before your next stream." },
];

export default function ChatMockup() {
  return (
    <div className="ch-page">
      <style>{css}</style>

      <div className="ch-app">
        {/* Sidebar */}
        <aside className="ch-sidebar">
          <div className="ch-side-head">
            <div className="ch-side-app">LevlCast</div>
            <div className="ch-side-search">⌕  Search</div>
          </div>

          <div className="ch-side-section">
            <div className="ch-side-label">Direct messages</div>
            <div className="ch-side-row ch-side-active">
              <div className="ch-side-avatar ch-bot-avatar">L</div>
              <div className="ch-side-row-body">
                <div className="ch-side-name">LevlCast</div>
                <div className="ch-side-preview">Click below. Connect your...</div>
              </div>
              <div className="ch-side-time">2:20p</div>
            </div>
            <div className="ch-side-row ch-dim">
              <div className="ch-side-avatar">C</div>
              <div className="ch-side-row-body">
                <div className="ch-side-name">Charmbix</div>
                <div className="ch-side-preview">that report was brutal lol</div>
              </div>
              <div className="ch-side-time">1d</div>
            </div>
            <div className="ch-side-row ch-dim">
              <div className="ch-side-avatar">S</div>
              <div className="ch-side-row-body">
                <div className="ch-side-name">st0rm81</div>
                <div className="ch-side-preview">renewed pro fyi</div>
              </div>
              <div className="ch-side-time">3d</div>
            </div>
          </div>
        </aside>

        {/* Thread */}
        <main className="ch-thread">
          <header className="ch-thread-head">
            <div className="ch-th-name-row">
              <div className="ch-th-avatar">L</div>
              <div>
                <div className="ch-th-name">
                  LevlCast
                  <span className="ch-online-dot" />
                </div>
                <div className="ch-th-status">Reads VODs · usually replies in 12 min</div>
              </div>
            </div>
            <div className="ch-th-actions">
              <span>⊕</span>
              <span>⌕</span>
              <span>⋯</span>
            </div>
          </header>

          <div className="ch-msgs">
            <div className="ch-day-divider"><span>Today</span></div>
            {THREAD.map((m, i) => (
              <Message key={i} m={m} />
            ))}
          </div>

          <div className="ch-input">
            <Link href="/auth/login" className="ch-cta">
              Connect Twitch and read my last stream →
            </Link>
            <div className="ch-input-note">Free · No credit card · 1 stream/month at no charge</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Message({ m }: { m: Msg }) {
  if (m.from === "user") {
    return (
      <div className="ch-msg ch-msg-user">
        <div className="ch-bubble ch-bubble-user">{m.text}</div>
        <div className="ch-time">{m.time}</div>
      </div>
    );
  }
  return (
    <div className="ch-msg ch-msg-bot">
      <div className="ch-bot-mini">L</div>
      <div className="ch-msg-body">
        {m.text && <div className="ch-bubble ch-bubble-bot">{m.text}</div>}
        {m.card === "report" && <ReportCard />}
        {m.card === "clip" && <ClipCard />}
        {m.card === "pricing" && <PricingCard />}
        <div className="ch-time">{m.time}</div>
      </div>
    </div>
  );
}

function ReportCard() {
  return (
    <div className="ch-card">
      <div className="ch-card-head">
        <div>
          <div className="ch-card-title">Stream report · Apr 25</div>
          <div className="ch-card-sub">3v3 vs ratuch · 5h 12m · Valorant</div>
        </div>
        <div className="ch-score ch-score-low">10<span>/100</span></div>
      </div>
      <div className="ch-card-body">
        <div className="ch-card-section">
          <div className="ch-card-label">Next session goal</div>
          <div className="ch-card-quote">
            The 5:12 breakdown proved you know what to say and can say it clearly.
            The only thing separating this from a watchable stream is saying that kind
            of thing at 0:00, 1:00, 2:00, and 3:00 instead of saving it for the last
            twenty seconds.
          </div>
        </div>
        <div className="ch-card-clips">
          <div className="ch-card-label">Clips ready to post</div>
          <ul>
            <li><span className="ch-clip-time">14:22</span> 1v3 clutch on Bind, instant chat reaction</li>
            <li><span className="ch-clip-time">2:31:08</span> Final round whiff that tilted the lobby</li>
            <li><span className="ch-clip-time">4:48:51</span> Ace on attack against FAM</li>
          </ul>
        </div>
      </div>
      <div className="ch-card-foot">
        <span className="ch-card-mono">levlcast.com / report / 4f2a8</span>
        <span className="ch-card-pill">Open full report →</span>
      </div>
    </div>
  );
}

function ClipCard() {
  return (
    <div className="ch-clip-card">
      <video autoPlay muted loop playsInline src="/demo/clipvideo.mp4" className="ch-clip-vid" />
      <div className="ch-clip-meta">
        <div className="ch-clip-title">1v3 clutch on Bind · 22s</div>
        <div className="ch-clip-sub">Captioned in Viral style · 9:16 ready</div>
      </div>
    </div>
  );
}

function PricingCard() {
  return (
    <div className="ch-card">
      <div className="ch-card-head">
        <div className="ch-card-title">Pricing</div>
      </div>
      <div className="ch-card-body">
        <div className="ch-pricing-row">
          <div className="ch-pricing-block">
            <div className="ch-pricing-tier">Free</div>
            <div className="ch-pricing-num">$0</div>
            <ul className="ch-pricing-list">
              <li>1 stream / month</li>
              <li>5 clips</li>
              <li>Up to 6h streams</li>
            </ul>
          </div>
          <div className="ch-pricing-block ch-pricing-pro">
            <div className="ch-pricing-tier">Pro</div>
            <div className="ch-pricing-num">$9.99<span>/mo</span></div>
            <ul className="ch-pricing-list">
              <li>15 streams / month</li>
              <li>20 clips</li>
              <li>Up to 10h streams</li>
              <li>YouTube Shorts post</li>
              <li>Priority processing</li>
            </ul>
          </div>
        </div>
      </div>
      <div className="ch-card-foot">
        <span className="ch-card-mono">Founding price · goes up at 100 users</span>
      </div>
    </div>
  );
}

const css = `
.ch-page {
  background: #1a1c20;
  min-height: 100vh;
  font-family: -apple-system, "Helvetica Neue", "Segoe UI", sans-serif;
  color: #e9e9eb;
  padding: 24px;
}
.ch-page * { box-sizing: border-box; margin: 0; }

.ch-app {
  max-width: 1200px; margin: 0 auto;
  height: calc(100vh - 48px);
  min-height: 720px;
  background: #25272c;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  display: grid;
  grid-template-columns: 280px 1fr;
}

/* Sidebar */
.ch-sidebar {
  background: #1c1e22;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex; flex-direction: column;
  overflow: hidden;
}
.ch-side-head { padding: 18px 16px 12px; }
.ch-side-app {
  font-size: 18px; font-weight: 700;
  letter-spacing: -0.01em; color: #fff;
  margin-bottom: 12px;
}
.ch-side-search {
  background: rgba(255,255,255,0.05);
  padding: 7px 10px; border-radius: 6px;
  font-size: 12px; color: rgba(255,255,255,0.45);
  letter-spacing: 0.02em;
}
.ch-side-section { padding: 12px 8px; flex: 1; }
.ch-side-label {
  font-size: 11px; letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.4);
  padding: 4px 10px 8px;
  font-weight: 600;
}
.ch-side-row {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  gap: 10px; align-items: center;
  padding: 8px 10px; border-radius: 6px;
  cursor: default;
}
.ch-side-active { background: rgba(255,255,255,0.06); }
.ch-side-row.ch-dim { opacity: 0.5; }
.ch-side-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700;
  background: linear-gradient(135deg, #4f46e5, #ec4899);
  color: #fff;
}
.ch-bot-avatar { background: linear-gradient(135deg, #ff4500, #ff8a3c); }
.ch-side-name {
  font-size: 14px; font-weight: 600; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ch-side-preview {
  font-size: 12px; color: rgba(255,255,255,0.5);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 1px;
}
.ch-side-time {
  font-size: 10px; color: rgba(255,255,255,0.35);
  align-self: flex-start;
  padding-top: 4px;
}

/* Thread */
.ch-thread {
  display: flex; flex-direction: column;
  background: #25272c;
  overflow: hidden;
}
.ch-thread-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.15);
}
.ch-th-name-row { display: flex; align-items: center; gap: 12px; }
.ch-th-avatar {
  width: 38px; height: 38px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #ff4500, #ff8a3c);
  color: #fff; font-weight: 700;
}
.ch-th-name {
  font-size: 15px; font-weight: 600; color: #fff;
  display: flex; align-items: center; gap: 8px;
}
.ch-online-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74,222,128,0.6);
}
.ch-th-status { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 1px; }
.ch-th-actions { display: flex; gap: 16px; color: rgba(255,255,255,0.5); font-size: 16px; }

/* Messages */
.ch-msgs {
  flex: 1; overflow-y: auto;
  padding: 20px 24px;
  display: flex; flex-direction: column; gap: 6px;
}
.ch-day-divider {
  text-align: center;
  margin: 8px 0 16px;
  position: relative;
}
.ch-day-divider::before {
  content: ""; position: absolute;
  left: 0; right: 0; top: 50%;
  height: 1px; background: rgba(255,255,255,0.06);
}
.ch-day-divider span {
  position: relative;
  background: #25272c;
  padding: 0 12px;
  font-size: 11px;
  color: rgba(255,255,255,0.45);
  letter-spacing: 0.04em;
}

.ch-msg { display: flex; max-width: 80%; }
.ch-msg-user { align-self: flex-end; flex-direction: column; align-items: flex-end; }
.ch-msg-bot { align-self: flex-start; gap: 10px; align-items: flex-start; }

.ch-bot-mini {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #ff4500, #ff8a3c);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 12px; font-weight: 700;
  flex-shrink: 0;
  margin-top: 4px;
}
.ch-msg-body { display: flex; flex-direction: column; gap: 4px; max-width: 100%; }

.ch-bubble {
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.45;
  letter-spacing: -0.005em;
  word-wrap: break-word;
}
.ch-bubble-user {
  background: #2563eb;
  color: #fff;
  border-bottom-right-radius: 4px;
}
.ch-bubble-bot {
  background: #34373d;
  color: #f0f0f3;
  border-bottom-left-radius: 4px;
}

.ch-time {
  font-size: 10px; color: rgba(255,255,255,0.35);
  margin: 0 8px;
}

/* Cards */
.ch-card {
  background: #1d1f23;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  overflow: hidden;
  max-width: 460px;
}
.ch-card-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ch-card-title { font-size: 14px; font-weight: 600; color: #fff; }
.ch-card-sub { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
.ch-score {
  font-size: 32px; font-weight: 700; line-height: 1;
  color: #ff5f57;
  font-feature-settings: "tnum";
}
.ch-score span { font-size: 12px; color: rgba(255,255,255,0.4); margin-left: 2px; }
.ch-card-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
.ch-card-section { }
.ch-card-label {
  font-size: 10px; letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
  margin-bottom: 6px;
}
.ch-card-quote {
  font-size: 13px; line-height: 1.55;
  color: rgba(255,255,255,0.85);
  padding: 10px 12px;
  border-left: 2px solid #ff4500;
  background: rgba(255,69,0,0.05);
  border-radius: 0 6px 6px 0;
}
.ch-card-clips ul { list-style: none; padding: 0; }
.ch-card-clips li {
  font-size: 13px;
  padding: 6px 0;
  border-top: 1px solid rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.78);
}
.ch-card-clips li:first-child { border-top: 0; }
.ch-clip-time {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 11px;
  background: rgba(255,255,255,0.06);
  padding: 1px 6px; border-radius: 3px;
  margin-right: 8px;
  color: rgba(255,255,255,0.7);
}
.ch-card-foot {
  padding: 10px 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; justify-content: space-between; align-items: center;
  background: rgba(0,0,0,0.15);
}
.ch-card-mono {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 10px; color: rgba(255,255,255,0.4);
}
.ch-card-pill {
  font-size: 11px; color: #4ade80; font-weight: 500;
}

/* Clip card */
.ch-clip-card {
  background: #1d1f23;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  overflow: hidden;
  max-width: 240px;
}
.ch-clip-vid {
  display: block; width: 100%;
  aspect-ratio: 9/16;
  object-fit: cover;
  background: #000;
}
.ch-clip-meta { padding: 10px 12px; }
.ch-clip-title { font-size: 13px; font-weight: 600; color: #fff; }
.ch-clip-sub { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }

/* Pricing */
.ch-pricing-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ch-pricing-block {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  padding: 14px;
}
.ch-pricing-pro {
  background: rgba(255,69,0,0.08);
  border-color: rgba(255,69,0,0.3);
}
.ch-pricing-tier {
  font-size: 10px; letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.5);
  margin-bottom: 8px;
}
.ch-pricing-num {
  font-size: 28px; font-weight: 700; color: #fff;
  letter-spacing: -0.02em;
  margin-bottom: 10px;
}
.ch-pricing-num span {
  font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,0.5);
  margin-left: 2px;
}
.ch-pricing-list { list-style: none; padding: 0; }
.ch-pricing-list li {
  font-size: 12px;
  color: rgba(255,255,255,0.75);
  padding: 4px 0;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.ch-pricing-list li:first-child { border-top: 0; }

/* Input */
.ch-input {
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.15);
}
.ch-cta {
  display: block;
  background: linear-gradient(135deg, #ff4500, #ff8a3c);
  color: #fff;
  text-decoration: none;
  text-align: center;
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 14px; font-weight: 600;
  letter-spacing: -0.005em;
  box-shadow: 0 4px 14px rgba(255,69,0,0.3);
}
.ch-input-note {
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.45);
  margin-top: 10px;
}

@media (max-width: 800px) {
  .ch-app { grid-template-columns: 1fr; height: auto; min-height: 100vh; border-radius: 0; }
  .ch-sidebar { display: none; }
  .ch-page { padding: 0; }
  .ch-msg { max-width: 90%; }
}
`;
