import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "AI Twitch Stream Coach — Personal Feedback After Every Stream",
  description:
    "Stop getting generic advice. LevlCast is an AI Twitch stream coach that reviews your actual VODs and gives you one specific priority to fix before your next stream.",
  alternates: { canonical: "/twitch-stream-coach" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/twitch-stream-coach",
    title: "AI Twitch Stream Coach — Real Feedback, Real Growth",
    description:
      "Your AI stream coach reviews every VOD and gives you a scored report with specific fixes. Not 'be more engaging' — actual notes on what happened.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Twitch Stream Coach",
    description:
      "Your AI coach reviews every VOD and gives you specific fixes for the next stream.",
    images: ["/opengraph-image"],
  },
};

const reportFields = [
  { title: "Overall score (0–100)", desc: "A single number that reflects how the stream actually went — not vanity metrics, not viewer count. You can track it stream over stream." },
  { title: "Streamer type", desc: "Your dominant archetype — entertainer, educator, strategist, community host. Coaching adapts to who you actually are." },
  { title: "Energy trend", desc: "How your energy moved across the stream. Slow start? Late slump? The shape of your session, visualized." },
  { title: "One priority fix", desc: "Not a list of twelve things. One specific thing to focus on before your next broadcast." },
  { title: "Strengths & improvements", desc: "What worked well and should keep doing. What cost you retention and how to avoid it next time." },
  { title: "Best moment + next-stream goals", desc: "The moment most worth clipping + concrete goals to carry into your next session." },
];

const whyDifferent = [
  "Feedback on your actual VOD, not generic advice",
  "Audio-aware — it knows what you said, not just what chat typed",
  "One priority to fix, not twelve suggestions you'll ignore",
  "Score tracks stream over stream so progress is visible",
  "Adapts to your streamer archetype — no one-size-fits-all tips",
];

const comparisonRows = [
  { label: "What it reviews", generic: "General streaming theory", coach: "Your actual last stream" },
  { label: "Specificity", generic: "\"Be more engaging\"", coach: "\"You went silent at 34:12 for 47 seconds\"" },
  { label: "Output format", generic: "Long blog posts", coach: "Scored report + one priority" },
  { label: "Cost", generic: "$60–$150/hr for a real coach", coach: "Free to start, $9.99/mo Pro" },
  { label: "Available", generic: "Booked two weeks out", coach: "Every stream, automatically" },
];

const faqs = [
  {
    q: "What makes this different from a human Twitch coach?",
    a: "A good human coach is invaluable but costs $60–$150/hour and can't review every stream you do. LevlCast reviews every stream, stays consistent, and scores you against your own past broadcasts. Most streamers will still benefit from a human coach occasionally — this fills the 95% of time you can't afford one.",
  },
  {
    q: "How does the AI coach know what to tell me?",
    a: "The coach reads a full transcription of your VOD (filtered to your voice, not game audio), identifies silence gaps and energy shifts, maps your dominant streamer archetype, and generates personalized feedback using Claude Sonnet. Everything tied to specific timestamps.",
  },
  {
    q: "Is the coaching report actually specific, or just boilerplate?",
    a: "Specific. The coach quotes exact timestamps, references what you actually said, and gives feedback tied to your archetype — an entertainer gets different notes than an educator. No 'be more engaging' generics.",
  },
  {
    q: "How often should I get a coaching report?",
    a: "Every stream you care about improving. Free plan gives you one per month to try it out. Pro gives you 20/month — enough to cover almost every broadcast.",
  },
  {
    q: "Does the coach give advice on growth tactics too?",
    a: "The coach focuses on your stream quality — that's where the durable growth comes from. For growth tactics specifically (archetypes, content mix, consistency), check the Grow dashboard after your first analysis.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LevlCast AI Twitch Stream Coach",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web, iOS",
  description:
    "AI Twitch stream coach that reviews your VODs and gives personalized coaching reports with specific fixes and scored progress tracking.",
  url: "https://www.levlcast.com/twitch-stream-coach",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
    { "@type": "Offer", name: "Pro", price: "9.99", priceCurrency: "USD" },
  ],
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

export default function StreamCoachPage() {
  return (
    <main className="min-h-screen bg-bg text-white noise">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="relative z-[1]">
        <NavBar />

        {/* ─── Hero ─── */}
        <section className="relative pt-32 md:pt-40 pb-20 md:pb-28 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-accent/[0.06] rounded-full blur-[120px] pointer-events-none" />
          <div className="relative max-w-[1080px] mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-center">
              <div className="md:col-span-6 lg:col-span-6">
                <div className="inline-flex items-center gap-2 bg-accent/[0.08] border border-accent/[0.2] text-accent-light/80 text-[11px] font-semibold px-4 py-1.5 rounded-full tracking-[0.08em] mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-light/70 animate-pulse" />
                  AI Stream Coach
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[-2px] leading-[1.05] mb-6">
                  The coach<br />
                  <span className="text-gradient">you couldn&apos;t afford.</span>
                </h1>
                <p className="text-base text-muted max-w-[520px] mb-8 leading-relaxed">
                  Real coaches charge $60–$150 an hour. LevlCast is an AI Twitch stream coach that reviews every broadcast you do — scored 0–100, tied to specific timestamps, with one priority to fix. Not generic tips. Actual notes on your stream.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                  <Link
                    href="/auth/login"
                    className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-7 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5 active:scale-[0.97]"
                  >
                    Get Your First Report Free
                    <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </Link>
                </div>
                <p className="text-xs text-muted">Free to start. No credit card required.</p>
              </div>
              <div className="md:col-span-6 lg:col-span-6 md:translate-y-4">
                <div className="rounded-2xl overflow-hidden border border-border shadow-glow-lg">
                  <img
                    src="/screenshots/coach-report.jpg"
                    alt="AI Twitch stream coach report with score, archetype, and priority fix"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── What's in a coaching report ─── */}
        <section className="py-24 border-t border-border">
          <div className="max-w-[1080px] mx-auto px-6">
            <div className="mb-5">
              <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Every coaching report includes</span>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4 md:text-left">
              Six things your coach notices<br />that you can&apos;t.
            </h2>
            <p className="text-muted text-sm max-w-[520px] mb-14 leading-relaxed md:text-left">
              You&apos;re too close to your own stream. These are the observations a good manager would make — surfaced automatically after every broadcast.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportFields.map((f, i) => (
                <div key={f.title} className="card p-7 hover:border-accent/25 transition-colors">
                  <span className="text-xs font-bold text-muted/60 mb-3 block">0{i + 1}</span>
                  <h3 className="font-bold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Why different ─── */}
        <section className="py-24 border-t border-border bg-surface/30">
          <div className="max-w-[1080px] mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-center">
              <div className="md:col-span-6">
                <div className="mb-5">
                  <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">What makes this coach work</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
                  &ldquo;Be more engaging&rdquo; isn&apos;t coaching.
                </h2>
                <p className="text-muted text-sm mb-6 leading-relaxed">
                  Generic advice is what you get from articles and streaming Discord servers. Real coaching references your specific stream, cites timestamps, and gives you one concrete thing to change next time — which is how actual behavior changes.
                </p>
                <ul className="space-y-3">
                  {whyDifferent.map((d) => (
                    <li key={d} className="flex items-start gap-2.5 text-sm text-white/80">
                      <Check className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-6">
                <div className="rounded-2xl overflow-hidden border border-border shadow-glow-lg">
                  <img
                    src="/screenshots/coach-feedback.png"
                    alt="Specific coaching feedback with timestamps and priority fix"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Comparison table ─── */}
        <section className="py-24 border-t border-border">
          <div className="max-w-[980px] mx-auto px-6">
            <div className="mb-5">
              <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Generic advice vs a real AI coach</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-12 md:text-left">
              What &ldquo;coaching&rdquo; actually means.
            </h2>
            <div className="card overflow-hidden">
              <div className="grid grid-cols-3 text-xs font-bold uppercase tracking-wider border-b border-border">
                <div className="p-5 text-muted">&nbsp;</div>
                <div className="p-5 text-muted/70">Generic advice</div>
                <div className="p-5 text-accent-light">LevlCast</div>
              </div>
              {comparisonRows.map((row, i) => (
                <div key={row.label} className={`grid grid-cols-3 text-sm ${i !== comparisonRows.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="p-5 font-bold">{row.label}</div>
                  <div className="p-5 text-muted leading-relaxed">{row.generic}</div>
                  <div className="p-5 text-white/90 leading-relaxed">{row.coach}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-24 border-t border-border" id="faq">
          <div className="max-w-[760px] mx-auto px-6">
            <h2 className="text-4xl font-extrabold tracking-tight mb-10 text-center">
              Questions about AI stream coaching
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
              Keep exploring
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/twitch-vod-analyzer" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">VOD Analyzer &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">The technical layer underneath — transcription, moment detection, diarization.</p>
              </Link>
              <Link href="/twitch-clip-generator" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">Clip Generator &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Turn the best moments from your coaching report into ready-to-post clips.</p>
              </Link>
              <Link href="/how-to-grow-on-twitch" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">How to Grow on Twitch &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Why coaching matters more than the growth hacks most streamers chase.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="py-28 border-t border-border text-center relative overflow-hidden">
          <div className="relative max-w-[680px] mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Get coached on<br /><span className="text-gradient">your next stream.</span>
            </h2>
            <p className="text-muted text-sm mb-10 max-w-[440px] mx-auto leading-relaxed">
              Connect Twitch. Analyze a VOD. Get your first coaching report — free, specific, and tied to your actual stream.
            </p>
            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-8 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_50px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-[0.97] mb-4"
            >
              Get Your First Report Free
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
            <p className="text-xs text-muted">Free to start. No credit card required.</p>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
