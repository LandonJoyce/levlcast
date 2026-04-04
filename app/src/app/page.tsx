import Link from "next/link";
import { Check, Play, Twitch, Brain, Scissors, TrendingUp, BarChart2, MessageSquare } from "lucide-react";
import NavBar from "@/components/NavBar";
import FaqSection from "@/components/FaqSection";

/* ─── How It Works steps ─── */
const steps = [
  {
    icon: Twitch,
    num: "01",
    label: "Connect Twitch",
    desc: "Sign in with Twitch. Your recent VODs sync automatically — no uploads, no manual work.",
    color: "text-[#9146FF]",
    bg: "bg-[#9146FF]/10",
    border: "border-[#9146FF]/20",
  },
  {
    icon: Brain,
    num: "02",
    label: "AI Analyzes Your Stream",
    desc: "LevlCast transcribes your VOD, detects peak moments by category, and scores your stream performance.",
    color: "text-accent-light",
    bg: "bg-accent/10",
    border: "border-accent/20",
  },
  {
    icon: Scissors,
    num: "03",
    label: "Generate Clips Instantly",
    desc: "One click turns any peak moment into a polished, ready-to-post clip with a caption written for you.",
    color: "text-cyan",
    bg: "bg-cyan/10",
    border: "border-cyan/20",
  },
  {
    icon: TrendingUp,
    num: "04",
    label: "Post and Grow",
    desc: "Post clips directly to YouTube from the dashboard. Reach beyond Twitch without extra effort.",
    color: "text-neon",
    bg: "bg-neon/10",
    border: "border-neon/20",
  },
];

/* ─── Pricing features ─── */
const freeFeatures = [
  "1 VOD analysis per month",
  "AI coaching report",
  "5 clips total",
  "YouTube posting",
];
const proFeatures = [
  "10 VOD analyses per month",
  "Full AI coach report every stream",
  "Unlimited clip generation",
  "YouTube auto-posting",
  "Growth analytics",
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
            Stop Guessing
            <br />
            <span className="text-gradient">Why You&apos;re Not Growing.</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-muted max-w-[520px] mx-auto mb-10 leading-relaxed">
            LevlCast watches your Twitch VODs, finds your best moments, generates clips, and tells you exactly what to do differently next stream.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
            <Link
              href="/auth/login"
              className="btn-accent w-full sm:w-auto text-base px-8 py-4 text-center"
            >
              Analyze Your First VOD Free
            </Link>
            <button
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 border border-border hover:border-accent/40 text-white/70 hover:text-white font-semibold px-8 py-4 rounded-xl transition-all text-base"
            >
              <Play className="w-4 h-4 fill-current" />
              Watch Demo
            </button>
          </div>
          <p className="text-xs text-muted">Free to start. No credit card required.</p>

          {/* Mock VOD timeline */}
          <div className="mt-16 max-w-2xl mx-auto">
            <div className="card-accent p-5 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-neon rounded-full" />
                  <span className="text-xs text-muted font-medium">VOD analysis complete</span>
                </div>
                <span className="text-xs font-bold text-neon">5 peaks found</span>
              </div>
              {/* Timeline bar */}
              <div className="relative h-8 bg-surface-2 rounded-lg overflow-hidden mb-3">
                <div className="absolute inset-0 flex">
                  <div className="flex-1 bg-surface-3 opacity-60" />
                </div>
                {/* Clip markers */}
                {[
                  { left: "12%", label: "Hype", color: "bg-accent" },
                  { left: "31%", label: "Funny", color: "bg-cyan" },
                  { left: "52%", label: "Clutch", color: "bg-neon" },
                  { left: "67%", label: "Funny", color: "bg-cyan" },
                  { left: "84%", label: "Hype", color: "bg-accent" },
                ].map((m, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 w-1 rounded-sm"
                    style={{ left: m.left }}
                  >
                    <div className={`w-full h-full ${m.color} opacity-80`} />
                    <div className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold whitespace-nowrap ${m.color.replace("bg-", "text-")}`}>
                      {m.label}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted">
                <span>0:00</span>
                <span>1:00:00</span>
                <span>2:00:00</span>
                <span>3:12:44</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pain points ─── */}
      <section className="py-20 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-4">
            Every streamer hits the same wall.
          </h2>
          <p className="text-center text-muted max-w-[480px] mx-auto mb-14 text-sm leading-relaxed">
            You&apos;re streaming consistently but not growing. You don&apos;t know which moments landed, what went wrong, or what to do next. That ends here.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: BarChart2,
                title: "No feedback loop",
                desc: "You stream, you end, you wonder why your viewer count didn't move. No one tells you what worked.",
              },
              {
                icon: Scissors,
                title: "Hours editing clips manually",
                desc: "You know clips drive growth but scrubbing through a 3-hour VOD to find the good moments takes forever.",
              },
              {
                icon: MessageSquare,
                title: "Generic advice doesn't cut it",
                desc: "\"Be consistent\" and \"engage your chat\" aren't coaching. You need feedback on your actual stream.",
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
            Stream once.
            <br />
            Grow everywhere.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="relative card p-6 hover:border-accent/25 transition-colors group">
                  {/* Connector line (desktop) */}
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

      {/* ─── Coaching Report Mockup ─── */}
      <section className="py-24 border-t border-border bg-surface/30">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[2px] uppercase text-accent-light mb-4">
            The Coaching Report
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Real feedback. Not generic advice.
          </h2>
          <p className="text-center text-muted text-sm max-w-[460px] mx-auto mb-14 leading-relaxed">
            After every analyzed stream you get a full breakdown — scored, honest, and specific to what actually happened in your VOD.
          </p>

          {/* Dashboard mockup frame */}
          <div className="max-w-[700px] mx-auto">
            {/* Window chrome */}
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

            {/* Report content */}
            <div className="bg-surface border-x border-b border-border rounded-b-2xl overflow-hidden shadow-glow-lg">
              {/* Header bar */}
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
                {/* Score + summary */}
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

                {/* What Worked / Improve */}
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

                {/* Coach's Take */}
                <div className="bg-surface-2 border border-border rounded-xl p-4">
                  <p className="text-[11px] font-bold text-accent-light uppercase tracking-widest mb-2">Coach&apos;s Take</p>
                  <p className="text-sm leading-relaxed">
                    Start your next stream with your best energy in the first 5 minutes. Your funniest moments come when you&apos;re reacting — not narrating. Lead with reaction, follow with commentary.
                  </p>
                </div>

                {/* Next stream goals */}
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

                {/* Clips ready */}
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <span className="text-xs text-muted">5 clips ready to export</span>
                  <button className="btn-accent text-xs px-4 py-2">Export All Clips →</button>
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
              <p className="text-muted text-sm mb-6">Try it on your first stream.</p>
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
              <p className="text-muted text-sm mb-6">For streamers serious about growing.</p>
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
          <p className="text-lg font-bold mb-3">Built by a streamer, for streamers.</p>
          <p className="text-sm text-muted leading-relaxed">
            LevlCast was built out of frustration with not knowing why growth stalled. The coaching report is the feature we always wished existed.
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
            Your next stream
            <br />
            <span className="text-gradient">deserves feedback.</span>
          </h2>
          <p className="text-muted text-sm mb-10 max-w-[400px] mx-auto leading-relaxed">
            Analyze your first VOD for free. No credit card. No setup. Just connect your Twitch and go.
          </p>
          <Link
            href="/auth/login"
            className="btn-accent inline-block px-10 py-4 text-base mb-4"
          >
            Get Started Free
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
                Built by a streamer, for streamers.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-muted mb-4">Product</p>
              <ul className="space-y-3 text-sm">
                <li><a href="#how-it-works" className="text-muted hover:text-white transition-colors">How It Works</a></li>
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
            <p className="text-xs text-muted">© 2026 LevlCast. All rights reserved.</p>
            <p className="text-xs text-muted">Built by a streamer, for streamers.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
