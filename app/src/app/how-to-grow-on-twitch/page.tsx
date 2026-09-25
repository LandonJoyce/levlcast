import type { Metadata } from "next";
import Link from "next/link";
import FaqAccordion from "@/components/FaqAccordion";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "../seo.css";

export const metadata: Metadata = {
  title: "How to Grow on Twitch 2026: What Works and What Doesn't",
  description:
    "5 tactics that actually grow a Twitch channel in 2026, and the popular advice that wastes your time. No bots, no follow-for-follow, no schedule fluff.",
  alternates: { canonical: "/how-to-grow-on-twitch" },
  openGraph: {
    type: "article",
    url: "https://www.levlcast.com/how-to-grow-on-twitch",
    title: "How to Grow on Twitch 2026: What Works and What Doesn't",
    description: "5 tactics that actually grow a Twitch channel in 2026, and the popular advice that wastes your time.",
    siteName: "LevlCast",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Grow on Twitch 2026",
    description: "5 tactics that actually grow a Twitch channel in 2026. The honest version, with no bots or fluff.",
    images: ["/opengraph-image"],
  },
};

const FAQS = [
  {
    q: "How long does it realistically take to grow on Twitch?",
    a: "Affiliate (50 followers and 3 average viewers) is doable in 2 to 4 months of consistent streaming. Partner is a 1 to 3 year arc for most people who get there. If you're trying to go full-time in under a year without an existing audience, the odds are against you, and that's not a you problem, that's the math.",
  },
  {
    q: "Is it better to stream every day or on a schedule?",
    a: "A schedule you can keep beats daily streams you burn out from. Three predictable days a week is better than seven chaotic ones, because viewers come back to what they can plan around.",
  },
  {
    q: "Should I buy viewers or followers to kickstart growth?",
    a: "No. Twitch detects viewbotting and will ban you for it. Fake viewers also never subscribe, clip your stuff or tell their friends about you, so you end up with a bigger number and the same empty chat.",
  },
  {
    q: "Does streaming on weekends vs weekdays matter?",
    a: "Less than you'd think. Consistency matters more than timing. The streamer who goes live every Tuesday at 7pm for six months beats the one who chases the perfect slot and never shows up twice at the same time.",
  },
  {
    q: "What's the fastest way to find out what's holding my stream back?",
    a: "Get feedback on your actual VOD instead of generic advice. Most streamers plateau because they can't see their own blind spots, like dead air, a slow opening or missing chat. A stream coach or an honest friend watching one VOD will teach you more than 50 more broadcasts.",
  },
];

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "How to Grow on Twitch in 2026: The Honest Guide",
    description:
      "The honest version of how to grow on Twitch in 2026: the tactics that actually move the needle, and the popular ones that don't.",
    datePublished: "2026-04-24",
    dateModified: "2026-09-25",
    author: { "@type": "Organization", name: "LevlCast", url: "https://www.levlcast.com" },
    publisher: {
      "@type": "Organization",
      name: "LevlCast",
      logo: { "@type": "ImageObject", url: "https://www.levlcast.com/logo-mark.png" },
    },
    mainEntityOfPage: "https://www.levlcast.com/how-to-grow-on-twitch",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  },
];

/**
 * The growth guide, laid out as something to read: one column at a
 * comfortable measure, on the homepage's type. The advice is the same as
 * before; the sentences that had lost their dashes (and with them their
 * sense) are rewritten, and the pitch at the end matches what LevlCast
 * does now.
 */
export default function HowToGrowPage() {
  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      {STRUCTURED_DATA.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d) }} />
      ))}
      <SiteHeader />

      <main className="gd">
        <header className="gd-head">
          <p className="v3-label">Guide</p>
          <h1 className="gd-h1">How to grow on Twitch in 2026</h1>
          <p className="gd-lede">
            The honest version, with no bots and no follow-for-follow. Five things that actually move the needle, and
            the popular ones that don&apos;t, so you can stop spending time on them.
          </p>
          <p className="gd-date">Updated September 2026</p>
        </header>

        <article className="gd-body">
          <p>
            Most Twitch growth advice is either recycled from 2019 or written by people who&apos;ve never streamed. The
            reality in 2026 is that the algorithm won&apos;t save you, the raid train is mostly dead, and the streamers
            who are actually climbing are doing a handful of unglamorous things, consistently.
          </p>
          <p>Here&apos;s what those things are, in order of how much they matter.</p>

          <h2>1. Fix the things you can&rsquo;t see</h2>
          <p>
            You have blind spots on your own stream. Everyone does. You can&apos;t hear your own dead air because you
            were busy the whole time. You can&apos;t feel a weak opening because by the time it happens again next
            stream, you&apos;ve forgotten the last one. You miss chat because the game has your attention.
          </p>
          <p>
            The streamers who grow watch their VODs back and fix what they find. The ones who plateau never watch back
            because &ldquo;that was a rough one,&rdquo; and that&apos;s exactly the one to watch.
          </p>
          <p>
            If sitting through a three hour VOD isn&apos;t realistic, a{" "}
            <Link href="/twitch-vod-analyzer">Twitch VOD analyzer</Link> or a{" "}
            <Link href="/twitch-stream-coach">stream coach</Link> can find the moments that hurt you for you: dead air
            with timestamps, a slow opening, the stretch where chat went quiet. A few minutes of focused review beats
            three hours of rewatching.
          </p>

          <h2>2. Clip what worked, every stream</h2>
          <p>
            The biggest unforced error streamers make is having great moments and never turning them into anything.
            The moment sits in a VOD that expires in a couple of weeks, and nobody outside the three people watching
            ever sees it.
          </p>
          <p>
            YouTube Shorts and TikTok are where new viewers find streamers now, much more than the Twitch directory.
            Every hype moment, clutch play and funny reaction you don&apos;t clip is discovery you threw away.
          </p>
          <p>
            You don&apos;t need 50 clips a stream. You need three to five good ones, posted consistently, for months.
            That&apos;s how a small channel builds a path from Shorts to live. A{" "}
            <Link href="/twitch-clip-generator">Twitch clip generator</Link> takes away the &ldquo;I&apos;ll do it
            later&rdquo; friction that kills the habit.
          </p>

          <h2>3. Stream on a schedule you can actually keep</h2>
          <p>
            The advice is always to stream more. The honest version is to stream consistently. A viewer who knows
            you&apos;re live every Tuesday and Thursday at 7pm will plan around it. A viewer who has to check whether
            you&apos;re live today eventually stops checking.
          </p>
          <p>
            Three predictable streams a week beat seven chaotic ones, partly because the seven-a-week schedule burns
            you out in three months. Then you disappear for two, and your small audience finds someone else.
          </p>
          <p>
            Burnout is the biggest threat to growth, and you rarely notice it until you&apos;re in it. Watch your energy
            across streams. If it keeps dropping, you&apos;re not lazy, you&apos;re doing too much. Pull back before the
            break gets forced on you.
          </p>

          <h2>4. Use your own data instead of guessing</h2>
          <p>
            If you can&apos;t say which kind of content does best for you, you&apos;re leaving growth on the table. You
            have the data, you just haven&apos;t looked at it. Which streams had your best moments? What were you
            playing? What time was it, and how far into the stream?
          </p>
          <p>
            The pattern is usually there. Your best stuff is probably bunched into two or three kinds of content, at a
            certain point in the stream, when your energy is at a certain level. Lean into that.
          </p>
          <p>
            That doesn&apos;t mean dropping what you love streaming. It means noticing what lands and giving it more
            room: more airtime and more clips.
          </p>

          <h2>5. Show up like you&rsquo;re already bigger</h2>
          <p>
            This sounds vague, but it&apos;s specific. The streamer at 10 average viewers who opens like it&apos;s a
            real show, with a clean intro, their energy up and talking to the three people who are there, comes across
            like a 500 viewer channel having a slow day. People treat them that way, and they grow faster.
          </p>
          <p>
            The streamer at 10 viewers who waits for an audience before performing, makes the &ldquo;chat&apos;s dead
            today&rdquo; joke in the first minute and skips a proper opening because nobody&apos;s watching yet, stays
            at 10. The person who would have been their 11th viewer left in the first 20 seconds.
          </p>

          <h2>What doesn&rsquo;t work</h2>
          <ul className="gd-list">
            <li>
              <strong>Viewbots and follow-for-follow.</strong> Twitch detects them and bans you for them, and they
              don&apos;t produce real engagement anyway. Every hour spent on them is an hour taken from the work that
              actually grows a channel.
            </li>
            <li>
              <strong>Chasing trending games.</strong> Unless you&apos;re genuinely good at it or into it, you&apos;re
              competing with 10,000 streamers for the same spillover audience. It&apos;s better to be in the top 20 of a
              smaller category than the bottom 1,000 of the biggest one.
            </li>
            <li>
              <strong>Raid swaps with streamers nobody watches.</strong> Raiding back and forth doesn&apos;t bring new
              followers. The people in a raid have to like what they see when they land on your channel, which comes
              back to everything above.
            </li>
            <li>
              <strong>Asking for follows instead of earning them.</strong> &ldquo;Drop a follow if you&apos;re enjoying
              the stream&rdquo; is fine. Begging for follows in the middle of a clutch is not. People follow because
              they want to come back, so give them a reason first.
            </li>
          </ul>

          <h2>Where LevlCast fits</h2>
          <p>
            Doing all five consistently takes a system: watching VODs back, clipping highlights, keeping track of what
            landed, noticing when you&apos;re burning out.
          </p>
          <p>
            That&apos;s what LevlCast is for. It goes through your VODs, clips your best moments, gives you one thing
            to fix before your next stream, and ranks every stream on a ladder from Iron to Grandmaster so you can see
            yourself improve. Free is two full reports and two clips every week, so you can try it on your real
            streams first.
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
        <h2 className="v3-h2">Twitch growth questions</h2>
        <FaqAccordion items={FAQS} />
      </section>

      <SiteFooter />
    </div>
  );
}
