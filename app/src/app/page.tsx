import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";
import ReferralLine from "@/components/landing/ReferralLine";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import ProPlan from "@/components/landing/ProPlan";
import CountUp from "@/components/landing/CountUp";
import AddToObsLink from "@/components/landing/AddToObsLink";
import { ArrowRight } from "lucide-react";
import { FAQ, FAQ_STRUCTURED_DATA } from "@/components/landing/faq";
import { TIER_HEX, TIERS, rankFromPoints } from "@/lib/rank";
import { createAdminClient } from "@/lib/supabase/server";
import { archivo, shoulders } from "./fonts";
import "./home-ranked.css";

/**
 * The proof strip's numbers, re-read once an hour.
 *
 * What made OpusClip's page read as a real company next to ours wasn't its
 * font (it uses the same one) but proof: real numbers, real people, real
 * product. These numbers are real and never rounded up; an indie tool's
 * credibility is that its numbers are true, and one big made-up figure is
 * exactly what reads as fake.
 */
export const revalidate = 3600;

interface SiteStats {
  streams: number;
  hours: number;
  streamers: number;
}

interface TopStreamer {
  name: string;
  avatar: string | null;
  points: number;
}

/**
 * The top five on the public leaderboard, for the homepage. Same query and
 * same fields as /leaderboard (name, picture, rank), so nothing shows here
 * that isn't already public there. This replaced a made-up league of
 * invented streamer names.
 */
async function getTopStreamers(): Promise<TopStreamer[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("twitch_login, twitch_display_name, twitch_avatar_url, rank_points")
      .not("rank_points", "is", null)
      .order("rank_points", { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return (
      data as Array<{
        twitch_login: string | null;
        twitch_display_name: string | null;
        twitch_avatar_url: string | null;
        rank_points: number | null;
      }>
    ).map((r) => ({
      name: r.twitch_display_name || r.twitch_login || "Streamer",
      avatar: r.twitch_avatar_url || null,
      points: r.rank_points ?? 0,
    }));
  } catch {
    return [];
  }
}

async function getSiteStats(): Promise<SiteStats | null> {
  try {
    const admin = createAdminClient();
    const [streamsRes, durationsRes, streamersRes] = await Promise.all([
      admin.from("vods").select("id", { count: "exact", head: true }).eq("status", "ready"),
      // PostgREST caps a read at 1000 rows, so past that this undercounts
      // hours rather than overstating them. Fine for now; an RPC sum later.
      admin.from("vods").select("duration_seconds").eq("status", "ready").limit(1000),
      admin.from("profiles").select("id", { count: "exact", head: true }).not("rank_points", "is", null),
    ]);
    if (streamsRes.error || durationsRes.error || streamersRes.error) return null;
    const seconds = ((durationsRes.data ?? []) as Array<{ duration_seconds: number | null }>).reduce(
      (sum, v) => sum + (v.duration_seconds ?? 0),
      0
    );
    return { streams: streamsRes.count ?? 0, hours: Math.round(seconds / 3600), streamers: streamersRes.count ?? 0 };
  } catch {
    // The page must render without its numbers rather than not at all.
    return null;
  }
}

/**
 * Homepage: the post-match design. Trialled at /v3 and promoted on
 * 2026-09-25; the previous homepage is kept at /v2 and the one before it
 * at /v1, so either can be compared or restored.
 *
 * The organising idea since 2026-10-06: the coach leads. The hero is the
 * panel that coaches you inside OBS while you're live (the user's call:
 * "this takes prio over ranking"), with the free report one button away
 * (/analyze), and the ranked game (match history, league, the ladder
 * drawn as a climb) follows further down. The report's own paste-box
 * section was cut as a repeat of that button. It was rank-first before, with a
 * promotion screen as the hero (RankUp).
 *
 * It keeps the rules the current homepage wrote down, because they were
 * right: left-aligned, rules and frames instead of cards, no atmospheric
 * glow, no gradient headline text, plain English. The orange gradient
 * is gone altogether now (the timeline was its last place); colour is kept
 * for game meaning, like gold for a promotion and green or red for a win or
 * a loss. What makes it look custom is the game-UI structure and a
 * condensed results typeface, not decoration.
 *
 * Every number on the page is one consistent sample stream: Silver I at
 * 1176 points, +34 to Gold IV at 1210, the same stream the timeline, the
 * stats and the top match history row describe.
 */

export const metadata: Metadata = {
  title: "LevlCast: Live Coaching for Twitch Streamers",
  description:
    "A coach inside OBS while you're live, and a report after every Twitch stream that tells you what to fix. Free to start.",
  alternates: { canonical: "/" },
};

/**
 * The kinds of stream the coaching adapts to. Each line is what the game
 * module in lib/analyze.ts actually tells the coach to look for, so this
 * stays true as long as those do.
 */
/** Each kind of stream, with the games people stream in it. Covers are Twitch's box art, saved in public/games. */
const KINDS: Array<{ k: string; v: string; games: Array<[name: string, slug: string]>; more?: string }> = [
  {
    k: "Competitive",
    v: "Rounds, respawns and drafts leave dead time. It coaches you to fill it and to make the ranked climb the story.",
    games: [
      ["VALORANT", "valorant"],
      ["Counter-Strike 2", "counter-strike"],
      ["League of Legends", "league-of-legends"],
      ["Fortnite", "fortnite"],
      ["Marvel Rivals", "marvel-rivals"],
    ],
  },
  {
    k: "Cozy and life sims",
    v: "Nothing's at stake on screen, so you're the show. It coaches the story, the build and the hangout.",
    games: [
      ["The Sims 4", "the-sims-4"],
      ["inZOI", "inzoi"],
      ["Stardew Valley", "stardew-valley"],
      ["Animal Crossing", "animal-crossing-new-horizons"],
      ["Minecraft", "minecraft"],
    ],
  },
  {
    k: "Horror",
    v: "Your real reactions are the content. It flags the stretches where you go quiet or play it too cool.",
    games: [
      ["Phasmophobia", "phasmophobia"],
      ["Dead by Daylight", "dead-by-daylight"],
      ["Lethal Company", "lethal-company"],
    ],
  },
  {
    k: "Everything else",
    v: "Just Chatting, variety, anything. Every stream gets notes on your talking, pacing, quiet stretches and chat.",
    games: [
      ["Just Chatting", "just-chatting"],
      ["Grand Theft Auto V", "grand-theft-auto-v"],
      ["IRL", "irl"],
      ["Art", "art"],
    ],
    more: "Any category",
  },
];

const MATCHES = [
  { r: "win", delta: "+34", tier: "Gold", rank: "Gold IV", title: "Hollow Knight Pantheon attempts", meta: "Sep 22 · 4h 11m", tag: "Promoted" },
  { r: "loss", delta: "−7", tier: "Silver", rank: "Silver I", title: "Valorant with viewers", meta: "Sep 19 · 2h 15m", tag: null },
  { r: "win", delta: "+41", tier: "Silver", rank: "Silver I", title: "Late night Just Chatting", meta: "Sep 16 · 3h 02m", tag: null },
  { r: "win", delta: "+52", tier: "Silver", rank: "Silver I", title: "Speedrun practice, any%", meta: "Sep 11 · 1h 48m", tag: "Division up" },
] as const;

function Emblem({ tier, className, size }: { tier: string; className?: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={`/ranks/${tier.toLowerCase()}.png`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
    />
  );
}

export default async function HomePage() {
  const [stats, top] = await Promise.all([getSiteStats(), getTopStreamers()]);

  return (
    <div className={`ll-page v3 ${shoulders.variable} ${archivo.variable}`}>
      <SiteHeader />

      {/* ── Hero: the coach inside OBS. id="live" so old links to /#live land here. ── */}
      <section className="v3-hero" id="live">
        <div className="v3-hero-copy">
          {/* Only renders for visitors who came through a partner link. */}
          <ReferralLine />
          <h1 className="v3-h1">
            Get better at streaming. <span className="v3-h1-soft">We coach you while you&apos;re live.</span>
          </h1>
          <div className="v3-live-cta">
            <AddToObsLink className="v3-btn">
              Add it to OBS <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </AddToObsLink>
            <Link href="/analyze" className="v3-btn v3-btn-ghost">
              Try a free report <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </Link>
          </div>
          <p className="v3-fine">Free to start, no card needed. Only you can see the panel, never your viewers.</p>
        </div>

        {/* Real pieces of the product, in a grid that runs off the edge. */}
        <div className="v3-mosaic">
          {/* A real stream (Landon's, TERA arena) with the panel's real clip nudge on top. */}
          <figure className="mz mz-stream">
            <video
              src="/live/stream-wide.mp4"
              poster="/live/stream-wide-poster.webp"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="A streamer mid-fight with their webcam on"
            />
            <span className="mz-live">
              <i aria-hidden="true" />
              Live
            </span>
            <span className="mz-nudges">
              <span className="mz-nudge" data-tone="good">
                <span className="mz-nudge-k">
                  <i aria-hidden="true" />
                  Now
                </span>
                <span className="mz-nudge-t">Someone clipped your stream</span>
                <span className="mz-nudge-a">Tell chat what happened there.</span>
              </span>
              <span className="mz-nudge" data-tone="nudge">
                <span className="mz-nudge-k">
                  <i aria-hidden="true" />
                  Now
                </span>
                <span className="mz-nudge-t">Your mic is muted</span>
                <span className="mz-nudge-a">Unmute it in OBS. Viewers can&apos;t hear you.</span>
              </span>
            </span>
          </figure>
          {/* The bottom of the panel, live: the numbers, the viewer line and what it caught earlier. */}
          <figure className="mz mz-stats" aria-label="The panel's live numbers: 27 viewers, 31 peak, 9 chatters, 6 new followers, and a raid and a new chatter it caught earlier">
            <dl className="mz-nums">
              <div><dd>27</dd><dt>Viewers</dt></div>
              <div><dd>31</dd><dt>Peak</dt></div>
              <div><dd>9</dd><dt>Chatters</dt></div>
              <div><dd>+6</dd><dt>Followers</dt></div>
            </dl>
            <svg className="mz-spark" viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
              <polyline points="0.0,27.1 8.7,25.8 17.4,25.8 26.1,23.0 34.8,24.4 43.5,21.7 52.2,19.0 60.9,20.3 69.6,17.6 78.3,16.3 87.0,13.6 95.7,14.9 104.3,12.3 113.0,9.5 121.7,4.1 130.4,6.8 139.1,8.2 147.8,9.5 156.5,9.5 165.2,8.2 173.9,9.5 182.6,10.9 191.3,9.5 200.0,9.5" />
            </svg>
            <p className="mz-status"><i aria-hidden="true" />Talking · Chat 11/min</p>
            <p className="mz-earlier-k">Earlier</p>
            <ul className="mz-earlier">
              <li><span>48:12</span>Raid from PixelHarbor with 18</li>
              <li><span>47:30</span>New chatter: quietfox_gg</li>
            </ul>
          </figure>
          <figure className="mz mz-clip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/live/panel-tall.webp"
              alt="The LevlCast panel live: rank, what to do now, tonight's fix and a coaching tip to answer a viewer's question"
              width={585}
              height={690}
              decoding="async"
            />
          </figure>
        </div>
      </section>

      {/* ── Proof: real numbers, live. Left out entirely if they can't load. ── */}
      {stats && (
        <section className="v3-proof" aria-label="LevlCast so far">
          <p className="v3-proof-live">Real numbers from our streamers</p>
          <dl className="v3-proof-list">
            <div>
              <dt>Streams analyzed</dt>
              <dd><CountUp target={stats.streams} /></dd>
            </div>
            <div>
              <dt>Hours of streams</dt>
              <dd><CountUp target={stats.hours} /></dd>
            </div>
            <div>
              <dt>Streamers coached</dt>
              <dd><CountUp target={stats.streamers} /></dd>
            </div>
          </dl>
        </section>
      )}

      {/* ── The panel in OBS, and what each plan coaches ── */}
      <section className="v3-sec" id="obs">
        <h2 className="v3-h2">It sits right next to your stream.</h2>
        <p className="v3-shot-cap">
          It coaches you while you&apos;re live, the way your report does after, and only you can see it. It uses your Twitch banner
          and picture, so it looks like yours.
        </p>
        <figure className="v3-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/live/levlcast-in-obs.webp"
            alt="OBS during a stream, with the LevlCast panel docked on the right showing a coaching tip, viewers and chat"
            width={1600}
            height={900}
            loading="lazy"
            decoding="async"
          />
        </figure>
        <ul className="v3-live-plans">
          <li>
            <b>Free</b> coaches the first 30 minutes of every stream.
          </li>
          <li>
            <b>Pro</b> coaches all of it, and listens to your stream to tell you what to do.
          </li>
        </ul>
      </section>

      {/* ── Clips ── (moved up here when the example breakdown was cut) */}
      <section className="v3-sec" id="clips">
        <h2 className="v3-h2">We clip your best moments for you.</h2>
        <p className="v3-shot-cap">Trim it, fix the captions, and post it to YouTube without leaving.</p>
        <figure className="v3-shot">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/la/clip-editor.png"
            alt="The LevlCast clip editor: trim sliders, an editable caption list, caption style picker, hook frame chooser, and format and destination options"
            width={1697}
            height={896}
            loading="lazy"
            decoding="async"
          />
        </figure>
      </section>

      {/* ── Coaching per kind of stream ── */}
      <section className="v3-sec" id="games">
        <h2 className="v3-h2">It knows what you&rsquo;re playing.</h2>
        <ul className="v3-kinds">
          {KINDS.map((kind) => (
            <li key={kind.k} className="v3-kind">
              <span className="v3-kind-art" aria-hidden="true">
                {kind.games.map(([name, slug], i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={slug}
                    src={`/games/${slug}.webp`}
                    alt=""
                    title={name}
                    width={144}
                    height={192}
                    loading="lazy"
                    decoding="async"
                    style={{ ["--i" as string]: i - (kind.games.length - 1) / 2 } as CSSProperties}
                  />
                ))}
              </span>
              <p className="v3-kind-k">{kind.k}</p>
              <p className="v3-kind-v">{kind.v}</p>
              <p className="v3-kind-g">{[...kind.games.map(([name]) => name), ...(kind.more ? [kind.more] : [])].join(" · ")}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Match history + league ── */}
      <section className="v3-sec v3-split" id="ranked">
        <div className="v3-col">
          <h2 className="v3-h2">
            Did you win or learn<span className="v3-punct">?</span>
          </h2>
          <ol className="v3-matches">
            {MATCHES.map((m) => (
              <li key={m.title} className="v3-match" data-r={m.r} style={{ ["--tier" as string]: TIER_HEX[m.tier] } as CSSProperties}>
                <span className="v3-match-delta">{m.delta}</span>
                <span className="v3-match-main">
                  <span className="v3-match-title">{m.title}</span>
                  <span className="v3-match-meta">
                    {m.r === "win" ? "Win" : "Loss"} · {m.meta}
                  </span>
                </span>
                <span className="v3-match-rank">
                  <Emblem tier={m.tier} className="v3-match-emb" size={256} />
                  <span className="v3-match-rank-t">
                    <span className="v3-match-rank-n">{m.rank}</span>
                    {m.tag && (
                      <span className="v3-match-tag">
                        <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
                          <path d="M5 2 L8.5 6.5 H1.5 Z" fill="currentColor" />
                        </svg>
                        {m.tag}
                      </span>
                    )}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Real streamers from the public leaderboard, not sample names. */}
        <div className="v3-col">
          <h2 className="v3-h2">
            Who&rsquo;s on top right now.
          </h2>
          {top.length > 0 && (
            <ol className="v3-league">
              {top.map((s, i) => {
                const rank = rankFromPoints(s.points);
                return (
                  <li key={`${s.name}-${i}`} className="v3-lg-row">
                    <span className="v3-lg-pos">{i + 1}</span>
                    {s.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="v3-lg-avatar" src={s.avatar} alt="" width={28} height={28} loading="lazy" />
                    ) : (
                      <span className="v3-lg-avatar" />
                    )}
                    <span className="v3-lg-name">{s.name}</span>
                    <Emblem tier={rank.tier} className="v3-lg-emb" size={256} />
                    <span className="v3-lg-rank" style={{ color: TIER_HEX[rank.tier] }}>{rank.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="v3-small">
            Every week you&apos;re also put in a league with the streamers nearest your rank, and the top three on
            Monday earn +20, +10 and +5 rank points. <Link href="/leaderboard">See the top 50</Link>
          </p>
        </div>
      </section>

      {/* ── The ladder, drawn as a climb ── */}
      <section className="v3-sec" id="ladder">
        <h2 className="v3-h2">
          Climb the Ranks<span className="v3-punct">!</span>
        </h2>
        <ol className="v3-ladder">
          {TIERS.map((t, i) => (
            <li
              key={t.name}
              className="v3-rung"
              data-you={t.name === "Gold" ? "yes" : undefined}
              style={{ ["--i" as string]: i, ["--tier" as string]: TIER_HEX[t.name] } as CSSProperties}
            >
              {t.name === "Gold" && <span className="v3-you">You</span>}
              <Emblem tier={t.name} className="v3-rung-emb" size={256} />
              <span className="v3-rung-name">{t.name}</span>
              <span className="v3-rung-floor">{t.floor.toLocaleString("en-US")}</span>
            </li>
          ))}
        </ol>
        <dl className="v3-rules">
          <div>
            <dt>You climb</dt>
            <dd>By beating your own last few streams. Not by being big.</dd>
          </div>
          <div>
            <dt>Bad night</dt>
            <dd>Costs you less than a good one earns. One bad stream never drops you a tier.</dd>
          </div>
          <div>
            <dt>Going up</dt>
            <dd>Gets harder the higher you are. Iron is quick. Grandmaster is not.</dd>
          </div>
          <div>
            <dt>Everyone sees it</dt>
            <dd>
              The <Link href="/leaderboard">top 50</Link> are public.
            </dd>
          </div>
        </dl>
      </section>

      {/* ── Price ── */}
      <section className="v3-sec" id="pricing">
        <div className="v3-price">
          <div className="v3-plan">
            <p className="v3-plan-n">Free</p>
            <p className="v3-plan-p">$0</p>
            <p className="v3-plan-b">
              Try it on any stream with no account. Sign in and you get a report every week and 6 clips a month, forever.
              Each one coaches the first 2 hours of a stream, and nothing in it is held back.
            </p>
            <Link href="/analyze" className="v3-btn v3-btn-ghost">Try it free</Link>
          </div>
          <ProPlan />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="v3-sec v3-faq" id="faq">
        <div>
          <h2 className="v3-h2">The things people ask first.</h2>
          <p className="v3-faq-ask">
            Can&apos;t find yours? Email <a href="mailto:Landon@LevlCast.com">Landon@LevlCast.com</a>.
          </p>
        </div>
        <FaqAccordion items={FAQ} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_STRUCTURED_DATA) }}
        />
      </section>

      {/* ── Closer ── */}
      <section className="v3-close">
        <h2 className="v3-close-h">
          Get coached on your next stream<span className="v3-punct">.</span>
          <br />
          <span className="v3-soft">
            It takes about 3 minutes to set up<span className="v3-punct">.</span>
          </span>
        </h2>
        <div className="v3-live-cta">
          <AddToObsLink className="v3-btn">
            Add it to OBS <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
          </AddToObsLink>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
