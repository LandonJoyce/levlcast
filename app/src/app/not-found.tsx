import Link from "next/link";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import "./home-ranked.css";

/**
 * 404. Most people who follow a dead link aren't signed in, so this wears
 * the public header and footer and points home first. The old page only
 * offered "Go to Dashboard", which sent them to a login wall.
 */
export default function NotFound() {
  return (
    <div className="ll-page v3">
      <SiteHeader />
      <main className="v3-sec">
        <p className="v3-label">404</p>
        <h1 className="v3-h1">This page doesn&rsquo;t exist</h1>
        <p className="v3-sub">It might have moved, or the link has a typo in it.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" className="v3-btn">
            Go to the homepage
          </Link>
          <Link href="/dashboard" className="v3-btn v3-btn-ghost">
            Your dashboard
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
