import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "How to Start a Twitch Stream: The First 5 Minutes",
  description:
    "How to open a Twitch stream so people stay: keep the starting-soon screen short, say what the stream is in the first minute and get into it fast. An opening you can reuse.",
  alternates: { canonical: "/how-to-start-a-stream" },
  openGraph: {
    type: "article",
    url: "https://www.levlcast.com/how-to-start-a-stream",
    title: "How to Start a Twitch Stream: The First 5 Minutes",
    description: "Keep the starting-soon screen short, say what the stream is in the first minute, get into it fast.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to start a Twitch stream",
    description: "The first five minutes that keep viewers, and an opening you can reuse.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "How long should a starting-soon screen be?",
    a: "Two or three minutes. Long enough for the people who got your notification to arrive, short enough that they don't give up and leave.",
  },
  {
    q: "What should I say at the start of a stream?",
    a: "Hello, what tonight is, and where you left off last time. Three sentences, then start. \"Tonight we're finally beating the last boss, we got to phase two last stream, let's go.\"",
  },
  {
    q: "Should I start with just chatting?",
    a: "A few minutes of catching up is great for regulars. If you want new people to stay, don't make the warmup the whole first half hour. Get to the main thing soon.",
  },
  {
    q: "What if something breaks at the start?",
    a: "Fix it quickly and keep talking while you do. Better, test your audio, scenes and game capture before you go live, so the opening is the stream and not the setup.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Start a Twitch Stream: The First 5 Minutes That Keep Viewers",
    description:
      "How to open a Twitch stream so people stay: keep the starting-soon screen short, say what the stream is in the first minute and get into it fast.",
    datePublished: "2026-10-04",
    dateModified: "2026-10-04",
    author: { "@type": "Organization", name: "LevlCast", url: "https://www.levlcast.com" },
    publisher: {
      "@type": "Organization",
      name: "LevlCast",
      logo: { "@type": "ImageObject", url: "https://www.levlcast.com/logo-mark.png" },
    },
    mainEntityOfPage: "https://www.levlcast.com/how-to-start-a-stream",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

/** A guide for people searching how to start a stream. Same layout as how-to-grow-on-twitch. */
export default function HowToStartAStreamPage() {
  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      {STRUCTURED_DATA.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <SiteHeader />

      <main className="gd">
        <header className="gd-head">
          <p className="v3-label">Guide</p>
          <h1 className="gd-h1">How to start a stream: the first five minutes</h1>
          <p className="gd-lede">
            The first five minutes are when your notification goes out and your most loyal people show up. A lot of
            streams spend them on a long starting-soon screen and fixing settings. Here&apos;s an opening that keeps them
            instead.
          </p>
          <p className="gd-date">Updated October 2026</p>
        </header>

        <article className="gd-body">
          <h2>1. Keep the starting-soon screen short</h2>
          <p>
            Two or three minutes, not fifteen. The people who clicked your notification arrive in the first few minutes.
            If all they find is a looping screen and music, a lot of them won&apos;t be there when you are.
          </p>
          <p>
            We&apos;ve seen streams with barely a word said in the first twelve minutes. Cutting that down is the easiest
            win on this page.
          </p>

          <h2>2. Say what the stream is in the first minute</h2>
          <p>
            &ldquo;Tonight we&apos;re finally beating the last boss, five attempts max.&rdquo; One sentence with a goal gives
            people a reason to stay to see how it ends, and a reason to come back next time.
          </p>
          <p>
            Bonus points for connecting it to last stream: &ldquo;we got to phase two on Tuesday.&rdquo; Regulars feel like
            they&apos;re part of a story, and new people catch up in a sentence.
          </p>

          <h2>3. Fix your setup before you go live, not after</h2>
          <p>
            &ldquo;Hold on, let me fix this real quick&rdquo; is where openings go to die. Test your mic, scenes and game
            capture offline first. If something still breaks, fix it while you keep talking, so the stream doesn&apos;t
            stop.
          </p>

          <h2>4. Get into it within five minutes</h2>
          <p>
            Catch up with chat for a bit, then start the game or the main thing. Long just-chatting warmups are great for
            people who already know you, and confusing for anyone who doesn&apos;t yet.
          </p>

          <h2>5. Greet people by name, then keep going</h2>
          <p>
            Say hi to everyone who arrives, by name. It&apos;s one of the best things a small streamer can do. Just
            don&apos;t pause the stream to wait for them to answer.
          </p>

          <h2>An opening you can reuse</h2>
          <ul className="gd-list">
            <li>
              <strong>Two minutes of starting-soon screen.</strong> Enough for the notification crowd to arrive.
            </li>
            <li>
              <strong>Hello and what tonight is.</strong> One sentence with a goal.
            </li>
            <li>
              <strong>Where you left off.</strong> One sentence about last stream.
            </li>
            <li>
              <strong>Start.</strong> Then talk through it, which is a whole other guide:{" "}
              <Link href="/what-to-say-on-stream">what to say when chat is quiet</Link>.
            </li>
          </ul>

          <h2>See how your openings really go</h2>
          <p>
            It&apos;s hard to judge your own opening from memory. LevlCast&apos;s free check reads the first 12 minutes of
            your latest stream, which is your opening, and tells you what to fix first. No account needed. The full
            report also charts how much you talked each minute and marks the minute you got going.
          </p>
          <p className="gd-cta">
            <Link href="/analyze" className="v3-btn">
              Try it on your last stream
            </Link>
          </p>
        </article>
      </main>

      <section className="v3-sec" id="faq">
        <p className="v3-label">Questions</p>
        <h2 className="v3-h2">Starting a stream</h2>
        <FaqAccordion items={FAQS} />
      </section>

      <SiteFooter />
    </div>
  );
}
