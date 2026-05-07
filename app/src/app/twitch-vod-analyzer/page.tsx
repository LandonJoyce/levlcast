import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Twitch VOD Analyzer AI Reviews Your Stream Automatically",
  description:
    "Upload your Twitch VOD and get a scored AI breakdown in minutes. Dead air, slow openings, weak engagement exact timestamps, honest feedback. Free to start.",
  alternates: { canonical: "/twitch-vod-analyzer" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/twitch-vod-analyzer",
    title: "Twitch VOD Analyzer AI Reviews Your Stream Automatically",
    description:
      "AI transcribes your VOD, scores every moment, and tells you specifically what to fix. Not generic tips real notes on your actual stream.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Twitch VOD Analyzer AI Reviews Your Stream",
    description:
      "AI transcribes your VOD, scores every moment, and tells you exactly what to fix.",
    images: ["/opengraph-image"],
  },
};

const capabilities = [
  {
    title: "Audio transcription",
    desc: "Deepgram nova-3 transcribes your full stream with speaker diarization so game NPCs, music, and co-streamer audio don't pollute the analysis.",
    accent: "bg-purple-500",
  },
  {
    title: "Moment detection",
    desc: "Claude Sonnet scores every segment and surfaces your best moments by category: hype, comedy, clutch, and educational drops.",
    accent: "bg-blue-500",
  },
  {
    title: "Dead-air detection",
    desc: "Silence gaps are flagged with exact timestamps. You see the ones your viewers felt and the habits behind them.",
    accent: "bg-red-500",
  },
  {
    title: "Energy-trend mapping",
    desc: "A per-stream energy curve shows where you peaked, where you dipped, and whether you're front-loading or slow-starting your sessions.",
    accent: "bg-yellow-500",
  },
];

const differentiators = [
  "Analyzes audio + chat, not chat alone",
  "Speaker diarization strips background audio before AI review",
  "Specific timestamps, not vague advice",
  "Scored 0–100 so you can track progress stream over stream",
  "Works on any Twitch channel no overlay or setup needed",
];

const steps = [
  { num: "01", label: "Connect Twitch", desc: "One-tap OAuth. We read your VOD library only no chat bot, no overlay install." },
  { num: "02", label: "Pick a VOD", desc: "Choose any past broadcast. The analyzer streams audio directly from Twitch." },
  { num: "03", label: "Get your report", desc: "In 2–5 minutes you get a scored breakdown with timestamps, moments, and a priority to fix." },
  { num: "04", label: "Act on it", desc: "Take one specific goal into your next stream. Analyze again. Watch the score climb." },
];

const faqs = [
  {
    q: "How accurate is a Twitch VOD analyzer if your stream has game audio?",
    a: "Most analyzers choke on background audio game NPCs, music, co-streamers. LevlCast runs Deepgram with speaker diarization and filters to the dominant speaker before the AI reviews anything. Your voice gets analyzed, not the game.",
  },
  {
    q: "What does the VOD analyzer actually check?",
    a: "It transcribes the audio, identifies silence gaps, scores every segment for energy and engagement, finds your best moments by category (hype, comedy, clutch, educational), and generates a coaching report with a 0–100 score plus one specific priority for next stream.",
  },
  {
    q: "Is the Twitch VOD analyzer really free?",
    a: "Yes no credit card required. The free plan includes one VOD analysis per month. Pro is $9.99/month or $99/year for 15 analyses and 20 clips per month.",
  },
  {
    q: "How long does VOD analysis take?",
    a: "2–5 minutes for most streams. Long broadcasts (25+ minutes) are split into chunks, analyzed in parallel, and re-ranked in a final pass so the best moments across the whole stream surface together.",
  },
  {
    q: "Does the analyzer store my VODs?",
    a: "No. We stream audio directly from Twitch, analyze it, and discard the raw video. Only transcription data and any clips you generate are stored in your account.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LevlCast Twitch VOD Analyzer",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web, iOS",
  description:
    "AI Twitch VOD analyzer that transcribes your stream, scores every moment, and gives coaching feedback with exact timestamps.",
  url: "https://www.levlcast.com/twitch-vod-analyzer",
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

export default function VodAnalyzerPage() {
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
          <div className="absolute -top-40 -left-40 w-[700px] h-[700px] bg-accent/[0.07] rounded-full blur-[120px] pointer-events-none" />
          <div className="relative max-w-[1080px] mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-center">
              <div className="md:col-span-6 lg:col-span-6">
                <div className="inline-flex items-center gap-2 bg-accent/[0.08] border border-accent/[0.2] text-accent-light/80 text-[11px] font-semibold px-4 py-1.5 rounded-full tracking-[0.08em] mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-light/70 animate-pulse" />
                  Twitch VOD Analyzer
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[-2px] leading-[1.05] mb-6">
                  AI watches your VOD.<br />
                  <span className="text-gradient">Tells you what to fix.</span>
                </h1>
                <p className="text-base text-muted max-w-[520px] mb-8 leading-relaxed">
                  LevlCast is a Twitch VOD analyzer that transcribes your stream, scores every moment, and gives you a coaching report with exact timestamps. Dead air, slow openings, weak engagement specific to your actual broadcast, not generic tips.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                  <Link
                    href="/auth/login"
                    className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-7 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5 active:scale-[0.97]"
                  >
                    Analyze a VOD Free
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
                    src="/screenshots/image13.png"
                    alt="LevlCast Twitch VOD analyzer report showing stream score, priorities, and growth-killer flags"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── What the analyzer checks ─── */}
        <section className="py-24 border-t border-border relative overflow-hidden">
          <div className="max-w-[1080px] mx-auto px-6">
            <div className="mb-5">
              <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">What gets analyzed</span>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4 md:text-left">
              Four layers of analysis.<br />One report.
            </h2>
            <p className="text-muted text-sm max-w-[520px] mb-14 leading-relaxed md:text-left">
              A proper Twitch VOD analyzer has to do more than scan chat. LevlCast transcribes the audio, filters background noise, scores every segment, and maps your energy across the session.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map((c) => (
                <div key={c.title} className="card p-7 hover:border-white/[0.14] transition-all hover:-translate-y-px relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-[2px] ${c.accent} opacity-40`} />
                  <h3 className="font-bold text-base mb-2">{c.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{c.desc}</p>
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
                  <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Why this analyzer</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-6">
                  Most &ldquo;analyzers&rdquo; just read your chat.
                </h2>
                <p className="text-muted text-sm mb-6 leading-relaxed">
                  Chat-only tools miss the entire point. The moments that grow a channel a clean clutch, a funny aside, a genuine reaction often happen with zero chat activity. You need a tool that hears what actually happened.
                </p>
                <ul className="space-y-3">
                  {differentiators.map((d) => (
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
                    src="/screenshots/image12.png"
                    alt="Detailed VOD analyzer feedback showing specific fixes and timestamps for the next stream"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── How it works ─── */}
        <section className="py-24 border-t border-border">
          <div className="max-w-[1080px] mx-auto px-6">
            <div className="mb-5">
              <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">How it works</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] mb-16 leading-tight md:text-left">
              From OAuth to report<br />in under five minutes.
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
              {steps.map((step) => (
                <div key={step.num} className="card p-7 hover:border-accent/25 transition-colors">
                  <span className="text-4xl font-black text-white/[0.06] leading-none block mb-5">{step.num}</span>
                  <h3 className="font-bold text-base mb-2">{step.label}</h3>
                  <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section className="py-24 border-t border-border" id="faq">
          <div className="max-w-[760px] mx-auto px-6">
            <h2 className="text-4xl font-extrabold tracking-tight mb-10 text-center">
              Questions about the VOD analyzer
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
              <Link href="/twitch-clip-generator" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">Twitch Clip Generator &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Turn the moments this analyzer finds into ready-to-post clips.</p>
              </Link>
              <Link href="/twitch-stream-coach" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">AI Stream Coach &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Go deeper on the coaching side what your weekly brief looks like.</p>
              </Link>
              <Link href="/how-to-grow-on-twitch" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">How to Grow on Twitch &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">The tactics that actually move the needle in 2026.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="py-28 border-t border-border text-center relative overflow-hidden">
          <div className="relative max-w-[680px] mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Point the analyzer<br /><span className="text-gradient">at your last stream.</span>
            </h2>
            <p className="text-muted text-sm mb-10 max-w-[440px] mx-auto leading-relaxed">
              Your first VOD analysis is free. Connect Twitch, pick a broadcast, and find out what your viewers actually felt.
            </p>
            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-8 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_50px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-[0.97] mb-4"
            >
              Analyze a VOD Free
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
