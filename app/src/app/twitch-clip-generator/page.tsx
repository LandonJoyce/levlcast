import type { Metadata } from "next";
import Link from "next/link";
import SeoLanding from "@/components/landing/SeoLanding";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "AI Twitch Clip Generator: Auto-Cut Your Best VOD Moments",
  description:
    "LevlCast finds the best moments in your Twitch VODs and cuts them into clips with captions, ready to post. Free to try.",
  alternates: { canonical: "/twitch-clip-generator" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/twitch-clip-generator",
    title: "AI Twitch Clip Generator: Auto-Cut Your Best VOD Moments",
    description: "Finds the moments in your Twitch VODs worth posting and cuts them into clips with captions.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Twitch Clip Generator",
    description: "Finds the moments in your Twitch VODs worth posting and cuts them into clips with captions.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "How does it pick the moments?",
    a: "It listens to the stream and reads the chat replay alongside it, then picks the moments that work as a clip on their own: a hype play, a funny bit, a clutch, or something useful you said. You get up to five a stream, each with a timestamp and a note on why it works.",
  },
  {
    q: "Do I still have to edit the clips?",
    a: "Only if you want to. Clips come out 30 to 90 seconds long with captions. You can trim the start and end, fix caption words and change the caption style before you export.",
  },
  {
    q: "Can it post to YouTube Shorts?",
    a: "Yes, on Pro. Connect your YouTube channel once and post a clip straight from LevlCast. Pro also exports vertical 9:16 clips for Shorts and TikTok.",
  },
  {
    q: "How is it different from clipping by hand?",
    a: "Clipping by hand means finding the moment first, which is the part nobody has time for after a four hour stream. LevlCast finds them for you, and you decide which ones to make.",
  },
  {
    q: "What does it cost?",
    a: "Free is two full reports and two clips every week, with no card. Pro is $14.99 a month, or $149 a year, for 15 reports and 20 clips a month, vertical export and posting to YouTube.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LevlCast Twitch Clip Generator",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web, iOS",
    description: "Finds the best moments in Twitch VODs and cuts them into captioned clips ready to post.",
    url: "https://www.levlcast.com/twitch-clip-generator",
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

export default function ClipGeneratorPage() {
  return (
    <SeoLanding
      className={shoulders.variable}
      label="Twitch clip generator"
      title="A Twitch clip generator that finds the moments for you"
      intro="LevlCast goes through your VOD and picks the moments worth posting: the clutch play, the bit that made chat lose it, the thing you said that deserves its own video. You trim it, pick a caption style and post it."
      visual={
        <figure className="v3-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/la/clip-editor.png"
            alt="The LevlCast clip editor: trim sliders, an editable caption list, caption style picker, hook frame chooser, and format and destination options"
            width={1697}
            height={896}
          />
        </figure>
      }
      what={{
        label: "What it looks for",
        title: "The moments it picks",
        rows: [
          { k: "Hype", v: "The plays and reactions where chat blew up." },
          { k: "Funny", v: "Real laughs and the unscripted bits that make a channel feel like a person." },
          { k: "Clutch", v: "Last second saves and the wins worth bragging about." },
          { k: "Useful", v: "A tip or a take you dropped mid-stream that works on its own." },
        ],
        note: "Up to five a stream, each 30 to 90 seconds long, with the setup and the payoff kept in.",
      }}
      how={{
        title: "From a VOD to a clip you can post",
        steps: [
          "Sign in with Twitch and pick a stream. It gets analyzed and the moments worth clipping are listed.",
          "Open one in the editor. Trim it, fix the captions and choose how it looks.",
          "Download it. On Pro you can also export it vertical and post it to YouTube without leaving.",
        ],
      }}
      faq={{ title: "Questions about the clip generator", items: FAQS }}
      related={[
        { href: "/twitch-vod-analyzer", title: "VOD analyzer", blurb: "A report on your stream with timestamps and one thing to fix." },
        { href: "/twitch-stream-coach", title: "Stream coach", blurb: "One fix per stream, and a check next time on whether it worked." },
        { href: "/how-to-grow-on-twitch", title: "How to grow on Twitch", blurb: "Five things that actually help, and what to stop doing." },
      ]}
      closer="Find the clips in your last stream."
      fine={
        <>
          The free try lists clip-worthy moments from the first 12 minutes, no account needed.{" "}
          <Link href="/auth/login">Sign in</Link> to make the clips.
        </>
      }
      structuredData={STRUCTURED_DATA}
    />
  );
}
