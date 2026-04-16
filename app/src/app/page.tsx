import Link from "next/link";
import { Check, Play, Twitch, Brain, Scissors, TrendingUp, BarChart2, MessageSquare, Gamepad2, MessageCircle, Shuffle, HeartPulse, Users, Newspaper, Zap } from "lucide-react";
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
            LevlCast watches your VODs and tells you — specifically — what to fix. The dead air, the slow openings, the habits you can&apos;t see while you&apos;re live. Real coaching for streamers growing the honest way.
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
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-4">
            You don&apos;t have a team. Now you do.
          </h2>
          <p className="text-center text-muted max-w-[520px] mx-auto mb-14 text-sm leading-relaxed">
            Big streamers have managers, coaches, and editors. You&apos;re doing everything yourself. LevlCast gives you the same support system — powered by AI.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: BarChart2,
                title: "No one managing your growth",
                desc: "You stream, you end, you guess. No one is tracking which content works, when you're burning out, or who you should collab with.",
              },
              {
                icon: Scissors,
                title: "Your best moments go unclipped",
                desc: "You had 5 great moments last stream. But you didn't clip them, so they disappeared when the VOD expired.",
              },
              {
                icon: MessageSquare,
                title: "You don't know why it's not growing",
                desc: "The habits holding you back — dead air, weak openings, ignored chat — are invisible to you in the moment. No one watches back your VODs and tells you the truth.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="card p-6 hover:border-accent/25 transition-colors group">
                  <div className="w-10 h-10 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center mb-5 group-hover:bg-accent/15 transition-colors">
                    <Icon className="w-5 h-5 text-accent-light" />
                  </div>
                  <h3 className="font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative card p-6 hover:border-accent/25 transition-colors group">
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-10 -right-2.5 w-5 h-px bg-border z-10" />
                  )}
                  <div className={`w-12 h-12 ${step.bg} border ${step.border} rounded-xl flex items-center justify-center mb-5`}>
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
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Your manager&apos;s toolkit</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Everything a real manager would do.
          </h2>
          <p className="text-center text-muted text-sm max-w-[480px] mx-auto mb-14 leading-relaxed">
            LevlCast doesn&apos;t just analyze clips. It watches over your entire streaming career and tells you what to do about it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {managerFeatures.map((feat, i) => {
              const Icon = feat.icon;
              const isWide = i === 0;
              const isFull = i === 5;
              return (
                <div
                  key={feat.title}
                  className={[
                    "card p-6 group hover:border-white/[0.14] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-px",
                    isWide ? "md:col-span-2" : "",
                    isFull ? "md:col-span-3" : "",
                  ].join(" ")}
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
                      <div className={`w-10 h-10 ${feat.bg} border ${feat.border} rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300`}>
                        <Icon className={`w-5 h-5 ${feat.color}`} />
                      </div>
                      <h3 className={`font-bold mb-2 ${isWide ? "text-lg" : ""}`}>{feat.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{feat.desc}</p>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Coaching Report Mockup ─── */}
      <section className="py-24 border-t border-border bg-surface/30">
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">The coaching report</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Real feedback after every stream.
          </h2>
          <p className="text-center text-muted text-sm max-w-[460px] mx-auto mb-14 leading-relaxed">
            Your manager reviews every VOD — scored, honest, and specific to what actually happened. Not &ldquo;be more engaging.&rdquo; Actual notes.
          </p>

          <div className="max-w-[700px] mx-auto">
            <div className="bg-surface-2 border border-border rounded-t-2xl px-5 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-neon/60" />
              <div className="flex-1 mx-4">
                <div className="bg-surface rounded-md px-3 py-1.5 text-xs text-muted text-center font-mono">
                  levlcast.com/dashboard/vods/...
                </div>
              </div>
            </div>

            <div className="bg-surface border-x border-b border-border rounded-b-2xl overflow-hidden shadow-glow-lg">
              {/* Header */}
              <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/8" style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.12) 0%, transparent 60%)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)", boxShadow: "0 0 12px rgba(139,92,246,0.4)" }}>
                    <Zap size={14} style={{ color: "#a855f7" }} />
                  </div>
                  <span className="font-extrabold text-sm tracking-tight text-white">Stream Debrief</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-400/30">
                    <Gamepad2 size={11} /> Gaming
                  </span>
                  <span className="flex items-center gap-1 text-xs text-white/35">
                    <TrendingUp size={12} className="text-green-400" /> Building
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Score hero */}
                <div className="flex gap-5 items-center">
                  {/* Score ring */}
                  <div className="relative flex-shrink-0 w-28 h-28 flex items-center justify-center">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
                      <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                      <circle cx="48" cy="48" r="36" fill="none" stroke="#facc15" strokeWidth="4"
                        strokeDasharray="163 226" strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 8px #facc15)" }} />
                    </svg>
                    <div className="flex flex-col items-center">
                      <span className="text-4xl font-extrabold leading-none text-yellow-400">68</span>
                      <span className="text-[9px] text-white/30 font-medium">/100</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">
                      Volatile energy
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400">
                        Medium retention risk
                      </span>
                    </div>
                  </div>
                </div>

                {/* #1 Priority */}
                <div className="rounded-xl p-4 border border-white/8" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(255,255,255,0.02) 100%)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={13} style={{ color: "#a855f7" }} />
                    <span className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "#a855f7" }}>#1 Priority</span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/85 font-medium">
                    Your opening 20 minutes lost momentum — start your next stream mid-story, not mid-setup. Hook in the first 60 seconds or new viewers won&apos;t stay for the good part.
                  </p>
                </div>

                {/* What Worked */}
                <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-green-400">What Worked</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      { label: "Going Off", detail: "Reactions at 1:12 were genuine and unfiltered — that energy is what clips are made of." },
                      { label: "Chat Engagement", detail: "Strong callouts to regulars in the second hour kept momentum when the game slowed down." },
                    ].map((s) => (
                      <li key={s.label} className="text-sm text-white/65 flex gap-2">
                        <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400/70" />
                        <span><span className="font-bold text-white/90">{s.label}</span><span className="text-white/40"> — </span>{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Fix for Next Stream */}
                <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Fix for Next Stream</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      { label: "Cold Open", detail: "The first 20 minutes were too slow. Start with a story or take, not setup — new viewers decide in 60 seconds." },
                      { label: "Dead Air", detail: "22s silence at 47:15 broke the energy you built. Fill slow gameplay with hot takes or questions to chat." },
                    ].map((s) => (
                      <li key={s.label} className="text-sm text-white/65 flex gap-2">
                        <span className="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400/70" />
                        <span><span className="font-bold text-white/90">{s.label}</span><span className="text-white/40"> — </span>{s.detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Your Missions */}
                <div className="rounded-xl p-4 border" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0.02) 100%)", borderColor: "rgba(139,92,246,0.2)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a855f7" }}>Your Missions</span>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Open next stream mid-story — have your first sentence ready before going live",
                      "Respond to every new follower by name in the first hour",
                      "End with a clip-worthy moment, not a slow fade-out",
                    ].map((g, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 border text-[10px] font-extrabold" style={{ borderColor: "rgba(139,92,246,0.5)", color: "#a855f7", background: "rgba(139,92,246,0.15)" }}>
                          {i + 1}
                        </span>
                        <span className="text-white/65 leading-relaxed">{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Streamer Type Examples ─── */}
      <section className="py-24 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 glow-right pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6">
          <div className="flex justify-center mb-5">
            <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3.5 py-1 rounded-full">Adapts to you</span>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Your manager knows your stream type.
          </h2>
          <p className="text-center text-muted text-sm max-w-[480px] mx-auto mb-14 leading-relaxed">
            Gaming, just chatting, variety — LevlCast detects your style and tailors every piece of feedback, strategy, and recommendation to you.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Gaming */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold text-white/60">Stream Coach Report</span>
                <span className="text-xs text-purple-400 font-semibold">Building energy</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3.5 py-2.5">
                  <Gamepad2 size={14} className="text-purple-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-purple-400">Gaming Streamer</p>
                    <p className="text-[11px] text-muted">Coaching for gameplay commentary and hype moments.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 border-green-400/50 bg-green-400/5 flex-shrink-0">
                    <span className="text-lg font-extrabold text-green-400">81</span>
                    <span className="text-[9px] text-muted">/100</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">Strong hype moments and sharp callouts — your reactions at 1:12:04 are exactly what clips are made of.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 flex-shrink-0 mt-1" />
                    Genuine hype reactions — you don&apos;t fake excitement
                  </div>
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 flex-shrink-0 mt-1" />
                    Clear game narration keeps new viewers oriented
                  </div>
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 flex-shrink-0 mt-1" />
                    22s dead air at 47:15 — fill slow moments with commentary
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-accent-light mb-1">#1 Priority</p>
                  <p className="text-xs text-muted leading-relaxed">Your peak moments are genuinely clip-worthy. The gap is consistency — the slow stretches between kills lose the energy you built.</p>
                </div>
              </div>
            </div>

            {/* Just Chatting */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold text-white/60">Stream Coach Report</span>
                <span className="text-xs text-yellow-400 font-semibold">Volatile energy</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3.5 py-2.5">
                  <MessageCircle size={14} className="text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-400">Just Chatting</p>
                    <p className="text-[11px] text-muted">Coaching for conversational energy and viewer connection.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 border-yellow-400/50 bg-yellow-400/5 flex-shrink-0">
                    <span className="text-lg font-extrabold text-yellow-400">63</span>
                    <span className="text-[9px] text-muted">/100</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">Strong personality in bursts but long stretches without talking to chat made the middle hour feel like a solo stream.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 flex-shrink-0 mt-1" />
                    Hot takes land well — your opinion at 34:20 sparked real debate
                  </div>
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 flex-shrink-0 mt-1" />
                    Chat went unread for 8+ minutes twice — viewers feel ignored
                  </div>
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 flex-shrink-0 mt-1" />
                    Opening 15 minutes too slow — hook the audience immediately
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-accent-light mb-1">#1 Priority</p>
                  <p className="text-xs text-muted leading-relaxed">You have the personality. The problem is consistency — chat interaction has to be constant, not occasional, for a just chatting stream to retain viewers.</p>
                </div>
              </div>
            </div>

            {/* Variety */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <span className="text-xs font-bold text-white/60">Stream Coach Report</span>
                <span className="text-xs text-green-400 font-semibold">Building energy</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3.5 py-2.5">
                  <Shuffle size={14} className="text-orange-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-orange-400">Variety Streamer</p>
                    <p className="text-[11px] text-muted">Coaching for content flexibility and audience versatility.</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full border-2 border-green-400/50 bg-green-400/5 flex-shrink-0">
                    <span className="text-lg font-extrabold text-green-400">74</span>
                    <span className="text-[9px] text-muted">/100</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">Good energy across multiple games — transitions were smooth but the audience reset each time you switched content.</p>
                </div>
                <div className="space-y-1.5">
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 flex-shrink-0 mt-1" />
                    Comfortable across all content — personality stays consistent
                  </div>
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400/70 flex-shrink-0 mt-1" />
                    Funny moments spread evenly — not dependent on one game
                  </div>
                  <div className="flex gap-2 items-start text-xs text-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 flex-shrink-0 mt-1" />
                    Announce transitions to chat — switching games without warning loses context
                  </div>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
                  <p className="text-[11px] font-bold text-accent-light mb-1">#1 Priority</p>
                  <p className="text-xs text-muted leading-relaxed">Variety works when your personality is the constant. You have that — now make transitions feel intentional, not accidental.</p>
                </div>
              </div>
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
          <p className="text-lg font-bold mb-3">Built for streamers growing the honest way.</p>
          <p className="text-sm text-muted leading-relaxed">
            Growth stalls. No one tells you why. The market is full of shortcuts — view bots, fake chat, inflated numbers — that don&apos;t actually build an audience. LevlCast is the opposite of that: a real feedback loop for real streamers. The fixes are specific, the growth is yours, and the results compound.
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
