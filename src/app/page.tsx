import Link from "next/link";
import {
  Zap,
  BarChart2,
  Share2,
  Scissors,
  Check,
  TrendingUp,
  Brain,
  Video,
} from "lucide-react";
import FaqSection from "@/components/FaqSection";

const steps = [
  {
    num: "01",
    icon: Video,
    label: "You Stream",
    desc: "Go live on Twitch like you always do. Nothing changes on your end.",
  },
  {
    num: "02",
    icon: Brain,
    label: "AI Clips It",
    desc: "LevlCast finds your best moments — hype, laughs, clutch plays — automatically.",
  },
  {
    num: "03",
    icon: Share2,
    label: "Auto-Post",
    desc: "Clips go to YouTube, TikTok, and Reels with captions written for you.",
  },
  {
    num: "04",
    icon: TrendingUp,
    label: "You Grow",
    desc: "More eyes on your clips. More viewers on your stream. Repeat.",
  },
];

const features = [
  {
    icon: Brain,
    title: "AI Peak Detection",
    desc: "Detects hype, funny moments, clutch plays, and educational drops — scored and ranked automatically.",
  },
  {
    icon: BarChart2,
    title: "Coaching Reports",
    desc: "Get a 0–100 stream score with strengths, energy analysis, and actionable improvements after every session.",
  },
  {
    icon: Scissors,
    title: "One-Click Clips",
    desc: "Turn any peak moment into a polished clip ready for YouTube, TikTok, or Instagram — no editing needed.",
  },
  {
    icon: Zap,
    title: "Twitch Integration",
    desc: "Connect once with Twitch OAuth. Your VODs sync automatically — no uploads, no hassle.",
  },
];

const proFeatures = [
  "Unlimited VOD analyses",
  "Unlimited clips",
  "AI peak detection (hype, funny, clutch, educational)",
  "Coaching report with stream score",
  "YouTube auto-post",
  "Priority processing",
  "Early access to new features",
];

const freeFeatures = [
  "1 VOD analysis per month",
  "Up to 5 clips (lifetime)",
  "AI peak detection",
  "Coaching report with stream score",
  "YouTube auto-post",
];


export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <span className="text-xl font-extrabold tracking-tight text-gradient flex-shrink-0">
            LevlCast
          </span>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-7 text-sm text-muted font-medium">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="hidden md:block text-sm text-muted hover:text-white transition-colors font-medium"
            >
              Log in
            </Link>
            <Link
              href="/auth/login"
              className="bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-85 transition-opacity"
            >
              Analyze Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-44 pb-20 text-center overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[700px] glow-bg pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6 relative">
          <div className="inline-block bg-accent/10 border border-accent-light/30 text-accent-light text-xs font-semibold px-4 py-1.5 rounded-full mb-7 uppercase tracking-wider">
            Free to Start &middot; No Credit Card Required
          </div>
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-[-3px] leading-[1.02] mb-6">
            LvL Up
            <br />
            Your Stream.
          </h1>
          <p className="text-lg text-muted max-w-[480px] mx-auto mb-10 leading-relaxed">
            AI-powered tools that turn your Twitch stream into clips, content,
            and a bigger audience — automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <Link
              href="/auth/login"
              className="inline-block bg-accent text-white font-bold px-8 py-4 rounded-xl hover:opacity-88 transition-opacity text-base"
            >
              Get Started Free
            </Link>
            <a
              href="#how-it-works"
              className="inline-block border border-border text-white/70 hover:text-white font-semibold px-8 py-4 rounded-xl hover:border-white/20 transition-all text-base"
            >
              See How It Works
            </a>
          </div>

          <p className="text-xs text-muted">
            No upload required. Connect with Twitch and get your first report in minutes.
          </p>

          {/* Mock dashboard preview card */}
          <div className="mt-16 max-w-sm mx-auto text-left animate-fade-in">
            <div className="glass border border-border rounded-2xl p-6 shadow-glow-lg">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-xs text-muted font-medium">Stream analyzed</span>
                <span className="ml-auto text-xs text-accent-light font-bold">78 / 100</span>
              </div>
              <div className="space-y-3 mb-5">
                {[
                  { label: "Peak moments found", value: "5 clips" },
                  { label: "Top moment", value: "1:24:35 — Hype" },
                  { label: "Energy trend", value: "Strong start" },
                  { label: "Audience retention", value: "High" },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-muted">{item.label}</span>
                    <span className="font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-xs text-accent-light font-semibold">
                  5 clips ready to export →
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="py-10 border-y border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-10 text-center">
            {[
              { stat: "~5 min", label: "Avg. analysis time" },
              { stat: "4 types", label: "Peak categories detected" },
              { stat: "Free", label: "To start, always" },
              { stat: "0", label: "Uploads required" },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-2xl font-extrabold text-gradient">{item.stat}</div>
                <div className="text-xs text-muted mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-28 border-b border-border" id="features">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
            Features
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] text-center mb-16 leading-tight">
            Everything you need.
            <br />
            Nothing you don&apos;t.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass border border-border rounded-2xl p-7 hover:border-accent/40 transition-colors"
                >
                  <div className="w-10 h-10 bg-accent/15 rounded-xl flex items-center justify-center mb-5">
                    <Icon className="w-5 h-5 text-accent-light" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-28 border-b border-border" id="how-it-works">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
            The System
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] text-center mb-16 leading-tight">
            Stream once.
            <br />
            Grow everywhere.
          </h2>
          <div className="flex items-start justify-center gap-3 flex-wrap">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex items-start gap-3">
                  <div className="text-center flex-1 min-w-[160px] max-w-[200px]">
                    <div className="w-12 h-12 bg-accent/15 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-5 h-5 text-accent-light" />
                    </div>
                    <div className="text-xs font-bold tracking-wider text-accent-light/70 mb-2">
                      {step.num}
                    </div>
                    <div className="text-base font-bold mb-2">{step.label}</div>
                    <p className="text-[13px] text-muted leading-relaxed">{step.desc}</p>
                  </div>
                  {i < steps.length - 1 && (
                    <span className="text-xl text-accent-light/40 pt-5 flex-shrink-0">→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-28 border-b border-border" id="pricing">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
            Pricing
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] text-center mb-4 leading-tight">
            Simple, honest pricing.
          </h2>
          <p className="text-center text-muted mb-16 max-w-md mx-auto">
            Start free, no credit card required. Upgrade when you&apos;re ready to go unlimited.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
            {/* Free */}
            <div className="glass border border-border rounded-2xl p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-1">Free</h3>
                <div className="text-4xl font-extrabold mb-1">$0</div>
                <p className="text-xs text-muted">Forever free</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-accent-light mt-0.5 flex-shrink-0" />
                    <span className="text-muted">{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="block text-center border border-border text-white font-semibold py-3 rounded-xl hover:border-accent/50 transition-colors text-sm"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative border border-accent/50 bg-accent/5 rounded-2xl p-8 flex flex-col shadow-glow">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1 rounded-full">
                Most Popular
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-bold mb-1">Pro</h3>
                <div className="text-4xl font-extrabold mb-1">$9.99</div>
                <p className="text-xs text-muted">per month</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-accent-light mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="block text-center bg-accent text-white font-bold py-3 rounded-xl hover:opacity-88 transition-opacity text-sm"
              >
                Start Pro Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>


      {/* ── FAQ ── */}
      <FaqSection />

      {/* ── Final CTA ── */}
      <section className="py-28 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 glow-bg pointer-events-none" />
        <div className="max-w-[680px] mx-auto px-6 text-center relative">
          <h2 className="text-4xl md:text-6xl font-extrabold tracking-[-2px] mb-6 leading-tight">
            Ready to LvL Up?
          </h2>
          <p className="text-muted mb-10 leading-relaxed">
            Stop spending hours editing clips. Let AI handle it so you can focus on streaming.
            Start free — no credit card required.
          </p>
          <Link
            href="/auth/login"
            className="inline-block bg-accent text-white font-bold px-10 py-4 rounded-xl hover:opacity-88 transition-opacity text-base"
          >
            Analyze My Stream Free
          </Link>
          <p className="text-xs text-muted mt-5">
            Connect with Twitch. No upload required.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-14">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <span className="text-xl font-extrabold text-gradient block mb-3">LevlCast</span>
              <p className="text-xs text-muted leading-relaxed">
                Built by a streamer, for streamers.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-muted mb-4">Product</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#features" className="text-muted hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-muted hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#how-it-works" className="text-muted hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#faq" className="text-muted hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-muted mb-4">Legal</p>
              <ul className="space-y-3 text-sm">
                <li><Link href="/terms" className="text-muted hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-muted hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            {/* Socials */}
            <div>
              <p className="text-xs font-bold tracking-wider uppercase text-muted mb-4">Connect</p>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="https://twitch.tv" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white transition-colors">
                    Twitch
                  </a>
                </li>
                <li>
                  <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white transition-colors">
                    X (Twitter)
                  </a>
                </li>
                <li>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white transition-colors">
                    Discord
                  </a>
                </li>
                <li>
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-white transition-colors">
                    YouTube
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted">© 2026 LevlCast. All rights reserved.</p>
            <p className="text-xs text-muted">Built by a streamer, for streamers.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
