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
  "Weekly manager digest",
  "Burnout monitoring",
];
const proFeatures = [
  "20 VOD analyses per month",
  "Full AI coach report every stream",
  "Unlimited clip generation",
  "Content performance analytics",
  "Collab matching",
  "Priority processing",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg text-white">
      <NavBar />

      {/* ─── Hero ─── */}
      <section className="relative pt-40 pb-24 overflow-hidden">
        {/* Grid + glow background */}
        <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] glow-bg-top pointer-events-none" />

        <div className="relative max-w-[1080px] mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 text-accent-light text-xs font-bold px-4 py-2 rounded-full mb-8 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            Founding Member Pricing — Limited Spots
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-[-3px] leading-[1.02] mb-6">
            Your Personal
            <br />
            <span className="text-gradient">Stream Manager.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-muted max-w-[560px] mx-auto mb-10 leading-relaxed">
            LevlCast manages your streaming career — coaching every stream, tracking your health, finding collabs, and telling you exactly what to focus on each week.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
            <Link
              href="/auth/login"
              className="btn-accent w-full sm:w-auto text-base px-8 py-4 text-center"
            >
              Get Your Manager Free
            </Link>
            <button
              disabled
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 border border-border text-white/30 font-semibold px-8 py-4 rounded-xl text-base cursor-not-allowed opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              Demo Coming Soon
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
      <section className="py-20 border-t border-border">
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
                title: "No feedback after you go live",
                desc: "You don't know if that stream was good, bad, or average. There's no scorecard, no review, no plan for next time.",
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
      <section className="py-24 border-t border-border" id="how-it-works">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[2px] uppercase text-accent-light mb-4">
            How It Works
          </p>
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
                  <div className="text-xs font-bold tracking-widest text-muted mb-2">{step.num}</div>
                  <h3 className="font-bold text-base mb-2">{step.label}</h3>
                  <p className="text-[13px] text-muted leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── What Your Manager Does ─── */}
      <section className="py-24 border-t border-border" id="features">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[2px] uppercase text-accent-light mb-4">
            Your Manager&apos;s Toolkit
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Everything a real manager would do.
          </h2>
          <p className="text-center text-muted text-sm max-w-[480px] mx-auto mb-14 leading-relaxed">
            LevlCast doesn&apos;t just analyze clips. It watches over your entire streaming career and tells you what to do about it.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {managerFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="card p-6 hover:border-accent/25 transition-colors group">
                  <div className={`w-10 h-10 ${feat.bg} border ${feat.border} rounded-xl flex items-center justify-center mb-5 group-hover:opacity-90 transition-opacity`}>
                    <Icon className={`w-5 h-5 ${feat.color}`} />
                  </div>
                  <h3 className="font-bold mb-2">{feat.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Coaching Report Mockup ─── */}
      <section className="py-24 border-t border-border bg-surface/30">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[2px] uppercase text-accent-light mb-4">
            The Coaching Report
          </p>
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
              <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-surface-2/50">
                <div>
                  <h3 className="font-bold text-sm">Stream Coach Report</h3>
                  <p className="text-xs text-muted mt-0.5">Saturday night stream · 3h 12m</p>
                </div>
                <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-3 py-1 rounded-full font-semibold">
                  Volatile energy
                </span>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex gap-5 items-start">
                  <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-yellow-400/50 bg-yellow-400/5 flex-shrink-0 shadow-[0_0_20px_rgba(250,204,21,0.15)]">
                    <span className="text-2xl font-extrabold text-yellow-400">68</span>
                    <span className="text-[10px] text-muted font-medium">/100</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted leading-relaxed">
                      Solid mid-stream energy with strong funny moments but the opening 20 minutes were slow and would have lost a large portion of new viewers before they saw the best content.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-[11px] bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2.5 py-1 rounded-full font-semibold">Medium retention risk</span>
                      <span className="text-[11px] bg-accent/10 text-accent-light border border-accent/20 px-2.5 py-1 rounded-full font-semibold">5 peak moments</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-neon/5 border border-neon/20 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-neon uppercase tracking-widest mb-3">What Worked</p>
                    <ul className="space-y-2">
                      {[
                        "Natural humor that doesn't feel forced",
                        "Strong reactions to in-game moments",
                        "Good recovery after losing streaks",
                      ].map((s) => (
                        <li key={s} className="text-xs text-muted flex gap-2 items-start">
                          <span className="w-1.5 h-1.5 rounded-full bg-neon/70 flex-shrink-0 mt-1" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-yellow-400 uppercase tracking-widest mb-3">Improve</p>
                    <ul className="space-y-2">
                      {[
                        "Cold open too slow — hook viewers in 60 seconds",
                        "Dead air around 45-minute mark lost momentum",
                        "Chat interaction dropped in the second hour",
                      ].map((s) => (
                        <li key={s} className="text-xs text-muted flex gap-2 items-start">
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/70 flex-shrink-0 mt-1" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-surface-2 border border-border rounded-xl p-4">
                  <p className="text-[11px] font-bold text-accent-light uppercase tracking-widest mb-2">Coach&apos;s Take</p>
                  <p className="text-sm leading-relaxed">
                    Start your next stream with your best energy in the first 5 minutes. Your funniest moments come when you&apos;re reacting — not narrating. Lead with reaction, follow with commentary.
                  </p>
                </div>

                <div className="bg-accent/5 border border-accent/20 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-accent-light uppercase tracking-widest mb-3">Next Stream Goals</p>
                  <div className="space-y-2.5">
                    {[
                      "Open with a hot take or strong opinion in the first 2 minutes",
                      "Set a chat interaction goal — respond to every new follower by name",
                      "End the stream with a clip-worthy moment, not a fade-out",
                    ].map((g, i) => (
                      <div key={g} className="flex gap-3 text-sm items-start">
                        <span className="w-5 h-5 rounded-full border border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold text-accent-light">
                          {i + 1}
                        </span>
                        <span className="text-muted leading-relaxed">{g}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Streamer Type Examples ─── */}
      <section className="py-24 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[2px] uppercase text-accent-light mb-4">
            Adapts To You
          </p>
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
                  <p className="text-[11px] font-bold text-accent-light mb-1">Coach&apos;s Take</p>
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
                  <p className="text-[11px] font-bold text-accent-light mb-1">Coach&apos;s Take</p>
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
                  <p className="text-[11px] font-bold text-accent-light mb-1">Coach&apos;s Take</p>
                  <p className="text-xs text-muted leading-relaxed">Variety works when your personality is the constant. You have that — now make transitions feel intentional, not accidental.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[2px] uppercase text-accent-light mb-4">Pricing</p>
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
                className="block text-center border border-border hover:border-accent/40 text-white font-semibold py-3 rounded-xl transition-all text-sm hover:text-white"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="relative bg-surface border border-accent/40 rounded-2xl p-8 flex flex-col shadow-glow">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-glow">
                Founding Member Price
              </div>
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
      </section>

      {/* ─── Built by a streamer ─── */}
      <section className="py-20 border-t border-border">
        <div className="max-w-[640px] mx-auto px-6 text-center">
          <p className="text-lg font-bold mb-3">Built by a streamer who needed a manager.</p>
          <p className="text-sm text-muted leading-relaxed">
            LevlCast exists because growth stalled and there was no one to ask why. No coach, no manager, no feedback loop. So we built one.
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
          <p className="text-muted text-sm mb-10 max-w-[400px] mx-auto leading-relaxed">
            Connect Twitch and get your first coaching report free. Your personal streaming manager starts working immediately.
          </p>
          <Link
            href="/auth/login"
            className="btn-accent inline-block px-10 py-4 text-base mb-4"
          >
            Get Your Manager Free
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
              <p className="text-xs font-bold tracking-widest uppercase text-muted mb-4">Product</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#how-it-works" className="text-muted hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#features" className="text-muted hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-muted hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#faq" className="text-muted hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-muted mb-4">Legal</p>
              <ul className="space-y-3 text-sm">
                <li><Link href="/terms" className="text-muted hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-muted hover:text-white transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-muted mb-4">Contact</p>
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
            <p className="text-xs text-muted">Your personal streaming manager.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
