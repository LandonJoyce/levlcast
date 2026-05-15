import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import LiveActivityFeed from "@/components/landing/LiveActivityFeed";
import LandingProPlan from "@/components/landing/LandingProPlan";
import LaptopMockup from "@/components/landing/LaptopMockup";
import { SUPPORTED_GAMES } from "@/lib/analyze";

/* ─── Data ─── */
async function getStreamCount(): Promise<number> {
  try {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("vods")
      .select("*", { count: "exact", head: true })
      .eq("status", "ready");
    return count ?? 0;
  } catch {
    return 0;
  }
}

const faqItems = [
  { q: "How does the analysis work?", a: "You connect your Twitch account, sync your VODs, and hit Analyze. We pull the audio from your stream, transcribe it, and read the full transcript to find your best moments and weakest points. The whole thing takes about 5 minutes for a 2-hour stream." },
  { q: "Do you store my VODs?", a: "No. We pull the audio from Twitch while we're analyzing it, then throw it away. The only things we keep are the report output and any clips you explicitly generate." },
  { q: "Is it actually free?", a: "Yeah. The free trial gives you 3 full VOD analyses and 5 clips with no credit card. That's enough to see your scores trend, watch a few of your moments turn into clips, and decide if Pro is worth it." },
  { q: "Does it work for my channel?", a: "Any public Twitch channel works: partner, affiliate, or 3 viewers. Sign in with Twitch, hit Sync after a stream, and that's the whole setup." },
  { q: "What about YouTube?", a: "Connect your channel once. After that you can post clips straight to Shorts from inside LevlCast. The title and description come from the report. Edit them if you want, or just tap post." },
];

/* ─── Page ─── */
export default async function LandingPage() {
  const streamCount = await getStreamCount();
  const displayCount = streamCount > 0 ? `${streamCount}+` : "50+";

  return (
    <div className="ll-page">

      {/* ── Nav ── */}
      <header className="ll-nav-wrap">
        <div className="ll-con">
          <nav className="ll-nav">
            <Link href="/" className="ll-brand">LevlCast</Link>
            <ul className="ll-nav-links">
              <li><a href="/" className="ll-nav-active">Home</a></li>
              <li><a href="#how">How it works</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#report">The Report</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
            <div className="ll-nav-actions">
              <Link href="/auth/login" className="ll-btn ll-btn-white ll-nav-cta">
                Start Free Trial
                <span className="ll-nav-arrow-icon">↗</span>
              </Link>
              <Link href="/auth/login" className="ll-btn ll-btn-grad ll-nav-cta-mobile" style={{ fontSize: 13, padding: "9px 16px" }}>
                Start Free Trial
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Founding price banner ── */}
      <Link
        href="/auth/login"
        aria-label="Lock the $9.99 founding price before May 31"
        style={{
          display: "block",
          textDecoration: "none",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          background:
            "linear-gradient(90deg, rgba(255,88,0,0.10) 0%, rgba(242,97,121,0.08) 50%, rgba(255,88,0,0.10) 100%)",
        }}
      >
        <div className="ll-con">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              flexWrap: "wrap",
              padding: "10px 0",
              fontSize: 13,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            <span style={{ color: "rgba(255,255,255,0.85)" }}>
              Subscribe by <b style={{ color: "#fff", fontWeight: 600 }}>May 31</b> to lock in{" "}
              <b style={{ color: "#fff", fontWeight: 600 }}>$9.99/mo forever</b>. Price moves to{" "}
              <b style={{ color: "#fff", fontWeight: 600 }}>$15/mo</b> for everyone after.
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: "#fff",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Claim founding price
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      {/* ── Hero ── */}
      <section className="ll-hero">
        <div className="ll-con">
          <div className="ll-hero-center" style={{ padding: 0, maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
            <h1 className="ll-h1">Stop guessing what killed your <span className="ll-grad-text">stream</span></h1>
            <p className="ll-lede">
              LevlCast watches your VOD and tells you exactly what to fix. Score, timestamps, and clips ready to post.
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Link href="/auth/login" className="ll-btn ll-btn-grad" style={{ fontSize: 17, padding: "16px 28px" }}>
                Get Your First Report Free
              </Link>
              <Link href="/demo" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                textDecoration: "none", fontSize: 14,
              }}>
                <span style={{ fontFamily: "var(--ll-mono)", fontSize: 12, fontWeight: 700, color: "#A3E635" }}>74/100</span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.6)", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 1 }}>See a sample report</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              <a
                href="https://apps.apple.com/us/app/levlcast/id6761281566"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 4 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                Also free on the App Store
              </a>
            </div>
          </div>

          {/* ── Live activity feed (tucked under the hero CTA) ── */}
          <LiveActivityFeed />
        </div>
      </section>

      {/* ── Live counter ── */}
      <div className="ll-live-counter">
        <span className="ll-live-num">{displayCount}</span>
        <span className="ll-live-label">streams <span className="ll-grad-text">analyzed</span> and counting</span>
      </div>

      {/* ── Clip Editor showcase ── */}
      <section className="ll-sec" style={{ paddingBlock: "56px 24px" }}>
        <div className="ll-con">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 32px" }}>
            <h2 className="ll-h2" style={{ marginBottom: 14 }}>
              Make every clip <span className="ll-grad-text">yours</span> before you post.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "rgba(255,255,255,0.7)", margin: 0 }}>
              Trim it tighter, fix any caption typos, pick the style, set the cover frame. Choose 16:9 or 9:16, then download or post to YouTube in one click.
            </p>
          </div>
          <div style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
            background: "rgba(8,8,13,0.6)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/la/clip-editor.png"
              alt="LevlCast clip editor showing trim sliders, caption editing, style picker, hook frame, and format and destination options"
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        </div>
      </section>

      {/* ── VOD Video showcase ── */}
      <div className="ll-vod-showcase">
        <div className="ll-con">
          <p className="ll-vod-showcase-label">See it in <span className="ll-grad-text">action</span></p>
          <LaptopMockup src="/demo/LEVLCASTHEROAGAIN.mp4" />
        </div>
      </div>

      {/* ── Before / After ── */}
      <section className="ll-sec" id="problem">
        <div className="ll-con">
          <div className="ll-shead">
            <h2 className="ll-h2">Three streams from now, you&apos;ll have the <span className="ll-grad-text">same problems</span> you have today.</h2>
          </div>
          <div className="ll-compare">
            <article className="ll-card-ba">
              <span className="ll-ba-tag ll-ba-tag-bad">Without LevlCast</span>
              <h3 className="ll-ba-h">End every stream with nothing</h3>
              <ul className="ll-ba-list">
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-bad">×</span>You lost half your viewers somewhere in hour two. No idea where.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-bad">×</span>Your best clip of the month expired with the VOD.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-bad">×</span>You go live again tomorrow doing the exact same thing.</li>
              </ul>
            </article>
            <article className="ll-card-ba">
              <span className="ll-ba-tag ll-ba-tag-good">With LevlCast</span>
              <h3 className="ll-ba-h">End every stream knowing exactly what to fix</h3>
              <ul className="ll-ba-list">
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-good">✓</span>See the exact timestamp where viewers dropped off.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-good">✓</span>Your best moments clipped and ready to post before you sleep.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-good">✓</span>One specific thing to do differently next stream. Not a list. One thing.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="ll-sec" style={{ paddingTop: 0 }}>
        <div className="ll-con">
          <div className="ll-shead" style={{ marginBottom: 48 }}>
            <h2 className="ll-h2">Real words from <span className="ll-grad-text">real streamers</span></h2>
          </div>
          <div className="ll-trust">
            <div className="ll-trust-card ll-trust-card-featured">
              <p className="ll-trust-quote">"This software makes clipping an absolute breeze."</p>
              <div className="ll-trust-person">
                <div className="ll-trust-avatar" style={{ background: "rgba(145,70,255,0.25)", color: "#9146FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3zm14 0H6L4 8v9h3v3l3-3h3.5l4.5-4.5V5zM11 8v5h2V8h-2zm4 0v5h2V8h-2z"/></svg>
                </div>
                <div>
                  <div className="ll-trust-name">Charmbix</div>
                  <div className="ll-trust-role">Twitch streamer</div>
                </div>
              </div>
            </div>
            <div className="ll-trust-card">
              <p className="ll-trust-body">
                I built LevlCast to give newer streamers an actual path forward. Whether you're pushing for affiliate, chasing partner, or just trying to figure out what's not working, nobody should have to guess their way through it.
              </p>
              <div className="ll-trust-person">
                <div className="ll-trust-avatar" style={{ background: "rgba(145,70,255,0.25)", color: "#9146FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3zm14 0H6L4 8v9h3v3l3-3h3.5l4.5-4.5V5zM11 8v5h2V8h-2zm4 0v5h2V8h-2z"/></svg>
                </div>
                <div>
                  <div className="ll-trust-name">Landon</div>
                  <div className="ll-trust-role">Founder · twitch.tv/orbitxd</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Game Coverage ── */}
      <section className="ll-game-strip">
        <div className="ll-con">
          <div className="ll-game-strip-head">
            <h2 className="ll-game-strip-title">
              Your game <span className="ll-grad-text">woven</span> into every report.
            </h2>
          </div>
          <ul className="ll-game-strip-list">
            {SUPPORTED_GAMES.map((g) => (
              <li key={g} className="ll-game-strip-pill">{g}</li>
            ))}
            <li className="ll-game-strip-pill ll-game-strip-pill-more">More games every week</li>
          </ul>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="ll-sec" id="features">
        <div className="ll-con">
          <div className="ll-shead">
            <h2 className="ll-h2">Three things, built around the VOD <span className="ll-grad-text">workflow</span></h2>
          </div>
        </div>

        {/* Product screenshots — full-bleed wider than ll-con */}
        <div className="ll-ss-showcase">
          {/* Coach report — main value prop */}
          <div className="ll-ss-main">
            <div className="ll-ss-label-row">
              <span className="ll-chip"><span className="ll-chip-dot"></span>Coaching Report</span>
              <span className="ll-ss-desc">Score 0–100 · stream story · one specific fix</span>
            </div>
            <div className="ll-ss-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/la/ss-coach-report.png" alt="LevlCast coaching report showing stream score, story, and #1 fix" />
            </div>
          </div>

          {/* Right col: recap + timeline stacked */}
          <div className="ll-ss-side">
            <div className="ll-ss-panel">
              <div className="ll-ss-label-row">
                <span className="ll-chip"><span className="ll-chip-dot"></span>Since Last Stream</span>
                <span className="ll-ss-desc">stream-to-stream delta tracking</span>
              </div>
              <div className="ll-ss-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/la/ss-stream-recap.png" alt="Since Last Stream: sub-score delta grid" className="ll-ss-crop" />
              </div>
            </div>
            <div className="ll-ss-panel">
              <div className="ll-ss-label-row">
                <span className="ll-chip"><span className="ll-chip-dot"></span>Stream Timeline</span>
                <span className="ll-ss-desc">silence map + best moments</span>
              </div>
              <div className="ll-ss-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/la/ss-timeline.png" alt="Stream timeline showing silence gaps and word-per-minute curve" className="ll-ss-crop" />
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── The Loop — editorial walkthrough, no cards/icons ── */}
      <section
        className="ll-sec"
        id="how"
        style={{
          background: "rgb(4,4,8)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="ll-con">
          <div className="ll-shead">
            <h2 className="ll-h2">
              Stream. Sync. <span className="ll-grad-text">Learn.</span> Repeat.
            </h2>
          </div>

          <div style={{ maxWidth: 760, marginTop: 24 }}>
            {[
              {
                title: "You stream like you always do.",
                body: "Nothing changes on your end. No extra software, no overlay, no plugin. Just go live.",
              },
              {
                title: "After the stream, hit Sync.",
                body: "Your VOD shows up in LevlCast. One button to start the analysis. The full read takes about five minutes.",
              },
              {
                title: "Read what your stream actually did.",
                body: "Score 0–100 with the exact timestamps that mattered. What pulled viewers in, what made them tab away, the one fix that would've moved the needle.",
              },
              {
                title: "Take the fix into the next stream.",
                body: "One change at a time. Analyze that stream after. Watch the score move. That's the whole loop.",
              },
            ].map((s, i) => (
              <div
                key={s.title}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 22,
                  paddingBlock: "20px 22px",
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span style={{
                  fontFamily: "var(--ll-mono)",
                  fontSize: 13, fontWeight: 700,
                  color: "rgba(255,255,255,0.35)",
                  letterSpacing: "0.06em",
                  paddingTop: 4,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 style={{ fontSize: 19, fontWeight: 600, color: "#fff", margin: "0 0 6px", letterSpacing: "-0.01em" }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: "rgba(255,255,255,0.65)", margin: 0 }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="ll-sec" id="pricing">
        <div className="ll-con">
          <div className="ll-shead">
            <h2 className="ll-h2"><span className="ll-grad-text">Two plans.</span> No tricks</h2>
          </div>
          <div className="ll-pricing">
            {/* Free trial */}
            <article className="ll-plan">
              <div>
                <div className="ll-plan-name">Free Trial</div>
                <div className="ll-plan-cycle">No card required</div>
              </div>
              <div className="ll-plan-price">$0 <small>to start</small></div>
              <hr className="ll-plan-sep" />
              <ul className="ll-plan-feats">
                {["3 full VOD analyses", "5 clips on the house", "Streams up to 6 hours", "Full coaching report + score", "iOS app + web"].map((f) => (
                  <li key={f}>
                    <svg className="ll-plan-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ll-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="ll-btn ll-btn-grad ll-btn-arrow">
                Start Free Trial
                <span className="ll-btn-arrow-circle">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </Link>
            </article>

            {/* Pro */}
            <LandingProPlan />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="ll-sec" id="faq">
        <div className="ll-con">
          <div className="ll-shead" style={{ marginBottom: 40 }}>
            <h2 className="ll-h2">Common questions</h2>
          </div>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="ll-sec" id="report">
        <div className="ll-con">
          <div className="ll-cta-block">
            <div style={{ alignSelf: "center" }}>
              <h2 className="ll-cta-h">
                <span className="ll-cta-grad">Go live.</span><br />
                Own your stream.<br />
                <span className="ll-cta-grad">Levl up.</span>
              </h2>
              <p className="ll-cta-sub">
                Connect Twitch, hit Sync, and read your first report in under 10 minutes. Free. No credit card.
              </p>
              <div className="ll-badges">
                <a className="ll-badge" href="https://apps.apple.com/us/app/levlcast/id6761281566" target="_blank" rel="noopener noreferrer">
                  <svg width="18" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 12.7c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.3.9 1.2 1.9 2.6 3.3 2.6 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.2-2.5.7-.9 1.3-2.1 1.7-3.4-2.5-1-3.3-3.6-3.3-3.6Zm-2.6-7c.7-.9 1.2-2.1 1.1-3.3-1 .1-2.3.7-3 1.6-.7.7-1.3 2-1.1 3.2 1.1.1 2.3-.6 3-1.5Z"/></svg>
                  <div>
                    <div className="ll-badge-top">Download on the</div>
                    <div className="ll-badge-main">App Store</div>
                  </div>
                </a>
                <Link href="/auth/login" className="ll-btn ll-btn-grad" style={{ fontSize: 15, padding: "14px 24px" }}>
                  Get Your First Report Free
                </Link>
              </div>
            </div>

            {/* Phone mockups */}
            <div className="ll-phones" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/la/newphone.png" alt="" className="ll-phone-front" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="ll-footer">
        <div className="ll-con">
          <div className="ll-foot-socials">
            <a href="https://x.com/levlcast" target="_blank" rel="noopener noreferrer" className="ll-social">
              <div className="ll-social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </div>
              <span className="ll-social-label">X</span>
            </a>
            <span className="ll-social" style={{ opacity: 0.4, cursor: "default" }}>
              <div className="ll-social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </div>
              <span className="ll-social-label">Instagram <span style={{ fontSize: 10, opacity: 0.7 }}>soon</span></span>
            </span>
            <a href="https://tiktok.com/@levlcast" target="_blank" rel="noopener noreferrer" className="ll-social">
              <div className="ll-social-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg>
              </div>
              <span className="ll-social-label">TikTok</span>
            </a>
          </div>

          <div className="ll-foot-main">
            <div className="ll-foot-col">
              <Link href="/" className="ll-foot-brand">LevlCast</Link>
              <p className="ll-foot-pitch">Your personal stream coach. Real feedback on your actual stream.</p>
            </div>
            <div className="ll-foot-col">
              <h4>Product</h4>
              <ul>
                <li><Link href="/twitch-vod-analyzer">VOD Analyzer</Link></li>
                <li><Link href="/twitch-clip-generator">Clip Generator</Link></li>
                <li><Link href="/twitch-stream-coach">Stream Coach</Link></li>
                <li><Link href="/changelog">Changelog</Link></li>
              </ul>
            </div>
            <div className="ll-foot-col">
              <h4>More</h4>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#features">Features</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><Link href="/terms">Terms</Link></li>
                <li><Link href="/privacy">Privacy</Link></li>
              </ul>
            </div>
          </div>

          <div className="ll-foot-bottom">
            © 2026 LevlCast. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
