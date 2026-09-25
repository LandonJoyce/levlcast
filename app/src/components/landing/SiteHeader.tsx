import Link from "next/link";
import SiteNav from "./SiteNav";

/**
 * The bar across the top of the public pages: the homepage, /analyze,
 * shared reports, the search pages and the rest. Someone arriving on
 * /analyze from a DM should land on the same site they'd see at
 * levlcast.com, not a bare form.
 *
 * Styled by home-ranked.css, so the page needs the `ll-page v3` wrapper.
 * The links and the Product menu are in SiteNav, which runs in the browser.
 */
export default function SiteHeader() {
  return (
    <header className="v3-bar">
      <Link href="/" className="v3-mark">LevlCast</Link>
      <SiteNav />
    </header>
  );
}
