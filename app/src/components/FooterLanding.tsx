import Link from "next/link";

export default function FooterLanding() {
  return (
    <footer>
      <div className="container">
        <div className="foot">
          <div>
            <Link href="/" className="logo" style={{ marginBottom: 14 }}>
              <span className="logo-mark"></span>
              <span>LevlCast</span>
            </Link>
            <p style={{ maxWidth: 320, fontSize: 14, color: "var(--ink-3)", marginTop: 10 }}>
              Your personal stream manager. Real coaching on your actual stream.
            </p>
          </div>
          <div>
            <h5>Product</h5>
            <Link href="/twitch-vod-analyzer">VOD Analyzer</Link>
            <Link href="/twitch-clip-generator">Clip Generator</Link>
            <Link href="/twitch-stream-coach">Stream Coach</Link>
            <Link href="/changelog">Changelog</Link>
          </div>
          <div>
            <h5>Learn</h5>
            <Link href="/how-to-grow-on-twitch">How to Grow on Twitch</Link>
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div>
            <h5>Legal</h5>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a href="mailto:support@levlcast.com">support@levlcast.com</a>
          </div>
        </div>
        <div className="foot-bottom">
          <span>&copy; 2026 LevlCast. All rights reserved.</span>
          <span className="mono">Built for streamers</span>
        </div>
      </div>
    </footer>
  );
}
