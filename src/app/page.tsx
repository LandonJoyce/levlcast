import Link from "next/link";

/**
 * Public landing page — matches levlcast.com design.
 * This is a simplified version; the full marketing site
 * is served from the /upload folder on Cloudflare Pages.
 */
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bg">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border">
        <div className="max-w-[1080px] mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-extrabold tracking-tight text-gradient">
            LevlCast
          </span>
          <Link
            href="/auth/login"
            className="bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:opacity-85 transition-opacity"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-44 pb-32 text-center overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[700px] glow-bg pointer-events-none" />
        <div className="max-w-[1080px] mx-auto px-6 relative">
          <div className="inline-block bg-accent/10 border border-accent-light/30 text-accent-light text-xs font-semibold px-4 py-1.5 rounded-full mb-7 uppercase tracking-wider">
            Coming Soon
          </div>
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-[-3px] leading-[1.02] mb-6">
            LvL Up
            <br />
            Your Stream.
          </h1>
          <p className="text-lg text-muted max-w-[480px] mx-auto mb-10 leading-relaxed">
            AI-powered tools that turn your stream into clips, content, and a
            bigger audience — automatically.
          </p>
          <Link
            href="/auth/login"
            className="inline-block bg-accent text-white font-bold px-7 py-3.5 rounded-xl hover:opacity-88 transition-opacity"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* 4-step system */}
      <section className="py-28 border-t border-border">
        <div className="max-w-[1080px] mx-auto px-6">
          <p className="text-center text-xs font-bold tracking-[1.5px] uppercase text-accent-light mb-4">
            The system
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
                label: "You Stream",
                desc: "Go live on Twitch like you always do. Nothing changes on your end.",
              },
              {
                num: "02",
                label: "AI Clips It",
                desc: "LevlCast finds your best moments — hype, laughs, clutch plays — automatically.",
              },
              {
                num: "03",
                label: "Auto-Post",
                desc: "Clips go to TikTok, Reels, and Shorts with captions written for you.",
              },
              {
                num: "04",
                label: "You Grow",
                desc: "More eyes on your clips. More viewers on your stream. Repeat.",
              },
            ].map((step, i) => (
              <div key={step.num} className="flex items-start gap-3">
                <div className="text-center flex-1 min-w-[150px] max-w-[190px]">
                  <div className="text-xs font-bold tracking-wider text-accent-light/70 mb-4">
                    {step.num}
                  </div>
                  <div className="text-base font-bold mb-2">{step.label}</div>
                  <p className="text-[13px] text-muted leading-relaxed">
                    {step.desc}
                  </p>
                </div>
                {i < 3 && (
                  <span className="text-xl text-accent-light/50 pt-5 flex-shrink-0">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10">
        <div className="max-w-[1080px] mx-auto px-6 flex items-center justify-between">
          <span className="text-xl font-extrabold text-gradient">
            LevlCast
          </span>
          <p className="text-sm text-muted">
            © 2026 LevlCast. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
