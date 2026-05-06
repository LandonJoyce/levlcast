import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Twitch Clip Generator AI Makes Clips From Your VODs",
  description:
    "LevlCast's AI Twitch clip generator finds your best moments hype, comedy, clutch and turns them into ready-to-post clips. Auto-post to YouTube Shorts. Free to start.",
  alternates: { canonical: "/twitch-clip-generator" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/twitch-clip-generator",
    title: "Twitch Clip Generator AI Makes Clips From Your VODs",
    description:
      "AI finds your best moments and turns them into ready-to-post clips. No scrubbing, no editing, no manual picking.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Twitch Clip Generator AI-Powered",
    description:
      "AI finds your best Twitch moments and turns them into ready-to-post clips.",
    images: ["/opengraph-image"],
  },
};

const categories = [
  { title: "Hype moments", desc: "Chat spikes, hype trains, and energy surges. The clips your biggest fans rewatch.", accent: "bg-purple-500" },
  { title: "Comedy", desc: "Real laughter, reactions, and the unscripted bits that make your channel feel human.", accent: "bg-yellow-500" },
  { title: "Clutch plays", desc: "Key gameplay moments the last-second saves and the wins worth bragging about.", accent: "bg-blue-500" },
  { title: "Educational drops", desc: "The tip or insight you casually dropped mid-stream that deserves its own clip.", accent: "bg-green-500" },
];

const versusPoints = [
  {
    them: "You pick the moment. Tool trims it.",
    us: "AI finds the moment. You just hit generate.",
  },
  {
    them: "Works from chat spikes only.",
    us: "Works from audio + chat + energy curve.",
  },
  {
    them: "Clip sits in a downloads folder.",
    us: "Post straight to YouTube Shorts in one tap.",
  },
  {
    them: "Every clip costs your time.",
    us: "Every analyzed VOD surfaces up to six clip-worthy moments.",
  },
];

const steps = [
  { num: "01", label: "Sync a VOD", desc: "Pull any Twitch broadcast into LevlCast. OAuth takes ten seconds." },
  { num: "02", label: "AI scans the stream", desc: "Claude + Deepgram find moments by category and rank them by strength." },
  { num: "03", label: "One-tap generate", desc: "Pick a moment, hit generate. FFmpeg cuts the clip and uploads it to your library." },
  { num: "04", label: "Post anywhere", desc: "Download the file or post straight to YouTube Shorts from the dashboard." },
];

const faqs = [
  {
    q: "How does an AI Twitch clip generator pick moments?",
    a: "LevlCast transcribes the audio with Deepgram, scores every segment with Claude Sonnet, and ranks moments by category hype, comedy, clutch, educational. Up to six clip-worthy moments surface per VOD, with a confidence score for each.",
  },
  {
    q: "Do I still need to edit the clips?",
    a: "No. Clips are cut with FFmpeg at 30–90 seconds, padded ±3–5 seconds from the moment boundary so the setup and payoff are intact. Download as-is or post to YouTube Shorts directly.",
  },
  {
    q: "How is this different from Streamladder or manual clipping?",
    a: "Manual tools make you find the moment first. LevlCast finds the moment for you that's the whole pitch. You go from three hours of VOD to a ranked list of six clips without scrubbing a timeline.",
  },
  {
    q: "Can I post the clips to YouTube Shorts automatically?",
    a: "Yes. Connect your YouTube channel from the dashboard and publish straight from LevlCast. TikTok and Instagram integrations are on the roadmap.",
  },
  {
    q: "What does the clip generator cost?",
    a: "Free plan: 5 clips, 1 VOD analysis per month. Pro: $9.99/month or $99/year for 15 analyses and 20 clips per month. No credit card to start.",
  },
];

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LevlCast Twitch Clip Generator",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web, iOS",
  description:
    "AI-powered Twitch clip generator that finds your best moments and turns them into ready-to-post clips with one tap.",
  url: "https://www.levlcast.com/twitch-clip-generator",
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

export default function ClipGeneratorPage() {
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
          <div className="absolute -top-40 -right-40 w-[700px] h-[700px] bg-accent/[0.07] rounded-full blur-[120px] pointer-events-none" />
          <div className="relative max-w-[1080px] mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-14 items-center">
              <div className="md:col-span-6 lg:col-span-6">
                <div className="inline-flex items-center gap-2 bg-accent/[0.08] border border-accent/[0.2] text-accent-light/80 text-[11px] font-semibold px-4 py-1.5 rounded-full tracking-[0.08em] mb-8">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-light/70 animate-pulse" />
                  Twitch Clip Generator
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-[-2px] leading-[1.05] mb-6">
                  AI finds your best moments.<br />
                  <span className="text-gradient">Clips them for you.</span>
                </h1>
                <p className="text-base text-muted max-w-[520px] mb-8 leading-relaxed">
                  Stop scrubbing three-hour VODs. LevlCast is a Twitch clip generator that transcribes your stream, ranks the best moments by category, and cuts ready-to-post clips with one tap. Post straight to YouTube Shorts.
                </p>
                <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                  <Link
                    href="/auth/login"
                    className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-7 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5 active:scale-[0.97]"
                  >
                    Generate Clips Free
                    <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </Link>
                </div>
                <p className="text-xs text-muted">Free plan includes 5 clips. No credit card.</p>
              </div>
              <div className="md:col-span-6 lg:col-span-6 md:translate-y-4">
                <div className="rounded-2xl overflow-hidden border border-border shadow-glow-lg">
                  <img
                    src="/screenshots/image16.png"
                    alt="LevlCast VOD library with moment counts and one-tap Coach Report access"
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Categories ─── */}
        <section className="py-24 border-t border-border">
          <div className="max-w-[1080px] mx-auto px-6">
            <div className="mb-5">
              <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">What gets clipped</span>
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-4 md:text-left">
              Four categories.<br />Up to six clips per VOD.
            </h2>
            <p className="text-muted text-sm max-w-[520px] mb-14 leading-relaxed md:text-left">
              The AI ranks every moment in your stream and surfaces the top candidates. Not just chat spikes the actual clip-worthy content.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.map((c) => (
                <div key={c.title} className="card p-7 hover:border-white/[0.14] transition-all hover:-translate-y-px relative overflow-hidden">
                  <div className={`absolute top-0 left-0 right-0 h-[2px] ${c.accent} opacity-40`} />
                  <h3 className="font-bold text-base mb-2">{c.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Them vs Us ─── */}
        <section className="py-24 border-t border-border bg-surface/30">
          <div className="max-w-[980px] mx-auto px-6">
            <div className="mb-5">
              <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Compared to manual clipping</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-12 md:text-left">
              Manual clipping vs AI clipping.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card p-7">
                <h3 className="text-sm font-bold text-muted uppercase tracking-wider mb-5">Manual / chat-only tools</h3>
                <ul className="space-y-3">
                  {versusPoints.map((p) => (
                    <li key={p.them} className="text-sm text-muted/80 leading-relaxed">&bull; {p.them}</li>
                  ))}
                </ul>
              </div>
              <div className="card p-7 border-accent/30">
                <h3 className="text-sm font-bold text-accent-light uppercase tracking-wider mb-5">LevlCast clip generator</h3>
                <ul className="space-y-3">
                  {versusPoints.map((p) => (
                    <li key={p.us} className="flex items-start gap-2.5 text-sm text-white/90 leading-relaxed">
                      <Check className="w-4 h-4 text-neon flex-shrink-0 mt-0.5" />
                      <span>{p.us}</span>
                    </li>
                  ))}
                </ul>
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
              Three-hour VOD<br />to six posted clips.
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
              Questions about the clip generator
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
                <p className="text-sm text-muted leading-relaxed">See the full coaching report that runs before clips get generated.</p>
              </Link>
              <Link href="/twitch-stream-coach" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">AI Stream Coach &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Coaching on what to fix beyond just the clip-worthy moments.</p>
              </Link>
              <Link href="/how-to-grow-on-twitch" className="card p-6 hover:border-accent/25 transition-colors block">
                <h3 className="font-bold text-base mb-2">How to Grow on Twitch &rarr;</h3>
                <p className="text-sm text-muted leading-relaxed">Why consistent clip posting is one of the few moves that compound.</p>
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Final CTA ─── */}
        <section className="py-28 border-t border-border text-center relative overflow-hidden">
          <div className="relative max-w-[680px] mx-auto px-6">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
              Stop leaving great<br /><span className="text-gradient">moments on the VOD.</span>
            </h2>
            <p className="text-muted text-sm mb-10 max-w-[440px] mx-auto leading-relaxed">
              Connect Twitch, pick a VOD, and get six ranked clips ready to post. Your best content, on your channel, without scrubbing a timeline.
            </p>
            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-8 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_50px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-[0.97] mb-4"
            >
              Generate Clips Free
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
            <p className="text-xs text-muted">Free plan includes 5 clips. No credit card.</p>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
