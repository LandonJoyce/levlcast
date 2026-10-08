import type { Metadata } from "next";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import AddToObsLink from "@/components/landing/AddToObsLink";
import ProPlan from "@/components/landing/ProPlan";
import FaqAccordion from "@/components/FaqAccordion";
import { shoulders } from "../fonts";
import "../home-ranked.css";
import "./obs.css";

const TITLE = "A coach inside OBS while you're live";
const LINE = "It coaches you while you're live, the way your report does after, and only you can see it.";

/**
 * The OBS panel's own page: where every post, DM and reply about it sends
 * people, so it carries the whole pitch on its own. What it catches (the
 * muted-mic clip, the hook people repeat back), the real setup in three
 * steps with an honest time, Free against Pro, and the questions people
 * ask first. The preview pictures sit next to this file
 * (opengraph-image.png and twitter-image.png).
 */
export const metadata: Metadata = {
  title: TITLE,
  description: `${LINE} Free to try.`,
  alternates: { canonical: "/obs" },
  openGraph: {
    type: "website",
    url: "https://www.levlcast.com/obs",
    title: TITLE,
    description: `${LINE} Free to try.`,
    siteName: "LevlCast",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: LINE,
  },
};

/** What the panel says, in the order it matters. Each is a nudge in lib/live/cues.ts. */
const CATCHES = [
  "Your mic is muted",
  "Your game is louder than your voice",
  "You've gone quiet",
  "You've been on your starting screen too long",
  "Someone new said hi, a raid came in, or someone clipped you",
];

const FAQ = [
  {
    q: "Can my viewers see it?",
    a: "No. It's a dock in OBS, not a source in your scenes, so it never shows up on stream.",
  },
  {
    q: "Do I have to connect OBS's WebSocket?",
    a: "No, but you should. Without it the panel still watches your chat and viewers. Connecting is what lets it hear when your mic is muted or quiet, and see which scene you're on.",
  },
  {
    q: "Is it AI?",
    a: "The nudges are simple rules that run in the panel. Pro's coach uses AI to listen to your stream and pick one useful thing to tell you.",
  },
  {
    q: "It disappeared after I restarted OBS.",
    a: "OBS keeps closed docks hidden. Click Docks and pick LevlCast to bring it back. Your link stays the same.",
  },
];

export default function ObsPage() {
  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />
      <main>
        <section className="v3-sec">
          <h1 className="v3-h1">
            A coach inside OBS while you&rsquo;re live<span className="v3-punct">.</span>
          </h1>
          <p className="v3-sub">{LINE}</p>
          <div className="v3-live-cta">
            <AddToObsLink className="v3-btn">Add it to OBS</AddToObsLink>
          </div>
          <p className="v3-fine">Free to start and takes about 3 minutes. Only you can see it, never your viewers.</p>
          <figure className="v3-shot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/live/levlcast-in-obs.webp"
              alt="OBS during a stream, with the LevlCast panel docked on the right showing a coaching tip, viewers and chat"
              width={1600}
              height={900}
              decoding="async"
            />
          </figure>
        </section>

        <section className="v3-sec obs-catches">
          <h2 className="v3-h2">It catches what you can&apos;t see from your side.</h2>
          <div className="obs-catch-row">
            <video
              className="obs-clip"
              src="/live/muted-mic.mp4"
              poster="/live/muted-mic-poster.webp"
              width={720}
              height={600}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="The LevlCast panel during a stream: the mic gets muted in OBS and the panel says Your mic is muted"
            />
            <ul className="obs-catch">
              {CATCHES.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="v3-sec">
          <h2 className="v3-h2">Set it up in about 3 minutes.</h2>
          <ol className="obs-steps">
            <li>
              <p className="v3-label">Step 1</p>
              <h3>Get your link</h3>
              <p>Sign in with Twitch and copy your private panel link.</p>
              <AddToObsLink className="v3-btn v3-btn-ghost">Get my link</AddToObsLink>
            </li>
            <li>
              <p className="v3-label">Step 2</p>
              <h3>Add it to OBS</h3>
              <p>In OBS, click Docks, then Custom Browser Docks. Name it LevlCast, paste the link and click Apply.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/live/obs-step-dialog.webp" alt="OBS's Custom Browser Docks window with the LevlCast link pasted in" loading="lazy" decoding="async" />
            </li>
            <li>
              <p className="v3-label">Step 3</p>
              <h3>Connect it</h3>
              <p>
                In OBS, open Tools, then WebSocket Server Settings. Turn it on, click Show Connect Info, copy the
                password and paste it into the panel.
              </p>
            </li>
          </ol>
          <p className="v3-fine obs-safe">
            It only reads from OBS and never changes anything. The password stays on your computer. Needs OBS 28 or newer.
          </p>
        </section>

        <section className="v3-sec">
          <h2 className="v3-h2">Free or Pro.</h2>
          <div className="v3-price">
            <div className="v3-plan">
              <p className="v3-plan-n">Free</p>
              <p className="v3-plan-p">$0</p>
              <p className="v3-plan-b">
                The panel coaches the first 30 minutes of every stream: muted mic, game too loud, going quiet, long
                starting screens, new chatters, raids and clips. Plus a free report every week.
              </p>
              <AddToObsLink className="v3-btn v3-btn-ghost">Add it to OBS</AddToObsLink>
            </div>
            <ProPlan
              blurb={
                <>
                  The panel coaches your whole stream, and a coach listens to it and tells you what to say, like a question
                  you missed or a play to talk chat through. Plus a report on every stream, twenty a month, and twenty
                  clips.
                </>
              }
            />
          </div>
        </section>

        <section className="v3-sec v3-faq">
          <div>
            <h2 className="v3-h2">The things people ask first.</h2>
            <p className="v3-faq-ask">
              Can&apos;t find yours? Email <a href="mailto:Landon@LevlCast.com">Landon@LevlCast.com</a>.
            </p>
          </div>
          <FaqAccordion items={FAQ} />
        </section>

        <section className="v3-close">
          <h2 className="v3-close-h">
            Try it on your next stream<span className="v3-punct">.</span>
          </h2>
          <div className="v3-live-cta">
            <AddToObsLink className="v3-btn">Add it to OBS</AddToObsLink>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
