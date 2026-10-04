import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "What to Say on Stream When Chat Is Quiet",
  description:
    "What to talk about on Twitch when nobody's chatting: narrate your decisions, call your shots, react out loud and talk to whoever just showed up. Lines you can use tonight.",
  alternates: { canonical: "/what-to-say-on-stream" },
  openGraph: {
    type: "article",
    url: "https://www.levlcast.com/what-to-say-on-stream",
    title: "What to Say on Stream When Chat Is Quiet",
    description: "Narrate your decisions, call your shots, react out loud. Lines you can use tonight.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "What to say on stream when chat is quiet",
    description: "Narrate your decisions, call your shots, react out loud. Lines you can use tonight.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "How much should I talk on stream?",
    a: "Enough that someone who just arrived never sits through a long silence. You don't need to talk nonstop. Short gaps are fine, long ones are where people leave.",
  },
  {
    q: "What if I'm naturally quiet?",
    a: "Narrating works well for quiet people because it isn't performing, it's explaining. Say what you're about to do and why, in your normal voice. That's enough.",
  },
  {
    q: "Is it weird to talk when nobody's watching?",
    a: "It feels weird for a while, then it doesn't. And somebody is usually watching: the VOD and your clips get seen even when the live chat is empty.",
  },
  {
    q: "Should I read every chat message out loud?",
    a: "Reading a message and answering it out loud is great, it lets everyone follow along. Just don't stop the stream to wait for chat to reply.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "What to Say on Stream When Chat Is Quiet",
    description:
      "What to talk about on Twitch when nobody's chatting: narrate your decisions, call your shots, react out loud and talk to whoever just showed up.",
    datePublished: "2026-10-04",
    dateModified: "2026-10-04",
    author: { "@type": "Organization", name: "LevlCast", url: "https://www.levlcast.com" },
    publisher: {
      "@type": "Organization",
      name: "LevlCast",
      logo: { "@type": "ImageObject", url: "https://www.levlcast.com/logo-mark.png" },
    },
    mainEntityOfPage: "https://www.levlcast.com/what-to-say-on-stream",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

/** A guide for the "what do I say when chat is quiet" search. Same layout as how-to-grow-on-twitch. */
export default function WhatToSayPage() {
  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      {STRUCTURED_DATA.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <SiteHeader />

      <main className="gd">
        <header className="gd-head">
          <p className="v3-label">Guide</p>
          <h1 className="gd-h1">What to say on stream when chat is quiet</h1>
          <p className="gd-lede">
            Talking to an empty chat feels strange, so most streamers go quiet. But the quiet is exactly what makes a new
            viewer leave. You don&apos;t need to be a comedian. You need a few habits that keep you talking, and here they
            are, with lines you can steal.
          </p>
          <p className="gd-date">Updated October 2026</p>
        </header>

        <article className="gd-body">
          <h2>1. Narrate your decisions, not your actions</h2>
          <p>
            &ldquo;I&apos;m going left&rdquo; is filler. &ldquo;I&apos;m going left because the right side has killed me three
            times tonight&rdquo; is content. People stay for the reasoning, because it lets them play along with you.
          </p>
          <p>
            Every time you make a choice, say why. Which gun, which route, which build, why you&apos;re waiting. It&apos;s the
            easiest habit on this list and the one that fills the most silence.
          </p>

          <h2>2. Call your shot before it happens</h2>
          <p>
            &ldquo;If I hit this, we win the round.&rdquo; Then you hit it, or you don&apos;t, and either way it&apos;s a moment.
            In one stream we looked at, the best moment of the night was a streamer calling a home run out loud right
            before the pitch and then hitting it. Without the call, it was just a home run.
          </p>
          <p>A called shot turns a normal play into a setup and a payoff. It&apos;s also what makes clips work.</p>

          <h2>3. React out loud</h2>
          <p>
            Your face does a lot of reacting that your mic never hears. When something happens, say it: &ldquo;No way,&rdquo;
            &ldquo;that was so close,&rdquo; &ldquo;okay I deserved that.&rdquo; Viewers feel the moment through you.
          </p>

          <h2>4. Talk to the person who just showed up</h2>
          <p>
            Every ten or fifteen minutes, catch up whoever might have just arrived: &ldquo;If you just got here, we&apos;re
            going for a no-hit run and I&apos;m already on my last life.&rdquo; It gives new people a reason to stay and
            costs you one sentence.
          </p>
          <p>
            What not to say: &ldquo;chat&apos;s dead,&rdquo; &ldquo;nobody&apos;s here,&rdquo; or sorry for the viewer count.
            The person who just arrived hears that they walked into an empty room.
          </p>

          <h2>5. Plan for the quiet parts</h2>
          <p>
            Streams go silent in the same places every time: loading screens, queues, deaths, menus, the end of a long
            session when you&apos;re tired. Have something ready for those:
          </p>
          <ul className="gd-list">
            <li>
              <strong>A question that&apos;s easy to answer.</strong> &ldquo;Which one would you pick?&rdquo; works better
              than &ldquo;how&apos;s everyone doing?&rdquo;
            </li>
            <li>
              <strong>Something from your day.</strong> A short story is fine, it doesn&apos;t have to be about the game.
            </li>
            <li>
              <strong>Your take.</strong> What you&apos;d change about the game, what you think of the update, the best and
              worst thing about it.
            </li>
          </ul>

          <h2>6. Go easy on yourself out loud</h2>
          <p>
            Saying &ldquo;I suck&rdquo; after every death is an easy habit to fall into. Once is relatable. Every few minutes, it drains the
            room. Swap it for a quick read on what happened: &ldquo;I got greedy there, should have backed off.&rdquo;
          </p>

          <h2>How to check yourself</h2>
          <p>
            Pick one VOD and skip to a stretch where you were deep in the game. Listen with your eyes closed for a minute.
            If you&apos;d leave, so would a new viewer.
          </p>
          <p>
            Or let LevlCast listen for you. The free check reads the first 12 minutes of your latest stream, quotes what
            you said that cost you viewers, and tells you the one thing to fix first. No account needed. The full report
            timestamps every quiet stretch.
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
        <h2 className="v3-h2">Talking on stream</h2>
        <FaqAccordion items={FAQS} />
      </section>

      <SiteFooter />
    </div>
  );
}
