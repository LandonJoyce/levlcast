import type { Metadata } from "next";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { AnalyzeClient } from "./analyze-client";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "./analyze.css";

export const metadata: Metadata = {
  title: "Free Twitch VOD Analyzer, No Signup",
  description:
    "Paste any Twitch VOD link and get a free coaching report on how the stream opens: what's working, what's costing you viewers, and what to clip. No account needed.",
  alternates: { canonical: "/analyze" },
  openGraph: {
    title: "Get a free report on your last stream",
    description: "Paste a Twitch VOD link and read a real coaching report on it. No account needed.",
    url: "https://www.levlcast.com/analyze",
  },
};

/**
 * The no-account analyzer, and where outreach DMs and the homepage paste
 * box send people. It wears the homepage's header and footer so a visitor
 * from a DM lands on something that is obviously levlcast.com.
 *
 * The homepage hands the link over as ?url=. It's read here, not with
 * useSearchParams, so the page renders on the server with the form in it
 * instead of arriving blank and filling in after the JavaScript loads.
 */
export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { url } = await searchParams;

  return (
    <div className={`ll-page v3 az ${shoulders.variable}`}>
      <SiteHeader />
      <AnalyzeClient initialUrl={typeof url === "string" ? url : undefined} />
      <SiteFooter />
    </div>
  );
}
