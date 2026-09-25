import Link from "next/link";
import { APP_STORE_URL } from "./site-links";

/**
 * A real person made this, so the footer says who. An anonymous, polished
 * product is the thing that reads as generated.
 *
 * Styled by home-ranked.css, so the page needs the `ll-page v3` wrapper.
 */
export default function SiteFooter() {
  return (
    <footer className="v3-foot">
      <div className="v3-foot-maker">
        <span className="v3-foot-mark">LevlCast</span>
        <p>
          Made by Landon, who streams at{" "}
          <a href="https://twitch.tv/orbitxd" target="_blank" rel="noopener noreferrer">
            twitch.tv/orbitxd
          </a>
          . Questions or ideas:{" "}
          <a href="mailto:Landon@LevlCast.com">Landon@LevlCast.com</a>
        </p>
      </div>
      <nav className="v3-foot-cols" aria-label="Footer">
        <div>
          <p className="v3-foot-h">Product</p>
          <Link href="/analyze">Analyze a stream</Link>
          <Link href="/leaderboard">Leaderboard</Link>
          <Link href="/#pricing">Pricing</Link>
        </div>
        <div>
          <p className="v3-foot-h">Get it</p>
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
            iPhone app
          </a>
          <Link href="/auth/login">Sign in</Link>
        </div>
        <div>
          <p className="v3-foot-h">Legal</p>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </nav>
    </footer>
  );
}
