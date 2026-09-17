import type { Metadata } from "next";
import { Suspense } from "react";
import { AnalyzeClient } from "./analyze-client";

export const metadata: Metadata = {
  title: "Free Twitch VOD Analyzer — No Signup",
  description:
    "Paste any Twitch VOD link and get a real coaching report on it. Dead air, weak openings, clippable moments. No account, no card.",
  alternates: { canonical: "/analyze" },
  openGraph: {
    title: "Analyze any Twitch stream free",
    description:
      "Paste a Twitch VOD link and read a real coaching report. No signup required.",
    url: "https://www.levlcast.com/analyze",
  },
};

export default function AnalyzePage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0A0C10" }}>
      <Suspense fallback={null}>
        <AnalyzeClient />
      </Suspense>
    </main>
  );
}
