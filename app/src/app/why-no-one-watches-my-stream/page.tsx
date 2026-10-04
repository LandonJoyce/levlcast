import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "Why No One Watches Your Twitch Stream (and the Fix)",
  description:
    "The honest reasons a Twitch stream sits at zero to three viewers, and what fixes them: the first 30 seconds, dead air, talking to an empty chat and where you stream.",
  alternates: { canonical: "/why-no-one-watches-my-stream" },
  openGraph: {
    type: "article",
    url: "https://www.levlcast.com/why-no-one-watches-my-stream",
    title: "Why No One Watches Your Twitch Stream (and the Fix)",
    description: "The honest reasons a Twitch stream sits at zero to three viewers, and what fixes them.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Why no one watches your Twitch stream",
    description: "The honest reasons a stream sits at zero to three viewers, and what fixes them.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "How many viewers is normal for a new streamer?",
    a: "Zero to a handful, often for months. Almost everyone starts there. What matters is whether the people who do show up stay longer each month, because that's the number that grows into the next one.",
  },
  {
    q: "Is it my game?",
    a: "Sometimes. In the biggest categories a small stream sits so far down the list that almost nobody scrolls to it. A smaller game you also enjoy, where you'd show up near the top, gets you seen more often.",
  },
  {
    q: "Should I stream longer to get more viewers?",
    a: "Longer streams give you more chances to be found, but only if you're worth staying for the whole time. A focused three hours beats a tired eight, and it's the one you'll still be doing in six months.",
  },
  {
    q: "Do I need a better camera or overlay first?",
    a: "No. Clear audio matters, the rest barely does at this stage. People leave small streams because nothing is happening when they arrive, not because the overlay is plain.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Why No One Watches Your Twitch Stream (and What to Fix)",
    description:
      "The honest reasons a Twitch stream sits at zero to three viewers, and what fixes them: the first 30 seconds, dead air, talking to an empty chat and where you stream.",
    datePublished: "2026-10-04",
    dateModified: "2026-10-04",
    author: { "@type": "Organization", name: "LevlCast", url: "https://www.levlcast.com" },
    publisher: {
      "@type": "Organization",
      name: "LevlCast",
      logo: { "@type": "ImageObject", url: "https://www.levlcast.com/logo-mark.png" },
    },
    mainEntityOfPage: "https://www.levlcast.com/why-no-one-watches-my-stream",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

/** A guide for the search small streamers make on a bad night. Same layout as how-to-grow-on-twitch. */
export default function WhyNoOneWatchesPage() {
  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      {STRUCTURED_DATA.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <SiteHeader />

      <main className="gd">
        <header className="gd-head">
          <p className="v3-label">Guide</p>
          <h1 className="gd-h1">Why no one watches your stream</h1>
          <p className="gd-lede">
            If you&apos;re streaming to zero, one or two people, it&apos;s usually not your camera, your overlay or the
            algorithm. It&apos;s two things: very few people find you, and the few who do leave fast. Here&apos;s what&apos;s
            behind both, and what you can fix this week.
          </p>
          <p className="gd-date">Updated October 2026</p>
        </header>

        <article className="gd-body">
          <h2>1. Most people who find you leave within a minute</h2>
          <p>
            A stranger who clicks into a small stream gives it a few seconds, maybe half a minute. They&apos;re deciding
            whether anything is happening. If at that moment it&apos;s quiet, or you&apos;re staring at a menu, they&apos;re
            gone, and you never knew they were there.
          </p>
          <p>
            So assume someone new just arrived, every minute of the stream. Not to perform for them, just so there&apos;s
            always something going on when they land.
          </p>

          <h2>2. Dead air is the leak you don&apos;t notice</h2>
          <p>
            Silence feels normal to you because you&apos;re busy playing. To someone who just clicked in, thirty seconds
            of silence looks like nobody&apos;s home. It&apos;s one of the most common things holding small streams back, and the
            hardest one to notice from your side of the mic.
          </p>
          <p>
            The fix isn&apos;t being loud or funny. It&apos;s talking through what you&apos;re doing and why, and reacting
            out loud. We wrote a whole guide on{" "}
            <Link href="/what-to-say-on-stream">what to say when chat is quiet</Link>, with lines you can use tonight.
          </p>

          <h2>3. The start of the stream sets the tone</h2>
          <p>
            The first few minutes are when your notification goes out and your regulars show up. A fifteen minute
            starting-soon screen, or &ldquo;hold on, let me fix this real quick,&rdquo; loses the people who came on time.
            Here&apos;s <Link href="/how-to-start-a-stream">how to start a stream</Link> so they stay.
          </p>

          <h2>4. Saying &ldquo;chat&apos;s dead&rdquo; makes it true</h2>
          <p>
            Pointing out the empty chat, apologizing for the viewer count or saying nobody&apos;s here tells the person who
            just arrived that they walked into an empty room. Talk to the viewer who might be there instead: &ldquo;If you
            just got here, I&apos;m trying to beat this without healing and it&apos;s going badly.&rdquo;
          </p>

          <h2>5. You might be streaming where you can&apos;t be seen</h2>
          <p>
            In the biggest games a small stream sits below thousands of others, past where anyone scrolls. Look at the
            category you stream and find where a channel your size would land. If it&apos;s that far down, try a smaller
            game you also like, where you&apos;d be near the top of the list.
          </p>

          <h2>6. Almost nobody outside Twitch knows you exist</h2>
          <p>
            Twitch is bad at showing small channels to new people. YouTube Shorts and TikTok are much better at it. Your
            best moments, cut into short clips and posted every week, are how strangers find out you stream. A{" "}
            <Link href="/twitch-clip-generator">Twitch clip generator</Link> finds and cuts them for you.
          </p>

          <h2>What matters less than you think</h2>
          <ul className="gd-list">
            <li>
              <strong>Your overlay and webcam.</strong> Clear audio matters. The rest barely does until people are already
              staying.
            </li>
            <li>
              <strong>Streaming every single day.</strong> A schedule you can keep beats one you burn out from. See{" "}
              <Link href="/how-to-grow-on-twitch">how to grow on Twitch</Link>.
            </li>
            <li>
              <strong>Follow-for-follow and viewbots.</strong> They don&apos;t bring people who stay, and bots get you
              banned.
            </li>
          </ul>

          <h2>Find your own leaks</h2>
          <p>
            Every stream has different leaks, and you can&apos;t hear yours while you&apos;re live. Watch one VOD back: the
            first ten minutes, and one stretch where it felt slow. You&apos;ll hear it.
          </p>
          <p>
            Or let LevlCast do it. Type your Twitch name and it goes through the first 12 minutes of your latest stream
            for free, with no account: what&apos;s working, what&apos;s costing you viewers, and the moments worth clipping.
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
        <h2 className="v3-h2">Small stream questions</h2>
        <FaqAccordion items={FAQS} />
      </section>

      <SiteFooter />
    </div>
  );
}
