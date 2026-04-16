import Link from "next/link";
import { Check, Play, Twitch, Brain, Scissors, TrendingUp, BarChart2, MessageSquare, HeartPulse, Users, Newspaper, Zap } from "lucide-react";
import NavBar from "@/components/NavBar";
import FaqSection from "@/components/FaqSection";

/* ─── How It Works steps ─── */
const steps = [
  {
    icon: Twitch,
    num: "01",
    label: "Connect Twitch",
    desc: "Sign in with Twitch. Your VODs sync automatically. Nothing to upload, nothing to configure.",
    color: "text-[#9146FF]",
    bg: "bg-[#9146FF]/10",
    border: "border-[#9146FF]/20",
  },
  {
    icon: Brain,
    num: "02",
    label: "AI Analyzes Everything",
    desc: "Every stream gets a full breakdown — peak moments, quality score, content style, and what's actually working.",
    color: "text-accent-light",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  {
    icon: Zap,
    num: "03",
    label: "Get Your Game Plan",
    desc: "Monday morning, your manager delivers a weekly digest with action items, health signals, and growth strategy.",
    color: "text-cyan",
    bg: "bg-cyan/10",
    border: "border-cyan/20",
  },
  {
    icon: TrendingUp,
    num: "04",
    label: "Grow on Autopilot",
    desc: "Generate clips from your best moments, find collab partners, and track what's actually moving the needle.",
    color: "text-neon",
    bg: "bg-neon/10",
    border: "border-neon/20",
  },
];

/* ─── Manager features ─── */
const managerFeatures = [
  {
    icon: Brain,
    title: "Stream Coaching",
    desc: "After every stream, get a scored report with what worked, what didn't, and specific goals for next time. Not generic advice — feedback on your actual VOD.",
    color: "text-accent-light",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  {
    icon: HeartPulse,
    title: "Burnout Detection",
    desc: "Your manager tracks your energy, session length, frequency, and score trends. If you're burning out, you'll know before it tanks your channel.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    icon: BarChart2,
    title: "Content Strategy",
    desc: "See which content categories drive the most growth for your channel. Know whether to double down on hype content or try more variety.",
    color: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  {
    icon: Users,
    title: "Collab Matching",
    desc: "Get matched with streamers who complement your style. Internal matches from LevlCast users and external discoveries from across Twitch.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    icon: Newspaper,
    title: "Weekly Digest",
    desc: "Every Monday, your personal manager compiles your week — stats, insights, and 2-3 action items. Like having a manager text you a game plan.",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
  },
  {
    icon: Scissors,
    title: "Clip Generation",
    desc: "One click turns peak moments into ready-to-post clips. Your best content, extracted and formatted automatically.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
  },
];

/* ─── Pricing features ─── */
const freeFeatures = [
  "1 VOD analysis per month",
  "AI coaching report",
  "5 clips total",
];
const proFeatures = [
  "20 VOD analyses per month",
  "Full AI coach report every stream",
  "20 clip generations per month",
  "Weekly manager digest",
  "Burnout monitoring",
  "Content performance analytics",
  "Collab matching",
  "Priority processing",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg text-white noise">
      {/* Global mesh gradient */}
      <div className="fixed inset-0 mesh-gradient pointer-events-none z-0" />

      <div className="relative z-[1]">
      <NavBar />

      {/* ─── Hero ─── */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        {/* Grid + glow background */}
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] glow-bg-top pointer-events-none" />

        <div className="relative max-w-[1080px] mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-accent/[0.08] border border-accent/[0.2] text-accent-light/80 text-[11px] font-semibold px-4 py-1.5 rounded-full tracking-[0.08em] mb-10">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-light/70 animate-pulse" />
            Founding member pricing — limited spots
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-[-3px] leading-[1.02] mb-6">
            Your Personal
            <br />
            <span className="text-gradient">Stream Manager.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-muted max-w-[580px] mx-auto mb-10 leading-relaxed">
            LevlCast watches your VODs and tells you — specifically — what to fix. The dead air, the slow openings, the habits you can&apos;t see while you&apos;re live. Real coaching on your actual stream, so every session makes you sharper.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
            <Link
              href="/auth/login"
              className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-7 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_40px_rgba(124,58,237,0.45)] hover:-translate-y-0.5 active:scale-[0.97] w-full sm:w-auto justify-center"
            >
              Get Your Manager Free
              <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
            </Link>
            <button
              disabled
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 border border-white/[0.08] text-white/25 font-medium px-8 py-4 rounded-full text-base cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-current" />
              Demo coming soon
            </button>
          </div>
          <p className="text-xs text-muted">Free to start. No credit card required.</p>

          {/* Mock dashboard preview */}
          <div className="mt-16 max-w-2xl mx-auto">
            <div className="card-accent p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Newspaper size={14} className="text-blue-400" />
                  <span className="text-xs text-muted font-semibold uppercase tracking-wide">Weekly Digest</span>
                </div>
                <span className="text-xs text-muted">Monday 9am</span>
              </div>
              <p className="text-sm font-semibold text-white mb-3 text-left">
                4 streams this week, avg 76 score, +120 followers. Your hype content is outperforming everything else by 2x.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-[11px] bg-green-500/10 text-green-400 border border-green-500/20 px-2.5 py-1 rounded-full font-semibold">Health: Good</span>
                <span className="text-[11px] bg-accent/10 text-accent-light border border-accent/20 px-2.5 py-1 rounded-full font-semibold">3 collab matches</span>
                <span className="text-[11px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2.5 py-1 rounded-full font-semibold">2 action items</span>
              </div>
              <div className="space-y-1.5 text-left">
                <div className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-accent-light mt-0.5">1.</span>
                  Double down on hype content this week — it's driving 60% of your follower growth
                </div>
                <div className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-accent-light mt-0.5">2.</span>
                  Check your new collab matches — one streams the same games with a similar audience
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pain points ─── */}
      <section className="py-20 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 glow-left pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 md:text-left">
            You don&apos;t have a team. Now you do.
          </h2>
          <p className="text-muted max-w-[520px] mb-14 text-sm leading-relaxed md:text-left">
            Big streamers have managers, coaches, and editors. You&apos;re doing everything yourself. LevlCast gives you the same support system — powered by AI.
          </p>
          {/* Asymmetric: two cards left, one featured card right */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2 space-y-4">
              <div className="card p-6 hover:border-accent/25 transition-colors group">
                <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-accent/15 transition-colors">
                  <BarChart2 className="w-5 h-5 text-accent-light" />
                </div>
                <h3 className="font-bold mb-2">No one managing your growth</h3>
                <p className="text-sm text-muted leading-relaxed">You stream, you end, you guess. No one is tracking which content works, when you&apos;re burning out, or who you should collab with.</p>
              </div>
              <div className="card p-6 hover:border-accent/25 transition-colors group">
                <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-accent/15 transition-colors">
                  <Scissors className="w-5 h-5 text-accent-light" />
                </div>
                <h3 className="font-bold mb-2">Your best moments go unclipped</h3>
                <p className="text-sm text-muted leading-relaxed">You had 5 great moments last stream. But you didn&apos;t clip them, so they disappeared when the VOD expired.</p>
              </div>
            </div>
            {/* Featured pain point — bigger, more padding */}
            <div className="md:col-span-3 card p-8 md:p-10 hover:border-accent/25 transition-colors group flex flex-col justify-center">
              <div className="w-12 h-12 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center mb-6 group-hover:bg-accent/15 transition-colors">
                <MessageSquare className="w-6 h-6 text-accent-light" />
              </div>
              <h3 className="font-bold text-xl mb-3">You don&apos;t know why it&apos;s not growing</h3>
              <p className="text-[15px] text-muted leading-relaxed">The habits holding you back — dead air, weak openings, ignored chat — are invisible to you in the moment. No one watches back your VODs and tells you the truth.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="py-24 border-t border-border relative overflow-hidden" id="how-it-works">
        <div className="absolute inset-0 glow-right pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">How it works</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] text-center mb-16 leading-tight">
            Connect once.
            <br />
            Get managed forever.
          </h2>

          {/* 2x2 staggered grid instead of 4 equal columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-[820px] mx-auto">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isEven = i % 2 === 0;
              return (
                <div key={step.num} className={`relative card hover:border-accent/25 transition-colors group ${isEven ? "p-6 sm:p-7" : "p-6"} ${i >= 2 ? "sm:translate-y-3" : ""}`}>
                  <div className={`${isEven ? "w-12 h-12" : "w-10 h-10"} ${step.bg} border ${step.border} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <div className="text-xs font-medium text-muted/60 mb-2">{step.num}</div>
                  <h3 className="font-bold text-base mb-2">{step.label}</h3>
                  <p className="text-[13px] text-muted leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── What Your Manager Does ─── */}
      <section className="py-24 border-t border-border relative overflow-hidden" id="features">
        <div className="absolute inset-0 glow-left pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Your manager&apos;s toolkit</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-4 md:text-left">
            Everything a real manager would do.
          </h2>
          <p className="text-muted text-sm max-w-[480px] mb-14 leading-relaxed md:text-left">
            LevlCast doesn&apos;t just analyze clips. It watches over your entire streaming career and tells you what to do about it.
          </p>

          {/* Bento layout: intentionally asymmetric spans */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {managerFeatures.map((feat, i) => {
              const Icon = feat.icon;
              // Varied column spans for organic layout: 7-5, 4-4-4, 12
              const spanClass = [
                "md:col-span-7", // Stream Coaching — hero feature, wider
                "md:col-span-5", // Burnout Detection
                "md:col-span-4", // Content Strategy
                "md:col-span-4", // Collab Matching
                "md:col-span-4", // Weekly Digest
                "md:col-span-12", // Clip Generation — full-width bar
              ][i];
              const isHero = i === 0;
              const isFull = i === 5;

              return (
                <div
                  key={feat.title}
                  className={`card group hover:border-white/[0.14] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px ${spanClass} ${isHero ? "p-8" : "p-6"}`}
                >
                  {isFull ? (
                    <div className="flex items-center gap-5">
                      <div className={`w-10 h-10 ${feat.bg} border ${feat.border} rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                        <Icon className={`w-5 h-5 ${feat.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold mb-1">{feat.title}</h3>
                        <p className="text-sm text-muted leading-relaxed">{feat.desc}</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`${isHero ? "w-12 h-12" : "w-10 h-10"} ${feat.bg} border ${feat.border} rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300`}>
                        <Icon className={`w-5 h-5 ${feat.color}`} />
                      </div>
                      <h3 className={`font-bold mb-2 ${isHero ? "text-lg" : ""}`}>{feat.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{feat.desc}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Coaching Report — Real Screenshots ─── */}
      <section className="py-24 border-t border-border bg-surface/30">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">The coaching report</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight mb-4 md:text-left">
            Real feedback after every stream.
          </h2>
          <p className="text-muted text-sm max-w-[460px] mb-14 leading-relaxed md:text-left">
            Your manager reviews every VOD — scored, honest, and specific to what actually happened. Not &ldquo;be more engaging.&rdquo; Actual notes.
          </p>

          {/* Overlapping screenshot pair — report on left, feedback offset right */}
          <div className="relative max-w-[960px] mx-auto">
            <div className="md:w-[75%] rounded-2xl overflow-hidden border border-border shadow-glow-lg">
              <img
                src="/screenshots/coach-report.png"
                alt="Stream coach report showing a score of 44 with specific priorities and missions for the next stream"
                className="w-full h-auto"
              />
            </div>
            <div className="mt-5 md:mt-0 md:absolute md:right-0 md:bottom-[-40px] md:w-[60%] rounded-2xl overflow-hidden border border-border shadow-glow-lg bg-bg">
              <img
                src="/screenshots/coach-feedback.png"
                alt="Detailed coaching feedback showing what worked and specific fixes for the next stream"
                className="w-full h-auto"
              />
            </div>
            {/* Spacer for the overlapping element on desktop */}
            <div className="hidden md:block h-16" />
          </div>
        </div>
      </section>

      {/* ─── Product Screenshots ─── */}
      <section className="py-24 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 glow-right pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">The full picture</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Track everything. Improve every stream.
          </h2>
          <p className="text-center text-muted text-sm max-w-[480px] mx-auto mb-14 leading-relaxed">
            VOD scores, content analytics, streamer health, and collab matches — all in one dashboard, updated after every stream.
          </p>

          {/* Staggered screenshot layout */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Dashboard — slightly larger */}
            <div className="md:col-span-7 rounded-2xl overflow-hidden border border-border hover:border-accent/25 transition-colors">
              <img
                src="/screenshots/dashboard.jpg"
                alt="Dashboard showing recent stream scores, streamer health warning, VOD stats, and collab matches"
                className="w-full h-auto"
              />
            </div>

            {/* Analytics */}
            <div className="md:col-span-5 rounded-2xl overflow-hidden border border-border hover:border-accent/25 transition-colors">
              <img
                src="/screenshots/analytics.png"
                alt="Analytics dashboard with stream quality trend over time, content breakdown, and follower growth"
                className="w-full h-auto"
              />
            </div>

            {/* VOD list — full width */}
            <div className="md:col-span-12 rounded-2xl overflow-hidden border border-border hover:border-accent/25 transition-colors">
              <img
                src="/screenshots/vod-list.png"
                alt="VOD list showing 8 analyzed streams with scores and coach report links"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 glow-bottom pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Pricing</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Simple, honest pricing.
          </h2>
          <p className="text-center text-muted text-sm mb-14">
            Start free. Upgrade when you&apos;re ready.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
            {/* Free */}
            <div className="card p-8 flex flex-col">
              <h3 className="font-extrabold text-lg mb-1">Free</h3>
              <p className="text-muted text-sm mb-6">See what your manager can do.</p>
              <div className="text-4xl font-extrabold mb-6">$0</div>
              <ul className="space-y-3 mb-8 flex-1">
                {freeFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted">
                    <Check className="w-4 h-4 text-neon flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="block text-center border border-white/[0.1] hover:border-accent/40 text-white/70 hover:text-white font-semibold py-3 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] text-sm"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative p-px rounded-[22px] bg-gradient-to-b from-accent/50 to-accent/10 shadow-[0_0_80px_rgba(124,58,237,0.28)]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-[11px] font-bold px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(124,58,237,0.5)] whitespace-nowrap z-10">
                Founding Member Price
              </div>
              <div className="bg-surface rounded-[21px] p-8 flex flex-col h-full">
              <h3 className="font-extrabold text-lg mb-1">Pro</h3>
              <p className="text-muted text-sm mb-6">Full management, every stream.</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-extrabold text-accent-light">$9.99</span>
                <span className="text-muted text-sm mb-1.5">/month</span>
              </div>
              <p className="text-xs text-muted mb-6">Price locks in for life. Increases to $14.99 soon.</p>
              <ul className="space-y-3 mb-8 flex-1">
                {proFeatures.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-neon flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="btn-accent block text-center py-3 text-sm"
              >
                Get Pro — $9.99/mo
              </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Built by a streamer ─── */}
      <section className="py-20 border-t border-border">
        <div className="max-w-[680px] mx-auto px-6 text-center">
          <p className="text-lg font-bold mb-3">Built for streamers who want real growth.</p>
          <p className="text-sm text-muted leading-relaxed">
            Growth stalls and no one tells you why. Big streamers have coaches and managers pointing at the exact things to fix. You&apos;ve been doing it alone. LevlCast is the feedback loop you&apos;ve been missing — specific notes on your actual stream, so every session makes you sharper than the last.
          </p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <FaqSection />

      {/* ─── Final CTA ─── */}
      <section className="py-28 border-t border-border text-center relative overflow-hidden">
        <div className="absolute inset-0 glow-bg pointer-events-none" />
        <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />
        <div className="relative max-w-[680px] mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Your stream deserves
            <br />
            <span className="text-gradient">a manager.</span>
          </h2>
          <p className="text-muted text-sm mb-10 max-w-[440px] mx-auto leading-relaxed">
            Connect Twitch and get your first coaching report free. Find out exactly what&apos;s holding your stream back — and what to do about it next time you go live.
          </p>
          <Link
            href="/auth/login"
            className="group inline-flex items-center gap-3 bg-accent text-white font-bold px-8 py-4 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-[0_0_50px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 active:scale-[0.97] mb-4"
          >
            Get Your Manager Free
            <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-px transition-transform duration-300">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </Link>
          <p className="text-xs text-muted">Founding member price locks in at $9.99/mo forever.</p>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border py-14">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2 md:col-span-1">
              <span className="text-xl font-extrabold text-gradient block mb-3">LevlCast</span>
              <p className="text-xs text-muted leading-relaxed">
                Your personal streaming manager.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-4">Product</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#how-it-works" className="text-muted hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#features" className="text-muted hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-muted hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#faq" className="text-muted hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-4">Legal</p>
              <ul className="space-y-3 text-sm">
                <li><Link href="/terms" className="text-muted hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-muted hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted mb-4">Contact</p>
              <ul className="space-y-3 text-sm">
                <li>
                  <a href="mailto:support@levlcast.com" className="text-muted hover:text-white transition-colors">
                    support@levlcast.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted">&copy; 2026 LevlCast. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <p className="text-xs text-muted">Your personal streaming manager.</p>
              <a href="https://smollaunch.com" target="_blank" rel="noopener">
                <img src="https://smollaunch.com/badges/featured.svg" alt="Featured on Smol Launch" loading="lazy" width="250" height="60" />
              </a>
            </div>
          </div>
        </div>
      </footer>
      </div>
    </main>
  );
}
