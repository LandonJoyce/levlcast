import type { Metadata } from "next";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "How to Grow on Twitch in 2026 The Honest Guide",
  description:
    "The honest version of how to grow on Twitch in 2026. No gimmicks, no bots, no follow-for-follow. Just the tactics that actually move the needle and the ones that don't.",
  alternates: { canonical: "/how-to-grow-on-twitch" },
  openGraph: {
    type: "article",
    url: "https://www.levlcast.com/how-to-grow-on-twitch",
    title: "How to Grow on Twitch in 2026 The Honest Guide",
    description:
      "Five things that actually work for honest Twitch growth in 2026. Real tactics, not gimmicks.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Grow on Twitch in 2026",
    description:
      "The honest guide to Twitch growth real tactics, no gimmicks.",
    images: ["/opengraph-image"],
  },
};

const faqs = [
  {
    q: "How long does it realistically take to grow on Twitch?",
    a: "Affiliate status (50 followers, 3 average viewers) is achievable in 2–4 months of consistent streaming. Partner is a 1–3 year arc for most who make it. If you're trying to go full-time in under a year without an existing audience, the odds are against you and that's not a you problem, that's the math.",
  },
  {
    q: "Is it better to stream every day or on a schedule?",
    a: "A schedule you can sustain beats daily streams you burn out from. Three predictable days a week is better than seven chaotic ones. Viewers come back to what they can plan around.",
  },
  {
    q: "Should I buy viewers or followers to kickstart growth?",
    a: "No. Twitch actively detects viewbotting and will ban you. More importantly: fake viewers never buy subs, clip your content, or tell friends about you. You'll have a bigger number and the same empty chat. Every hour you spend on bots is an hour not spent on the real work.",
  },
  {
    q: "Does streaming on weekends vs weekdays matter?",
    a: "Less than you think. Consistency matters more than timing. The streamer who goes live every Tuesday 7pm for six months beats the one who guesses at 'optimal' slots and never shows up twice in a row.",
  },
  {
    q: "What's the fastest way to find out what's holding my stream back?",
    a: "Get feedback on your actual VOD not generic advice. Most streamers plateau because they can't see their own blind spots (dead air, weak openings, not responding to chat). An AI stream coach or an honest friend watching a VOD is faster than 50 more broadcasts.",
  },
];

const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Grow on Twitch in 2026 The Honest Guide",
  description:
    "The honest version of how to grow on Twitch in 2026. No gimmicks, no bots the tactics that actually move the needle, and the ones that don't.",
  datePublished: "2026-04-24",
  dateModified: "2026-04-24",
  author: {
    "@type": "Organization",
    name: "LevlCast",
    url: "https://www.levlcast.com",
  },
  publisher: {
    "@type": "Organization",
    name: "LevlCast",
    logo: {
      "@type": "ImageObject",
      url: "https://www.levlcast.com/logo-mark.png",
    },
  },
  mainEntityOfPage: "https://www.levlcast.com/how-to-grow-on-twitch",
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HowToGrowPage() {
  return (
    <main className="min-h-screen bg-bg text-white noise">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleStructuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="relative z-[1]">
        <NavBar />

        {/* ─── Hero ─── */}
        <section className="relative pt-32 md:pt-40 pb-16 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-[700px] h-[700px] bg-accent/[0.06] rounded-full blur-[120px] pointer-events-none" />
          <div className="relative max-w-[780px] mx-auto px-6">
            <div className="inline-flex items-center gap-2 bg-accent/[0.08] border border-accent/[0.2] text-accent-light/80 text-[11px] font-semibold px-4 py-1.5 rounded-full tracking-[0.08em] mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-light/70 animate-pulse" />
              Guide
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[-2px] leading-[1.05] mb-6">
              How to grow on Twitch<br />
              <span className="text-gradient">in 2026.</span>
            </h1>
            <p className="text-lg text-muted/90 leading-relaxed">
              The honest version. No gimmicks, no bots, no follow-for-follow. Five things that actually move the needle and the ones that don&apos;t, so you stop wasting cycles on them.
            </p>
          </div>
        </section>

        {/* ─── Article body ─── */}
        <article className="pb-20">
          <div className="max-w-[740px] mx-auto px-6">

            {/* Intro */}
            <section className="mb-14">
              <p className="text-base text-muted/90 leading-[1.8] mb-5">
                Most Twitch growth advice is either recycled from 2019 or written by people who&apos;ve never streamed. The reality in 2026: the algorithm doesn&apos;t save you, the raid train is mostly dead, and the streamers actually climbing are doing a handful of unglamorous things consistently.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                Here&apos;s what those things are in the order of what moves the needle most.
              </p>
            </section>

            {/* Section 1 */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">1. Fix the things you can&apos;t see</h2>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                You have blind spots on your own stream. Everyone does. You can&apos;t hear your own dead air because you were mentally engaged the whole time. You can&apos;t feel a weak opening because you&apos;ve already been live for two hours when it happens again on stream two. You miss chat because the game has your attention.
              </p>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                The streamers who grow are the ones who watch their VODs and fix what they find. The streamers who plateau are the ones who never watch back because &ldquo;that was a rough one.&rdquo; Especially then.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                If watching three-hour VODs back isn&apos;t realistic, use a <Link href="/twitch-vod-analyzer" className="text-accent-light hover:text-white underline">Twitch VOD analyzer</Link> or <Link href="/twitch-stream-coach" className="text-accent-light hover:text-white underline">AI stream coach</Link> to surface the specific moments that hurt you dead air with timestamps, weak openings, retention drops. Five minutes of focused review beats three hours of self-critique.
              </p>
            </section>

            {/* Section 2 */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">2. Clip what worked. Every stream.</h2>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                The single biggest unforced error streamers make: they have great moments and never turn them into content. The clip sits in a VOD that expires in two weeks. Nobody outside your current 3 viewers ever sees it.
              </p>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                YouTube Shorts and TikTok are where new Twitch viewers find streamers in 2026. Not the Twitch directory. Not Twitter. Short-form verticals. Which means every hype moment, clutch play, and funny reaction that goes unclipped is discovery traffic you chose to throw away.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                You don&apos;t need 50 clips per stream. You need 3–6 good ones, posted consistently, over months. That&apos;s how a small channel builds a pipeline from Shorts to live. A <Link href="/twitch-clip-generator" className="text-accent-light hover:text-white underline">Twitch clip generator</Link> removes the &ldquo;I&apos;ll do it later&rdquo; friction that kills this habit.
              </p>
            </section>

            {/* Section 3 */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">3. Stream on a schedule you can actually keep</h2>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                The advice is always &ldquo;stream more.&rdquo; The honest version is &ldquo;stream consistently.&rdquo; A viewer who knows you&apos;re live every Tuesday and Thursday at 7pm will organize their week around it. A viewer who has to check whether you&apos;re live today will stop checking.
              </p>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                Three predictable sessions a week beats seven chaotic ones. Especially because the seven-a-week schedule gets you burnt out in three months and then you disappear for two, and your small audience finds someone else.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                Burnout is growth&apos;s biggest enemy and it&apos;s invisible until you&apos;re already in it. Watch your energy curve across streams. If it&apos;s dropping session over session, you&apos;re not lazy you&apos;re overextending. Pull back before the break is forced on you.
              </p>
            </section>

            {/* Section 4 */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">4. Stop guessing. Use your own data.</h2>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                The streamer who can&apos;t tell you their best-performing content category is leaving growth on the table. You have data you just haven&apos;t looked at it. Which streams scored your highest moments? What category were they? What time of day? How long into the session?
              </p>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                The pattern is usually there. Your best content is probably concentrated in 2–3 categories, at a specific point in your stream, when your energy is at a certain level. Lean into it.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                This doesn&apos;t mean abandoning what you love streaming. It means noticing which things resonate and giving them more oxygen more airtime, more clips, more room to breathe in your scene.
              </p>
            </section>

            {/* Section 5 */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">5. Show up like you&apos;re already bigger</h2>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                This sounds vague but it&apos;s specific. The streamer at 10 average viewers who opens the stream like it&apos;s a real show clean intro, energy up, engaging the three people there reads like a 500-viewer channel having a slow day. They get treated that way. They grow faster.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                The streamer at 10 average viewers who waits for an audience before performing who does the &ldquo;empty chat today&rdquo; joke in the first minute, who doesn&apos;t bother with a proper opening because &ldquo;no one&apos;s watching yet&rdquo; stays at 10. Forever. The person who would have been your 11th viewer clicked away in the first 20 seconds.
              </p>
            </section>

            {/* What doesn't work */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">What doesn&apos;t work (so you stop trying)</h2>
              <ul className="space-y-4 text-base text-muted/90 leading-[1.8]">
                <li>
                  <strong className="text-white">Viewbots and follow-for-follow.</strong> Twitch detects them, bans you for them, and they don&apos;t produce real engagement anyway. Every hour spent on this is an hour stolen from the work that actually grows a channel.
                </li>
                <li>
                  <strong className="text-white">Chasing trending games.</strong> Unless you&apos;re genuinely good at it or genuinely interested, you&apos;re competing against 10,000 streamers for the same spillover audience. Better to be top 20 in a smaller category than bottom 1,000 in the biggest one.
                </li>
                <li>
                  <strong className="text-white">Raid swaps with streamers nobody watches.</strong> Raiding each other back and forth doesn&apos;t produce new followers. The raid audience has to actually like what they see when they land on your channel which loops back to sections 1–5.
                </li>
                <li>
                  <strong className="text-white">Asking for follows instead of earning them.</strong> &ldquo;Drop a follow if you&apos;re enjoying the stream&rdquo; is fine. Begging mid-clutch for a follow is a retention killer. People follow because they want to come back make them want to come back first.
                </li>
              </ul>
            </section>

            {/* The tool */}
            <section className="mb-14">
              <h2 className="text-3xl font-extrabold tracking-tight mb-4">The tool that does most of this for you</h2>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                The hard part about these five tactics is that doing them consistently requires a system. Watching VODs back. Clipping highlights. Tracking what resonated. Noticing burnout. Holding a schedule.
              </p>
              <p className="text-base text-muted/90 leading-[1.8] mb-4">
                LevlCast is built for exactly this. It&apos;s an AI Twitch stream manager it analyzes your VODs, generates clips from your best moments, scores every stream 0–100, tracks burnout, and tells you specifically what to fix before your next broadcast. The five things above, done for you, every session.
              </p>
              <p className="text-base text-muted/90 leading-[1.8]">
                It&apos;s free to start. One VOD analysis a month, five clips enough to try the system on your actual streams before committing.
              </p>
              <div className="mt-8">
                <Link
                  href="/auth/login"
                  className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-7 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5 active:scale-[0.97]"
                >
                  Analyze Your Last Stream Free
                  <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </Link>
              </div>
            </section>
          </div>
        </article>

        {/* ─── FAQ ─── */}
        <section className="py-24 border-t border-border" id="faq">
          <div className="max-w-[760px] mx-auto px-6">
            <h2 className="text-4xl font-extrabold tracking-tight mb-10 text-center">
              Twitch growth FAQ
            </h2>
            <div className="space-y-4">
              {faqs.map((f) => (
                <div key={f.q} className="card p-6">
                  <h3 className="font-bold text-base mb-2">{f.q}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Related ─── */}
        <section className="py-20 border-t border-border">
          <div className="max-w-[1080px] mx-auto px-6">
            <h2 className="text-2xl font-extrabold tracking-tight mb-8 text-center">
              Tools that support the five tactics
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/twitch-vod-analyzer" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">VOD Analyzer &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Find the dead air and weak openings you can&apos;t see. Five-minute review, real fixes.</p>
              </Link>
              <Link href="/twitch-clip-generator" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">Clip Generator &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Turn every stream into 3–6 posted Shorts. The discovery pipeline you&apos;re missing.</p>
              </Link>
              <Link href="/twitch-stream-coach" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">AI Stream Coach &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">One priority fix per stream. Score that tracks progress. The feedback loop you&apos;ve been missing.</p>
              </Link>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
