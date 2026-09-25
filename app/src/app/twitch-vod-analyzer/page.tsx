import type { Metadata } from "next";
import SeoLanding from "@/components/landing/SeoLanding";
import ExampleReport from "@/components/landing/ExampleReport";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "Twitch VOD Analyzer: See What to Fix in Your Stream",
  description:
    "Paste a Twitch VOD and get a coaching report with timestamps: dead air, slow starts, what chat reacted to and the moments worth clipping. Free to try, no account needed.",
  alternates: { canonical: "/twitch-vod-analyzer" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/twitch-vod-analyzer",
    title: "Twitch VOD Analyzer: See What to Fix in Your Stream",
    description:
      "A report on your Twitch stream with timestamps: where it dragged, what landed with chat, and one thing to fix next time.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Twitch VOD Analyzer",
    description: "A report on your Twitch stream with timestamps, and one thing to fix next time.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "Does it work if my stream has loud game audio?",
    a: "Yes. The transcript is filtered down to your voice before anything is analyzed, so NPCs, music and other people in the call don't end up in your feedback.",
  },
  {
    q: "What does the analyzer actually check?",
    a: "What you said and where you went quiet, how the stream opens, where your energy rose and dropped, what chat reacted to, and which moments are worth clipping. Every note comes with a timestamp.",
  },
  {
    q: "Is it free?",
    a: "You can try it on the first 12 minutes of any stream without an account. Signed in, Free is two full reports and two clips every week with no card. Pro is $14.99 a month, or $149 a year, for 15 reports and 20 clips a month.",
  },
  {
    q: "How long does it take?",
    a: "About a minute for the free no-account report, and about five minutes for a full two hour stream.",
  },
  {
    q: "Do you keep my VODs?",
    a: "No. The audio is used while the report is made and then thrown away. Your report and any clips you make are what stay in your account.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LevlCast Twitch VOD Analyzer",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web, iOS",
    description:
      "Analyzes Twitch VODs and gives a coaching report with timestamps: dead air, slow starts, chat reactions and clip-worthy moments.",
    url: "https://www.levlcast.com/twitch-vod-analyzer",
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

export default function VodAnalyzerPage() {
  return (
    <SeoLanding
      className={shoulders.variable}
      label="Twitch VOD analyzer"
      title="A Twitch VOD analyzer that tells you what to fix"
      intro="Paste a link to a past broadcast. LevlCast listens to the stream, reads the chat replay alongside it, and gives you a report with timestamps: where it dragged, what landed, and the one thing to change next time."
      visual={<ExampleReport />}
      what={{
        label: "What it looks at",
        title: "It listens to the stream and reads the chat",
        rows: [
          { k: "Your voice", v: "The stream is transcribed and filtered to you, so game audio, music and your duo don't get mixed into the feedback." },
          { k: "Chat", v: "The chat replay is lined up with the stream, so the report knows when a joke actually landed and when chat went quiet." },
          { k: "Dead air", v: "Every quiet stretch long enough for a new viewer to leave, with the timestamp so you can go and watch it." },
          { k: "Your opening", v: "How long the stream takes to get going. The first few minutes decide whether someone who just clicked in stays." },
          { k: "Best moments", v: "Up to five moments worth clipping, each with a timestamp and a note on why it works." },
        ],
        note: "Every stream you analyze also moves you up or down a rank ladder, from Iron to Grandmaster.",
      }}
      how={{
        title: "From a link to a report in a few minutes",
        steps: [
          "Paste a VOD link here, or sign in with Twitch and pick one of your past broadcasts.",
          "Wait about a minute for the free report, or about five for a full two hour stream.",
          "Read it, clip what worked, and take the one fix into your next stream.",
        ],
      }}
      faq={{ title: "Questions about the VOD analyzer", items: FAQS }}
      related={[
        { href: "/twitch-clip-generator", title: "Clip generator", blurb: "Finds the moments worth posting and cuts them for you." },
        { href: "/twitch-stream-coach", title: "Stream coach", blurb: "One fix per stream, and a check next time on whether it worked." },
        { href: "/how-to-grow-on-twitch", title: "How to grow on Twitch", blurb: "Five things that actually help, and what to stop doing." },
      ]}
      closer="Try it on your last stream."
      structuredData={STRUCTURED_DATA}
    />
  );
}
