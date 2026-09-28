/**
 * The stream replay on an example stream, full screen with its own result
 * panel. Streamers see their own on each stream's report page. Not linked
 * from anywhere yet, and not indexed.
 */

import type { Metadata } from "next";
import SiteHeader from "@/components/landing/SiteHeader";
import StreamReplay from "@/components/replay/StreamReplay";
import { EXAMPLE_REPLAY } from "@/components/replay/replay-data";
import { shoulders } from "../fonts";
import "../home-ranked.css";

export const metadata: Metadata = {
  title: "Stream replay",
  robots: { index: false, follow: false },
};

export default function ReplayPage() {
  return (
    <div className={`ll-page v3 rpl-page ${shoulders.variable}`}>
      <SiteHeader />
      <StreamReplay data={EXAMPLE_REPLAY} example />
    </div>
  );
}
