import Link from "next/link";

export const APP_STORE_URL = "https://apps.apple.com/us/app/levlcast/id6761281566";

export function AppleIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

/**
 * The bar across the top of the public pages: the homepage, /analyze and
 * shared reports. Someone arriving on /analyze from a DM should land on
 * the same site they'd see at levlcast.com, not a bare form.
 *
 * Styled by home-ranked.css, so the page needs the `ll-page v3` wrapper.
 */
export default function SiteHeader() {
  return (
    <header className="v3-bar">
      <Link href="/" className="v3-mark">LevlCast</Link>
      <nav className="v3-nav" aria-label="Main">
        <Link href="/#pricing" className="v3-nav-extra">Pricing</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <a className="v3-ios" href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
          <AppleIcon />
          iOS
        </a>
        <Link href="/auth/login" className="v3-signin">Sign in</Link>
      </nav>
    </header>
  );
}
