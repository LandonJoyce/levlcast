import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import LiveActivityFeed from "@/components/landing/LiveActivityFeed";
import LandingProPlan from "@/components/landing/LandingProPlan";
import LandingProPlusPlan from "@/components/landing/LandingProPlusPlan";
import CountUp from "@/components/landing/CountUp";
import UrlPasteHero from "@/components/landing/UrlPasteHero";
import ReferralBadge from "@/components/landing/ReferralBadge";

// Re-fetch the streams-analyzed counter and the recent-reports feed once
// per minute. Without this, Next.js caches the server-rendered HTML and
// the counter / feed stay frozen at whatever they were when the page was
// first built — which makes the live numbers feel dead.
export const revalidate = 60;

/**
 * The previous homepage, kept reachable at /v1 so the new one can be
 * reverted by swapping two files, and so its conversion can be compared
 * rather than argued about. Noindexed: it must never compete with the
 * real homepage in search results.
 */
export const metadata = {
  title: "LevlCast",
  robots: { index: false, follow: false },
};

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
  { q: "Do I need an account?", a: "Not to try it. Paste any public Twitch VOD link on this page and you'll get a real coaching report on the opening of that stream, no signup and no card. You only connect Twitch when you want the whole stream read instead of the opening, and every stream after it." },
  { q: "How does the analysis work?", a: "We pull the audio from the VOD, transcribe it, and read the full transcript to find your best moments and your weakest ones. About 5 minutes for a 2-hour stream. The free version on this page reads the opening 12 minutes and takes about a minute." },
  { q: "Do you store my VODs?", a: "No. We pull the audio from Twitch while we're analyzing it, then throw it away. The only things we keep are the report output and any clips you explicitly generate." },
  { q: "Is it actually free?", a: "The report on this page is free with no account at all. Connect Twitch and you get 2 full VOD analyses and 2 clips every week, forever, still with no credit card. Nothing in the report is held back for free users." },
  { q: "Does it work for my channel?", a: "Any public Twitch channel works: partner, affiliate, or 3 viewers. Paste a link to try it, or sign in with Twitch and hit Sync after a stream." },
  { q: "What about YouTube?", a: "Connect your channel once. After that you can post clips straight to Shorts from inside LevlCast. The title and description come from the report. Edit them if you want, or just tap post." },
];

/* ─── Page ─── */
export default async function LandingPage() {
  const streamCount = await getStreamCount();
  const counterTarget = streamCount > 0 ? streamCount : 50;

  return (
    <div className="ll-page">

      {/* ── Nav ── */}
      <header className="ll-nav-wrap">
        <div className="ll-con">
          <nav className="ll-nav">
            <Link href="/" className="ll-brand">LevlCast</Link>
            {/* Four destinations, four links. This previously carried a
                "Home" link while already on home, and pointed both "How it
                works" and "Features" at the same anchor — the kind of detail
                that makes a page read as unfinished. */}
            <ul className="ll-nav-links">
              <li><a href="#problem">Why</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#report">The Report</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
            <div className="ll-nav-actions">
              <a
                href="https://apps.apple.com/us/app/levlcast/id6761281566"
                target="_blank"
                rel="noopener noreferrer"
                className="ll-nav-ios"
                aria-label="Download LevlCast on the App Store"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span className="ll-nav-ios-label">iOS App</span>
              </a>
              <Link href="/auth/login" className="ll-btn ll-btn-white ll-nav-cta">
                Start Free
                <span className="ll-nav-arrow-icon">↗</span>
              </Link>
              <Link href="/auth/login" className="ll-btn ll-btn-grad ll-nav-cta-mobile" style={{ fontSize: 13, padding: "9px 16px" }}>
                Start Free
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ll-hero">
        <div className="ll-con">
          <div className="ll-hero-center" style={{ padding: 0, maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
            <ReferralBadge />
            {/* The headline states the offer rather than a mood. Since the
                free analyzer shipped, "no account" is the genuinely
                unusual thing about this product and it belongs above the
                fold, not buried in a pricing table. */}
            <h1 className="ll-h1">Paste a stream. <span className="ll-grad-text">Get coached.</span></h1>
            <p className="ll-lede" style={{ marginBottom: 22 }}>
              Drop a Twitch VOD link below and read a real coaching report on it. Dead air, weak openings, the moments worth clipping. No account, no card, nothing to install.
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <UrlPasteHero />
            </div>
          </div>

          {/* ── Live activity feed (tucked under the hero CTA) ── */}
          <LiveActivityFeed />
        </div>
      </section>

      {/* ── Live counter ── */}
      <div className="ll-live-counter">
        <span className="ll-live-num">
          <CountUp target={counterTarget} duration={1800} suffix="+" />
        </span>
        <span className="ll-live-label">streams analyzed and counting</span>
      </div>

      {/* ── Clip Editor showcase ── */}
      <section className="ll-sec" style={{ paddingBlock: "56px 24px" }}>
        <div className="ll-con">
          <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 32px" }}>
            <h2 className="ll-h2" style={{ marginBottom: 14 }}>
              Make every clip yours before you post.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.55, color: "var(--ll-fg-mute)", margin: 0 }}>
              Trim it tighter, fix any caption typos, pick the style, set the cover frame. Choose 16:9 or 9:16, then download or post to YouTube in one click.
            </p>
          </div>
          <div style={{
            position: "relative",
            borderRadius: 18,
            overflow: "hidden",
            border: "1px solid var(--ll-line-soft)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
            background: "var(--ll-bg-ink)",
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

      {/* ── How it works ──
          Replaces a Without/With comparison table. That pattern is pure
          assertion: it asked the reader to take both columns on faith and
          showed nothing. These three steps are checkable, and step one is
          something they can do on this page without an account. The
          numbering is real sequence, not decoration. */}
      <section className="ll-sec ll-sec-thread" id="problem">
        <div className="ll-con">
          {/* No boxes, no 01/02/03. A numbered three-card grid is the most
              recognisable AI-generated layout there is, and the numbers were
              decoration anyway since the copy already reads in order. The
              thread on the left carries the sequence instead, and each line
              is short enough to read without deciding to. */}
          <div className="ll-thread">
            <p className="ll-thread-line">
              Paste a link. <span className="ll-thread-soft">Yours, or someone you watch.</span>
            </p>
            <p className="ll-thread-line">
              Find out where you lost them. <span className="ll-thread-soft">With the timestamp.</span>
            </p>
            <p className="ll-thread-line">
              Connect Twitch when you want all of it. <span className="ll-thread-soft">Not before.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="ll-sec" style={{ paddingTop: 0 }}>
        <div className="ll-con">
          <div className="ll-shead" style={{ marginBottom: 48 }}>
            {/* One real quote and a note from the founder. Titling that
                "real words from real streamers" oversells a section with a
                single streamer in it, and overselling is what makes a page
                feel fake. */}
            <h2 className="ll-h2">Who this is for, and who built it</h2>
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

      {/* ── Features ── */}
      <section className="ll-sec" id="features">
        <div className="ll-con">
          <div className="ll-shead">
            <h2 className="ll-h2">Three things, built around the VOD workflow</h2>
          </div>
        </div>

        {/* Product screenshots — full-bleed wider than ll-con */}
        <div className="ll-ss-showcase">
          {/* Coach report — main value prop */}
          <div className="ll-ss-main">
            <h3 className="ll-ss-title">Coaching Report</h3>
            <div className="ll-ss-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/la/ss-coach-report.png" alt="LevlCast coaching report showing stream score, story, and #1 fix" />
            </div>
          </div>

          {/* Right col: recap + timeline stacked */}
          <div className="ll-ss-side">
            <div className="ll-ss-panel">
              <h3 className="ll-ss-title">Since Last Stream</h3>
              <div className="ll-ss-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/la/ss-stream-recap.png" alt="Since Last Stream: sub-score change grid" className="ll-ss-crop" />
              </div>
            </div>
            <div className="ll-ss-panel">
              <h3 className="ll-ss-title">Stream Timeline</h3>
              <div className="ll-ss-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/la/ss-timeline.png" alt="Stream timeline showing silence gaps and word-per-minute curve" className="ll-ss-crop" />
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── Pricing ── */}
      <section className="ll-sec" id="pricing">
        <div className="ll-con">
          <div className="ll-shead">
            <h2 className="ll-h2">Pick the plan that fits</h2>
          </div>
          <div className="ll-pricing ll-pricing-3">
            {/* Free trial */}
            <article className="ll-plan">
              <div>
                <div className="ll-plan-name">Free</div>
                <div className="ll-plan-cycle">No card required</div>
              </div>
              <div className="ll-plan-price">$0 <small>to start</small></div>
              <hr className="ll-plan-sep" />
              <ul className="ll-plan-feats">
                {["2 full VOD analyses every week", "2 clips every week", "The whole report, nothing held back", "Ranked ladder + leaderboard", "iOS app + web"].map((f) => (
                  <li key={f}>
                    <svg className="ll-plan-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ll-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/login" className="ll-btn ll-btn-grad ll-btn-arrow">
                Start Free
                <span className="ll-btn-arrow-circle">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </span>
              </Link>
            </article>

            {/* Pro */}
            <LandingProPlan />

            {/* Pro Plus */}
            <LandingProPlusPlan />
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
                Try it on any stream right now without an account. Connect Twitch when you want your whole library read, not just the opening. Free either way, no credit card.
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
              <a
                href="https://apps.apple.com/us/app/levlcast/id6761281566"
                target="_blank"
                rel="noopener noreferrer"
                className="ll-appstore-cta"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span>
                  <span className="ll-appstore-cta-pre">Get it on the </span>App Store
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </a>
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
                <li><a href="#features">How it works</a></li>
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
