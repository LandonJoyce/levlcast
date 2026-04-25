import Link from "next/link";

export default function Footer() {
  return (
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
              <li><Link href="/" className="text-muted hover:text-white transition-colors">Home</Link></li>
              <li><Link href="/twitch-vod-analyzer" className="text-muted hover:text-white transition-colors">VOD Analyzer</Link></li>
              <li><Link href="/twitch-clip-generator" className="text-muted hover:text-white transition-colors">Clip Generator</Link></li>
              <li><Link href="/twitch-stream-coach" className="text-muted hover:text-white transition-colors">Stream Coach</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-4">Learn</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/how-to-grow-on-twitch" className="text-muted hover:text-white transition-colors">How to Grow on Twitch</Link></li>
              <li><Link href="/#how-it-works" className="text-muted hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/#pricing" className="text-muted hover:text-white transition-colors">Pricing</Link></li>
              <li><Link href="/#faq" className="text-muted hover:text-white transition-colors">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted mb-4">Legal</p>
            <ul className="space-y-3 text-sm">
              <li><Link href="/terms" className="text-muted hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-muted hover:text-white transition-colors">Privacy Policy</Link></li>
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
  );
}
