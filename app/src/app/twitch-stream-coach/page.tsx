import type { Metadata } from "next";
import SeoLanding from "@/components/landing/SeoLanding";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "AI Twitch Stream Coach: Feedback After Every Stream",
  description:
    "An AI stream coach that goes through your Twitch VODs, tells you the one thing to fix before your next stream, and checks whether you fixed it. Free to try.",
  alternates: { canonical: "/twitch-stream-coach" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/twitch-stream-coach",
    title: "AI Twitch Stream Coach: Feedback After Every Stream",
    description: "One thing to fix before your next stream, with timestamps, and a check next time on whether you fixed it.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Twitch Stream Coach",
    description: "One thing to fix before your next stream, and a check next time on whether you fixed it.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "How is this different from a human coach?",
    a: "A good human coach is worth it, but they can't sit through every stream you do. LevlCast can, and it compares each stream to your own recent ones, so it notices whether things are getting better. Plenty of people use both.",
  },
  {
    q: "How does it know what to tell me?",
    a: "It transcribes the stream, filters it to your voice, lines it up with the chat replay, and looks at your pacing, quiet stretches, energy and what chat reacted to. The feedback quotes what you actually said and points at the minute it happened.",
  },
  {
    q: "Is the feedback specific, or generic tips?",
    a: "Specific to that stream. If a report ever tells you to be more engaging with nothing behind it, email Landon@LevlCast.com, because that's a bug.",
  },
  {
    q: "How often should I use it?",
    a: "After every stream you want to get better at. Free covers two full reports a week. Pro covers 15 a month for people who stream more than that.",
  },
  {
    q: "Can other people see my feedback?",
    a: "No, your reports are private. If you're in a weekly league, other streamers see your name, rank and weekly points, never your reports or scores. You can leave leagues any time in Account.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LevlCast AI Stream Coach",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web, iOS",
    description:
      "Goes through Twitch VODs and gives one specific thing to fix before the next stream, with timestamps, then checks whether it was fixed.",
    url: "https://www.levlcast.com/twitch-stream-coach",
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
      { "@type": "Offer", name: "Pro", price: "14.99", priceCurrency: "USD" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

/** Two streams in a row, the loop the coach is built around. Made-up data. */
function TwoStreams() {
  return (
    <aside className="v3-frame xr" aria-label="Example: feedback across two streams">
      <div className="v3-result-top">
        <span>Your last two streams</span>
      </div>
      <div className="xr-row">
        <p className="xr-k">Last stream&apos;s fix</p>
        <p className="xr-text">Talk through the quiet parts.</p>
      </div>
      <div className="xr-row">
        <p className="xr-k">This stream</p>
        <p className="xr-text">
          <span className="xr-good">Fixed.</span> Dead air went from 17 minutes to 6.
        </p>
      </div>
      <div className="xr-row">
        <p className="xr-k">Next fix</p>
        <p className="xr-text">Say what the stream is in the first minute.</p>
      </div>
      <div className="xr-row">
        <p className="xr-k">Rank</p>
        <p className="xr-text">
          Silver I to Gold IV <span className="xr-good">+34</span>
        </p>
      </div>
    </aside>
  );
}

export default function StreamCoachPage() {
  return (
    <SeoLanding
      className={shoulders.variable}
      label="Twitch stream coach"
      title="A stream coach that watches every stream"
      intro="LevlCast goes through every stream you run it on, tells you the one thing to fix next time, and checks in the next report whether you did. Every note points at a moment in your VOD."
      visual={<TwoStreams />}
      what={{
        label: "What's in a report",
        title: "What the coach tells you",
        rows: [
          { k: "One fix", v: "The one thing to change next stream, picked because it's costing you the most right now." },
          { k: "Whether you fixed it", v: "The next report checks last stream's fix and tells you if it got better." },
          { k: "What cost you viewers", v: "Dead air, slow starts and the habits behind them, with timestamps, next to what worked and is worth doing again." },
          { k: "Notes for your game", v: "The coaching changes with what you play, so a shooter stream and a cozy sim stream get different notes." },
          { k: "Your rank", v: "Every stream moves you up or down a ladder from Iron to Grandmaster, based on how it went against your own recent streams." },
        ],
      }}
      how={{
        title: "How the coaching works",
        steps: [
          "Sign in with Twitch. Your latest stream gets analyzed right away.",
          "Read the report. Every note links to the moment in your VOD.",
          "Stream, analyze again, and see whether the fix stuck and where it moved your rank.",
        ],
      }}
      faq={{ title: "Questions about the stream coach", items: FAQS }}
      related={[
        { href: "/twitch-vod-analyzer", title: "VOD analyzer", blurb: "A report on your stream with timestamps and one thing to fix." },
        { href: "/twitch-clip-generator", title: "Clip generator", blurb: "Finds the moments worth posting and cuts them for you." },
        { href: "/how-to-grow-on-twitch", title: "How to grow on Twitch", blurb: "Five things that actually help, and what to stop doing." },
      ]}
      closer="See what the coach says about your last stream."
      structuredData={STRUCTURED_DATA}
    />
  );
}
