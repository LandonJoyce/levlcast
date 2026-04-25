import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border-soft py-14" style={{ background: "#06080F" }}>
      <div className="max-w-[1180px] mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-ink-cyan/10 border border-border-cyan flex items-center justify-center">
                <span className="font-mono font-bold text-ink-cyan text-sm">L</span>
              </div>
              <span className="text-lg font-extrabold tracking-tight">LevlCast</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">
              Built by streamers, for streamers. Score every stream. Climb the ladder.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-4">Tools</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/twitch-vod-analyzer" className="text-white/55 hover:text-white transition-colors">VOD Analyzer</Link></li>
              <li><Link href="/twitch-clip-generator" className="text-white/55 hover:text-white transition-colors">Clip Generator</Link></li>
              <li><Link href="/twitch-stream-coach" className="text-white/55 hover:text-white transition-colors">Stream Coach</Link></li>
              <li><Link href="/how-to-grow-on-twitch" className="text-white/55 hover:text-white transition-colors">How to Grow on Twitch</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-4">Product</p>
            <ul className="space-y-3 text-sm">
              <li><a href="/#how-it-works" className="text-white/55 hover:text-white transition-colors">How it works</a></li>
              <li><a href="/#features" className="text-white/55 hover:text-white transition-colors">Features</a></li>
              <li><a href="/#pricing" className="text-white/55 hover:text-white transition-colors">Pricing</a></li>
              <li><Link href="/changelog" className="text-white/55 hover:text-white transition-colors">Changelog</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-white/35 mb-4">Legal</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/terms" className="text-white/55 hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-white/55 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li>
                <a href="mailto:support@levlcast.com" className="text-white/55 hover:text-white transition-colors">
                  support@levlcast.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border-soft pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30">&copy; 2026 LevlCast · Built by streamers, for streamers</p>
          <p className="text-[10px] font-mono uppercase tracking-widest text-white/30">Score · Coach · Climb</p>
        </div>
      </div>
    </footer>
  );
}
