import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";
import UrlPasteHero from "@/components/landing/UrlPasteHero";
import ReferralLine from "@/components/landing/ReferralLine";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import ProPlan from "@/components/landing/ProPlan";
import AddToObsLink from "@/components/landing/AddToObsLink";
import { Crosshair, Ghost, MessagesSquare, Sprout, type LucideIcon } from "lucide-react";
import { FAQ, FAQ_STRUCTURED_DATA } from "@/components/landing/faq";
import { TIER_HEX, TIERS, rankFromPoints } from "@/lib/rank";
import { createAdminClient } from "@/lib/supabase/server";
import { shoulders } from "./fonts";
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
 * "this takes prio over ranking"), the next section is the report after
 * every stream, and the ranked game (match history, league, the ladder
 * drawn as a climb) follows further down. It was rank-first before, with a
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
const KINDS: Array<{ k: string; v: string; games: string; icon: LucideIcon }> = [
  {
    k: "Competitive",
    v: "Rounds, respawns and drafts leave dead time. It coaches you to fill it and to make the ranked climb the story.",
    games: "VALORANT · CS2 · League · Fortnite · Marvel Rivals",
    icon: Crosshair,
  },
  {
    k: "Cozy and life sims",
    v: "Nothing's at stake on screen, so you're the show. It coaches the story, the build and the hangout.",
    games: "The Sims · inZOI · Stardew · Animal Crossing · Minecraft",
    icon: Sprout,
  },
  {
    k: "Horror",
    v: "Your real reactions are the content. It flags the stretches where you go quiet or play it too cool.",
    games: "Phasmophobia · Dead by Daylight",
    icon: Ghost,
  },
  {
    k: "Everything else",
    v: "Just Chatting, variety, anything. Every stream gets notes on your talking, pacing, dead air and chat.",
    games: "Any category",
    icon: MessagesSquare,
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
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />

      {/* ── Hero: the coach inside OBS. id="live" so old links to /#live land here. ── */}
      <section className="v3-hero" id="live">
        <div className="v3-hero-copy">
          {/* Only renders for visitors who came through a partner link. */}
          <ReferralLine />
          <h1 className="v3-h1">
            {/* The marks are set apart so they can be pulled in: at this weight
                and tracking the face leaves a gap before "." and "?". */}
            Coaching for
            <br />
            Twitch streamers<span className="v3-punct">.</span>
          </h1>
          <p className="v3-sub">We coach you live inside OBS, and after every stream we tell you what to fix.</p>
          <div className="v3-live-cta">
            <AddToObsLink className="v3-btn">Add it to OBS</AddToObsLink>
            <Link href="/analyze" className="v3-btn v3-btn-ghost">
              Try a free report
            </Link>
          </div>
          <p className="v3-fine">Free to start, no card needed. Only you can see the panel, never your viewers.</p>
        </div>

        <figure className="v3-hero-panel">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/live/levlcast-panel.webp"
            alt="The LevlCast panel in OBS during a stream: rank, a nudge, and a coaching tip telling the streamer to answer a question from chat"
            width={576}
            height={680}
            decoding="async"
          />
        </figure>
      </section>

      {/* ── Proof: real numbers, live. Left out entirely if they can't load. ── */}
      {stats && (
        <section className="v3-proof" aria-label="LevlCast so far">
          <dl className="v3-proof-list">
            <div>
              <dt>Streams analyzed</dt>
              <dd>{fmt(stats.streams)}</dd>
            </div>
            <div>
              <dt>Hours of streams</dt>
              <dd>{fmt(stats.hours)}</dd>
            </div>
            <div>
              <dt>Streamers coached</dt>
              <dd>{fmt(stats.streamers)}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* ── The panel in OBS, and what each plan coaches ── */}
      <section className="v3-sec" id="obs">
        <h2 className="v3-h2">It sits right next to your stream.</h2>
        <p className="v3-shot-cap">It coaches you while you&apos;re live, the way your report does after, and only you can see it.</p>
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

      {/* ── After the stream: the report, free on any stream ── */}
      <section className="v3-sec" id="report">
        <h2 className="v3-h2">After every stream, we tell you what to fix.</h2>
        <p className="v3-shot-cap">Type your Twitch name to see it on your last stream.</p>
        <div className="v3-paste">
          <UrlPasteHero hint={null} />
        </div>
        <p className="v3-fine">Try it free on the first 12 minutes of any stream. No account needed.</p>
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
          {KINDS.map((kind) => {
            const Icon = kind.icon;
            return (
              <li key={kind.k} className="v3-kind">
                <span className="v3-kind-ico" aria-hidden="true">
                  <Icon size={18} strokeWidth={1.8} />
                </span>
                <p className="v3-kind-k">{kind.k}</p>
                <p className="v3-kind-v">{kind.v}</p>
                <p className="v3-kind-g">{kind.games}</p>
              </li>
            );
          })}
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
                <span className="v3-match-res">
                  <span className="v3-match-word">{m.r === "win" ? "Win" : "Loss"}</span>
                  <span className="v3-match-delta">{m.delta}</span>
                </span>
                <span className="v3-match-main">
                  <span className="v3-match-title">{m.title}</span>
                  <span className="v3-match-meta">
                    {m.meta} · <span className="v3-match-rank">{m.rank}</span>
                  </span>
                </span>
                {m.tag && <span className="v3-match-tag">{m.tag}</span>}
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
            It takes about a minute to set up<span className="v3-punct">.</span>
          </span>
        </h2>
        <div className="v3-live-cta">
          <AddToObsLink className="v3-btn">Add it to OBS</AddToObsLink>
          <Link href="/analyze" className="v3-btn v3-btn-ghost">
            Try a free report
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
