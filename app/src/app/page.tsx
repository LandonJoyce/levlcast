import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import ChatBarsViz from "@/components/landing/ChatBarsViz";
import HeatmapViz from "@/components/landing/HeatmapViz";
import SubscribeForm from "@/components/landing/SubscribeForm";
import StreamerMarquee from "@/components/landing/StreamerMarquee";

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
  { q: "How does the analysis work?", a: "You connect your Twitch account, sync your VODs, and hit Analyze. We pull the audio from your stream, run it through our transcription pipeline, and Claude reads the full transcript to find your best moments and weakest points. The whole thing takes about 5 minutes for a 2-hour stream." },
  { q: "Do you store my VODs?", a: "No. We pull the audio from Twitch while we're analyzing it, then throw it away. The only things we keep are the report output and any clips you explicitly generate." },
  { q: "Is it actually free?", a: "Yeah. One full VOD analysis and 5 clips per month, permanently. No trial period, no credit card, no expiry. If you want more than that, that's what Pro is for." },
  { q: "Does it work for my channel?", a: "Any public Twitch channel works — partner, affiliate, or 3 viewers. Sign in with Twitch, hit Sync after a stream, and that's the whole setup." },
  { q: "What about YouTube?", a: "Connect your channel once. After that you can post clips straight to Shorts from inside LevlCast — the title and description come from the report. Edit them if you want, or just tap post." },
];

/* ─── Page ─── */
export default async function LandingPage() {
  const streamCount = await getStreamCount();
  const displayCount = streamCount > 0 ? `${streamCount}+` : "50+";

  return (
    <div className="ll-page">
      {/* Fonts */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ── Nav ── */}
      <header className="ll-nav-wrap">
        <div className="ll-con">
          <nav className="ll-nav">
            <Link href="/" className="ll-brand">LevlCast</Link>
            <ul className="ll-nav-links">
              <li><a href="#how">How it works</a></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
            <Link href="/auth/login" className="ll-btn ll-btn-white ll-nav-cta">
              Get Started Free
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="ll-hero">
        <div className="ll-con">
          <span className="ll-eyebrow">$9.99/mo locked for life</span>
          <h1 className="ll-h1">Stop guessing what killed your stream</h1>
          <p className="ll-lede">
            LevlCast reads your VOD after every stream and tells you the exact moments
            that lost viewers. Dead air, slow openings, the parts your chat went quiet.
            Not generic advice. Timestamps.
          </p>
          <Link href="/auth/login" className="ll-btn ll-btn-grad" style={{ fontSize: 17, padding: "16px 28px" }}>
            Get Your First Report Free
          </Link>

          {/* Feature strip */}
          <div className="ll-strip">
            {[
              { title: "Real coaching", sub: "Built on your actual stream" },
              { title: "Track key metrics", sub: "Get actionable feedback" },
              { title: "Share key moments", sub: "Export to social media" },
              { title: "Improve content", sub: "Optimize stream quality" },
            ].map((item) => (
              <div key={item.title} className="ll-strip-item">
                <div>
                  <div className="ll-strip-title">{item.title}</div>
                  <div className="ll-strip-sub">{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Streamer Marquee ── */}
      <div className="ll-page-marquee">
        <StreamerMarquee />
      </div>

      {/* ── Before / After ── */}
      <section className="ll-sec" id="problem">
        <div className="ll-con">
          <div className="ll-shead">
            <span className="ll-eyebrow">Before / After</span>
            <h2 className="ll-h2">Most streamers are flying completely blind</h2>
            <p className="ll-sub">You end stream, check the same viewer count, and have no idea what to change. So you do the same thing next stream and wonder why nothing grows.</p>
          </div>
          <div className="ll-compare">
            <article className="ll-card-ba">
              <span className="ll-ba-tag ll-ba-tag-bad">Without LevlCast</span>
              <h3 className="ll-ba-h">Guesswork after every stream</h3>
              <ul className="ll-ba-list">
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-bad">×</span>18 minutes of dead air at 1:40. You didn't notice.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-bad">×</span>VODs expire in 14 days. Best moments lost forever.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-bad">×</span>Generic advice: "be more engaging." What does that even mean?</li>
              </ul>
            </article>
            <article className="ll-card-ba">
              <span className="ll-ba-tag ll-ba-tag-good">With LevlCast</span>
              <h3 className="ll-ba-h">One specific fix, every stream</h3>
              <ul className="ll-ba-list">
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-good">✓</span>Chat pulse mapped to your transcript, second by second.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-good">✓</span>Auto-clips of your hype, comedy, and clutch moments.</li>
                <li className="ll-ba-item"><span className="ll-bullet ll-bullet-good">✓</span>Three missions to carry into your next session. That's it.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="ll-sec" id="features">
        <div className="ll-con">
          <div className="ll-shead">
            <span className="ll-eyebrow">$9.99/mo locked for life</span>
            <h2 className="ll-h2">Three things, built around the VOD workflow</h2>
            <p className="ll-sub">Nothing else. No bloat, no dashboard you'll never open.</p>
          </div>

          <div className="ll-features">
            {/* Chat Pulse */}
            <article className="ll-feat">
              <span className="ll-chip"><span className="ll-chip-dot"></span>Chat Pulse</span>
              <h3 className="ll-feat-h">Your chat is telling you what worked</h3>
              <p className="ll-feat-sub">We link chat volume to every moment. The spike at 1:55 confirms your best clip. The drop at 2:20 tells you what to fix.</p>
              <div className="ll-viz">
                <div className="ll-viz-row">
                  <div>
                    <div className="ll-viz-label">Messages / minute</div>
                    <div className="ll-viz-num">96 <span className="ll-viz-sub">peak at 1:55</span></div>
                  </div>
                  <div>
                    <div className="ll-viz-label">Chat score</div>
                    <div className="ll-viz-num">8.4 <span className="ll-viz-sub">/ 10</span></div>
                  </div>
                </div>
                <ChatBarsViz />
              </div>
              <div className="ll-glow ll-glow-cyan"></div>
            </article>

            {/* Auto Clips */}
            <article className="ll-feat">
              <span className="ll-chip"><span className="ll-chip-dot"></span>Auto Clips</span>
              <h3 className="ll-feat-h">Hype, comedy, clutch — auto-cut.</h3>
              <p className="ll-feat-sub">One tap cuts and captions. No timeline scrubbing. No editing software.</p>
              <div className="ll-clips">
                {[
                  { title: "Clutch — Malenia P2", meta: "peak chat · 1:55:14", time: "0:42" },
                  { title: "Comedy — chat reaction", meta: "laugh detector · 2:18:03", time: "0:31" },
                  { title: "Hype — first kill", meta: "spike +280% · 0:48:51", time: "0:55" },
                ].map((c) => (
                  <div key={c.title} className="ll-clip">
                    <div className="ll-clip-thumb">▶</div>
                    <div>
                      <div className="ll-clip-title">{c.title}</div>
                      <div className="ll-clip-meta">{c.meta}</div>
                    </div>
                    <div className="ll-clip-time">{c.time}</div>
                  </div>
                ))}
              </div>
              <div className="ll-glow ll-glow-coral"></div>
            </article>

            {/* Drop-off Detection */}
            <article className="ll-feat">
              <span className="ll-chip"><span className="ll-chip-dot ll-chip-dot-red"></span>Drop-off Detection</span>
              <h3 className="ll-feat-h">Know why viewers leave</h3>
              <p className="ll-feat-sub">Exact moments viewers tuned out — dead air, slow openings, quiet chat. One specific fix per session.</p>
              <div className="ll-viz">
                <div className="ll-viz-row">
                  <div>
                    <div className="ll-viz-label">Retention by minute</div>
                    <div className="ll-viz-num" style={{ color: "var(--ll-red)" }}>-34% <span className="ll-viz-sub">at 1:40</span></div>
                  </div>
                  <div>
                    <div className="ll-viz-label">Mission</div>
                    <div style={{ fontSize: 13, color: "var(--ll-fg-mute)" }}>Cut intro to &lt; 90s</div>
                  </div>
                </div>
                <HeatmapViz />
              </div>
              <div className="ll-glow ll-glow-purple"></div>
            </article>

            {/* Post to YouTube — spans 2 */}
            <article className="ll-feat ll-feat-span2 ll-feat-yt">
              <span className="ll-chip"><span className="ll-chip-dot ll-chip-dot-cyan"></span>Post to YouTube</span>
              <h3 className="ll-feat-h">From clip to Shorts, in 30 seconds</h3>
              <p className="ll-feat-sub">Connect your channel once. Post from inside the app. Title fills itself from the report.</p>
              <div className="ll-yt-grid">
                {[
                  { title: "Malenia clear, no-hit run", meta: "DRAFT · 0:42 · #shorts" },
                  { title: "When chat saw the boss", meta: "QUEUED · 0:31 · #shorts" },
                  { title: "First kill of the night", meta: "POSTED · 0:55 · 2.4k views" },
                ].map((v) => (
                  <div key={v.title} className="ll-yt">
                    <div className="ll-yt-thumb">▶</div>
                    <div className="ll-yt-title">{v.title}</div>
                    <div className="ll-yt-meta">{v.meta}</div>
                  </div>
                ))}
              </div>
              <div className="ll-glow ll-glow-peach"></div>
            </article>
          </div>
        </div>
      </section>

      {/* ── The Loop ── */}
      <section className="ll-sec" id="how">
        <div className="ll-con">
          <div className="ll-shead">
            <span className="ll-eyebrow">The Loop</span>
            <h2 className="ll-h2">Four steps. No new habits</h2>
            <p className="ll-sub">Stream the same way you always have. The analysis happens after you end stream.</p>
          </div>
          <div className="ll-steps">
            {[
              { n: "01", title: "Stream normally", body: "Nothing changes about how you go live. No setup, no overlay, no extra software." },
              { n: "02", title: "Hit Sync after", body: "Open LevlCast, hit Sync. Your VOD shows up. One button to start the analysis." },
              { n: "03", title: "Read your report", body: "0-100 score with exact timestamps. What worked, what didn't, the one fix to make next." },
              { n: "04", title: "Go live again", body: "Take the one thing into your next stream. Analyze it after. That's the whole loop." },
            ].map((s) => (
              <article key={s.n} className="ll-step">
                <span className="ll-step-num">{s.n}</span>
                <h3 className="ll-step-h">{s.title}</h3>
                <p className="ll-step-body">{s.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="ll-sec" id="pricing">
        <div className="ll-con">
          <div className="ll-shead">
            <span className="ll-eyebrow">Pricing</span>
            <h2 className="ll-h2">Two plans. No tricks</h2>
            <p className="ll-sub">Start free. Every feature is real, no paywalled demo mode.</p>
          </div>
          <div className="ll-pricing">
            <article className="ll-plan">
              <div>
                <div className="ll-plan-name">For You</div>
                <div className="ll-plan-cycle">Free</div>
              </div>
              <div className="ll-plan-price">$0 <small>forever</small></div>
              <ul className="ll-plan-feats">
                {["1 full VOD analysis / month", "Full coaching report + score", "5 clips per month", "iOS app + web"].map((f) => (
                  <li key={f}><span className="ll-check">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/auth/login" className="ll-btn ll-btn-grad">Get Started Free</Link>
            </article>

            <article className="ll-plan ll-plan-pro">
              <span className="ll-plan-badge">Founding · locks for life</span>
              <div>
                <div className="ll-plan-name">Pro</div>
                <div className="ll-plan-cycle">month · founding price</div>
              </div>
              <div className="ll-plan-price">$9.99 <small>/ month</small></div>
              <ul className="ll-plan-feats">
                {["20 VOD analyses / month", "20 clips per month", "Post to YouTube Shorts", "Priority processing", "Everything in Free"].map((f) => (
                  <li key={f}><span className="ll-check">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/auth/login" className="ll-btn ll-btn-grad">Get Pro</Link>
            </article>
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

      {/* ── Testimonials + Founder ── */}
      <section className="ll-sec" style={{ paddingTop: 0 }}>
        <div className="ll-con">
          <div className="ll-trust">
            <div className="ll-trust-card">
              <p className="ll-trust-quote">"This software makes clipping an absolute breeze."</p>
              <div className="ll-trust-person">
                <div className="ll-trust-avatar" style={{ background: "rgba(145,70,255,0.2)", border: "1px solid rgba(145,70,255,0.3)", color: "#9146FF" }}>C</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Charmbix</div>
                  <div style={{ fontSize: 11, color: "var(--ll-fg-dim)" }}>Twitch streamer</div>
                </div>
              </div>
            </div>
            <div className="ll-trust-card">
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ll-fg-mute)", margin: 0 }}>
                I built LevlCast to give newer streamers an actual path forward. Whether you're pushing for affiliate, chasing partner, or just trying to figure out what's not working, nobody should have to guess their way through it.
              </p>
              <div className="ll-trust-person">
                <div className="ll-trust-avatar" style={{ background: "rgba(37,244,244,0.12)", border: "1px solid rgba(37,244,244,0.25)", color: "var(--ll-cyan)" }}>L</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Landon</div>
                  <div style={{ fontSize: 11, color: "var(--ll-fg-dim)" }}>Founder · twitch.tv/orbitxd</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="ll-sec" id="report">
        <div className="ll-con">
          <div className="ll-cta-block">
            <div>
              <h2 className="ll-cta-h">
                <span className="ll-cta-grad">Go live.</span><br />
                Own your stream.<br />
                <span className="ll-cta-grad">Level up.</span>
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
              <p style={{ marginTop: 16, fontSize: 12, color: "var(--ll-fg-dim)" }}>
                {displayCount} streams analyzed and counting
              </p>
            </div>

            {/* Phone mockups */}
            <div className="ll-phones" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/la/phone.png" alt="" className="ll-phone-img-front" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/la/phone.png" alt="" className="ll-phone-img-back" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="ll-footer">
        <div className="ll-con">
          <div className="ll-foot-socials">
            <a href="https://x.com/levlcast" target="_blank" rel="noopener noreferrer" className="ll-social">
              <div className="ll-social-icon">𝕏</div>
              <span className="ll-social-label">X</span>
            </a>
            <a href="https://instagram.com/levlcast" target="_blank" rel="noopener noreferrer" className="ll-social">
              <div className="ll-social-icon">📷</div>
              <span className="ll-social-label">Instagram</span>
            </a>
            <a href="https://tiktok.com/@levlcast" target="_blank" rel="noopener noreferrer" className="ll-social">
              <div className="ll-social-icon">♪</div>
              <span className="ll-social-label">TikTok</span>
            </a>
          </div>

          <div className="ll-foot-main">
            <div className="ll-foot-col">
              <Link href="/" className="ll-foot-brand">LevlCast</Link>
              <p className="ll-foot-pitch">Your personal stream coach. Real feedback on your actual stream.</p>
              <SubscribeForm />
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
