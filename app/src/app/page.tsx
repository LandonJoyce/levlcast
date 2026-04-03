import Link from "next/link";
import { Zap, BarChart2, Scissors, MessageSquare, Check, Star } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight text-gradient">
            LevlCast
          </span>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm text-muted hover:text-white transition-colors hidden sm:block">
              Pricing
            </a>
            <Link
              href="/auth/login"
              className="bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-85 transition-opacity"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-44 pb-32 text-center overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[700px] glow-bg pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6 relative">
          <div className="inline-block bg-accent/10 border border-accent-light/30 text-accent-light text-xs font-semibold px-4 py-1.5 rounded-full mb-7 uppercase tracking-wider">
            Founding Member Pricing — Limited Spots
          </div>
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-[-3px] leading-[1.02] mb-6">
            Stop Guessing
            <br />
            Why You're Not Growing.
          </h1>
          <p className="text-lg text-muted max-w-[520px] mx-auto mb-10 leading-relaxed">
            LevlCast watches your Twitch VODs, finds your best moments, generates clips, and tells you exactly what to do differently next stream.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/auth/login"
              className="inline-block bg-accent text-white font-bold px-8 py-4 rounded-xl hover:opacity-88 transition-opacity text-base"
            >
              Analyze Your First VOD Free
            </Link>
          </div>
          <p className="text-xs text-muted mt-4">Free to start. No credit card required.</p>
        </div>
      </section>

      {/* Pain points */}
      <section className="py-20 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-center mb-4">
            Every streamer hits the same wall.
          </h2>
          <p className="text-center text-muted max-w-[480px] mx-auto mb-14 text-sm leading-relaxed">
            You're streaming consistently but not growing. You don't know which moments landed, what went wrong, or what to do next. That ends here.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <BarChart2 size={20} className="text-accent-light" />,
                title: "No feedback loop",
                desc: "You stream, you end, you wonder why your viewer count didn't move. No one tells you what worked.",
              },
              {
                icon: <Scissors size={20} className="text-accent-light" />,
                title: "Hours editing clips manually",
                desc: "You know clips drive growth but scrubbing through a 3-hour VOD to find the good moments takes forever.",
              },
              {
                icon: <MessageSquare size={20} className="text-accent-light" />,
                title: "Generic advice doesn't cut it",
                desc: "\"Be consistent\" and \"engage your chat\" aren't coaching. You need feedback on your actual stream.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-surface border border-border rounded-2xl p-6">
                <div className="mb-4">{item.icon}</div>
                <h3 className="font-bold mb-2">{item.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
            How it works
          </p>
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-1.5px] text-center mb-16 leading-tight">
            Stream once.
            <br />
            Grow everywhere.
          </h2>
          <div className="flex items-start justify-center gap-3 flex-wrap">
            {[
              {
                num: "01",
                label: "Connect Twitch",
                desc: "Sign in with Twitch. We sync your recent VODs automatically — no uploads needed.",
              },
              {
                num: "02",
                label: "AI Analyzes Your Stream",
                desc: "LevlCast finds your peak moments and generates a detailed coaching report on your stream performance.",
              },
              {
                num: "03",
                label: "Generate Clips Instantly",
                desc: "One click turns any peak moment into a ready-to-post clip with a caption written for you.",
              },
              {
                num: "04",
                label: "Post and Grow",
                desc: "Post clips to YouTube directly from the app. Watch your reach grow beyond Twitch.",
              },
            ].map((step, i) => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="text-center flex-1 min-w-[150px] max-w-[200px]">
                  <div className="text-xs font-bold tracking-wider text-accent-light/70 mb-4">
                    {step.num}
                  </div>
                  <div className="text-base font-bold mb-2">{step.label}</div>
                  <p className="text-[13px] text-muted leading-relaxed">{step.desc}</p>
                </div>
                {i < 3 && (
                  <span className="text-xl text-accent-light/50 pt-5 flex-shrink-0">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coach report preview */}
      <section className="py-24 border-t border-border bg-surface/30">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
            The coaching report
          </p>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Real feedback. Not generic advice.
          </h2>
          <p className="text-center text-muted text-sm max-w-[460px] mx-auto mb-14 leading-relaxed">
            After every analyzed stream you get a full breakdown — scored, honest, and specific to what actually happened in your VOD.
          </p>

          {/* Mock coach report card */}
          <div className="max-w-[640px] mx-auto bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-extrabold text-base tracking-tight">Stream Coach Report</h3>
              <span className="text-xs text-yellow-400 font-medium">Volatile energy</span>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex gap-5 items-start">
                <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-yellow-400/50 bg-bg flex-shrink-0">
                  <span className="text-2xl font-extrabold text-yellow-400">68</span>
                  <span className="text-xs text-muted">/100</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted leading-relaxed">
                    Solid mid-stream energy with strong funny moments but the opening 20 minutes were slow and would have lost a large portion of new viewers before they saw the best content.
                  </p>
                  <span className="text-xs text-yellow-400 font-medium mt-2 inline-block">Medium retention risk</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-green-400/5 border border-green-400/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">What Worked</p>
                  <ul className="space-y-1.5">
                    {["Natural humor that doesn't feel forced", "Strong reactions to in-game moments", "Good recovery after losing streaks"].map((s) => (
                      <li key={s} className="text-xs text-muted flex gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400/60 flex-shrink-0 mt-1.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider mb-2">Improve</p>
                  <ul className="space-y-1.5">
                    {["Cold open is too slow — hook viewers in the first 60 seconds", "Dead air around 45-minute mark lost momentum", "Chat interaction dropped off in the second hour"].map((s) => (
                      <li key={s} className="text-xs text-muted flex gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/60 flex-shrink-0 mt-1.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <p className="text-xs font-semibold text-accent-light uppercase tracking-wider mb-1.5">Coach's Take</p>
                <p className="text-sm">Start your next stream with your best energy in the first 5 minutes. Your funniest moments come when you're reacting — not narrating. Lead with reaction, follow with commentary.</p>
              </div>

              <div className="bg-accent/5 border border-accent/15 rounded-xl p-4">
                <p className="text-xs font-semibold text-accent-light uppercase tracking-wider mb-3">Next Stream Goals</p>
                <div className="space-y-2">
                  {["Open with a hot take or strong opinion in the first 2 minutes", "Set a chat interaction goal — respond to every new follower by name", "End the stream with a clip-worthy moment, not a fade-out"].map((g, i) => (
                    <div key={g} className="flex gap-2.5 text-sm">
                      <span className="w-4 h-4 rounded-full border border-accent/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-accent-light">{i + 1}</span>
                      </span>
                      {g}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">Pricing</p>
          <h2 className="text-4xl font-extrabold tracking-tight text-center mb-4">
            Simple, honest pricing.
          </h2>
          <p className="text-center text-muted text-sm mb-14">
            Start free. Upgrade when you're ready.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-[720px] mx-auto">
            {/* Free */}
            <div className="bg-surface border border-border rounded-2xl p-8">
              <h3 className="font-extrabold text-lg mb-1">Free</h3>
              <p className="text-muted text-sm mb-6">Try it on your first stream.</p>
              <div className="text-4xl font-extrabold mb-6">$0</div>
              <ul className="space-y-3 mb-8">
                {[
                  "1 VOD analysis per month",
                  "AI coach report",
                  "5 clips total",
                  "YouTube posting",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted">
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="block text-center border border-border text-white font-semibold py-3 rounded-xl hover:border-white/20 transition-colors text-sm"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-accent/10 border border-accent/40 rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-bold px-4 py-1 rounded-full">
                Founding Member Price
              </div>
              <h3 className="font-extrabold text-lg mb-1">Pro</h3>
              <p className="text-muted text-sm mb-6">For streamers serious about growing.</p>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-extrabold text-accent-light">$9.99</span>
                <span className="text-muted text-sm mb-1.5">/month</span>
              </div>
              <p className="text-xs text-muted mb-6">Price locks in for life. Increases to $14.99 soon.</p>
              <ul className="space-y-3 mb-8">
                {[
                  "10 VOD analyses per month",
                  "Full AI coach report every stream",
                  "Unlimited clip generation",
                  "YouTube auto-posting",
                  "Growth analytics",
                  "Priority processing",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check size={14} className="text-accent-light flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/login"
                className="block text-center bg-accent text-white font-bold py-3 rounded-xl hover:opacity-85 transition-opacity text-sm"
              >
                Get Pro — $9.99/mo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Social proof / trust */}
      <section className="py-20 border-t border-border bg-surface/20">
        <div className="max-w-[1080px] mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-1 mb-3">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={16} className="text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <p className="text-lg font-bold mb-2">Built by a streamer, for streamers.</p>
          <p className="text-sm text-muted max-w-[480px] mx-auto leading-relaxed">
            LevlCast was built out of frustration with not knowing why growth stalled. The coaching report is the feature we always wished existed.
          </p>

        </div>
      </section>

      {/* Final CTA */}
      <section className="py-28 border-t border-border text-center">
        <div className="max-w-[1080px] mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            Your next stream deserves feedback.
          </h2>
          <p className="text-muted text-sm mb-10 max-w-[400px] mx-auto leading-relaxed">
            Analyze your first VOD for free. No credit card. No setup. Just connect your Twitch and go.
          </p>
          <Link
            href="/auth/login"
            className="inline-block bg-accent text-white font-bold px-10 py-4 rounded-xl hover:opacity-85 transition-opacity text-base"
          >
            Get Started Free
          </Link>
          <p className="text-xs text-muted mt-4">Founding member price locks in at $9.99/mo forever.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <span className="text-xl font-extrabold text-gradient">LevlCast</span>
          <div className="flex items-center gap-6 text-sm text-muted">
            <a href="https://levlcast.com/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="https://levlcast.com/privacy" className="hover:text-white transition-colors">Privacy</a>
          </div>
          <p className="text-sm text-muted">© 2026 LevlCast. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
