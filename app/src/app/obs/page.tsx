import type { Metadata } from "next";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import AddToObsLink from "@/components/landing/AddToObsLink";
import { shoulders } from "../fonts";
import "../home-ranked.css";

const TITLE = "A coach inside OBS while you're live";
const LINE = "It coaches you while you're live, the way your report does after, and only you can see it.";

/**
 * The OBS panel on its own page, so a link to it (a post, a DM, a reply)
 * shows the panel in its preview instead of the homepage's rank card.
 * The preview pictures sit next to this file (opengraph-image.png and
 * twitter-image.png); the homepage's Live section says the same thing.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: `${LINE} Free to try.`,
  alternates: { canonical: "/obs" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/obs",
    title: TITLE,
    description: `${LINE} Free to try.`,
    siteName: "LevlCast",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: LINE,
  },
};

export default function ObsPage() {
  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />
      <main className="v3-sec">
        <h1 className="v3-h1">
          A coach inside OBS while you&rsquo;re live<span className="v3-punct">.</span>
        </h1>
        <p className="v3-sub">It coaches you while you&apos;re live, the way your report does after, and only you can see it.</p>
        <figure className="v3-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/live/levlcast-in-obs.webp"
            alt="OBS during a stream, with the LevlCast panel docked on the right showing a coaching tip, viewers and chat"
            width={1600}
            height={900}
            decoding="async"
          />
        </figure>
        <div className="v3-live-cta">
          <AddToObsLink className="v3-btn">Add it to OBS</AddToObsLink>
        </div>
        <ul className="v3-live-plans">
          <li>
            <b>Free</b> coaches the first 30 minutes of every stream.
          </li>
          <li>
            <b>Pro</b> coaches all of it, and listens to your stream to tell you what to do.
          </li>
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
