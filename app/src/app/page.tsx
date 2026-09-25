import Link from "next/link";
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import FaqAccordion from "@/components/FaqAccordion";
import UrlPasteHero from "@/components/landing/UrlPasteHero";
import ReferralLine from "@/components/landing/ReferralLine";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { FAQ, FAQ_STRUCTURED_DATA } from "@/components/landing/faq";
import { TIER_HEX, TIERS } from "@/lib/rank";
import { createAdminClient } from "@/lib/supabase/server";
import { changelog } from "@/lib/changelog";
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

/** Changelog is newest first; the last entry is where the history starts. */
const LATEST_UPDATE = changelog[0];
const UPDATES_SINCE = new Date(`${changelog[changelog.length - 1].date}T12:00:00Z`).toLocaleDateString("en-US", {
  month: "long",
  timeZone: "UTC",
});

/**
 * Homepage: the post-match design. Trialled at /v3 and promoted on
 * 2026-09-25; the previous homepage is kept at /v2 and the one before it
 * at /v1, so either can be compared or restored.
 *
 * The organising idea: every stream is a ranked match, so the homepage is
 * the screen you see after one. The hero is a result (a promotion, the
 * points, the bar filling), the proof is a scoreboard, a match history and
 * a league table, and the ladder is drawn as a literal climb. The product
 * turned into a ranked game this month; the page now looks like one.
 *
 * It keeps the rules the current homepage wrote down, because they were
 * right: left-aligned, rules and frames instead of cards, no atmospheric
 * glow, no gradient headline text, the accent gradient spent in one place
 * (the match timeline), plain English. What makes it look custom is the
 * game-UI structure and a condensed results typeface, not decoration.
 *
 * Every number on the page is one consistent sample stream: Silver I at
 * 1176 points, +34 to Gold IV at 1210, the same stream the timeline, the
 * stats and the top match history row describe.
 */

// Title kept from the previous homepage so search listings don't churn
// with the redesign; the description now mentions the rank.
export const metadata: Metadata = {
  title: "LevlCast - Your Personal Streaming Manager",
  description:
    "A coaching report on every Twitch stream: slow starts, dead air, the moments worth clipping, and a rank from Iron to Grandmaster. Try it free on any stream, no account needed.",
  alternates: { canonical: "/" },
};

/** Marks on the match timeline. Percentages are positions across the stream. */
const MARKS = [
  { at: 4, label: "Slow start", tone: "warn" },
  { at: 41, label: "Best moment", tone: "good" },
  { at: 58, label: "Quiet stretch", tone: "bad" },
  { at: 86, label: "Energy dropped", tone: "warn" },
] as const;

// Plain statements, the way a friend would say them. The first draft's
// notes ("and you never clipped it", "cut and ready to post") had the
// neat, slightly dramatic rhythm that reads as generated.
const STATS = [
  { k: "Slow start", v: "8:12", note: "before things picked up", tone: "warn" },
  { k: "Best moment", v: "1:42:10", note: "you didn't clip this one", tone: "good" },
  { k: "Dead air", v: "17 min", note: "mostly in the third hour", tone: "bad" },
  { k: "Clips", v: "6", note: "ready to post", tone: "plain" },
] as const;

const MATCHES = [
  { r: "win", delta: "+34", tier: "Gold", rank: "Gold IV", title: "Hollow Knight Pantheon attempts", meta: "Sep 22 · 4h 11m", tag: "Promoted" },
  { r: "loss", delta: "−7", tier: "Silver", rank: "Silver I", title: "Valorant with viewers", meta: "Sep 19 · 2h 15m", tag: null },
  { r: "win", delta: "+41", tier: "Silver", rank: "Silver I", title: "Late night Just Chatting", meta: "Sep 16 · 3h 02m", tag: null },
  { r: "win", delta: "+52", tier: "Silver", rank: "Silver I", title: "Speedrun practice, any%", meta: "Sep 11 · 1h 48m", tag: "Division up" },
] as const;

const LEAGUE = [
  { name: "NovaPlays", tier: "Gold", rank: "Gold III", pts: "+64", prize: "+20" },
  { name: "You", tier: "Gold", rank: "Gold IV", pts: "+34", prize: "+10", you: true },
  { name: "kiwi_tv", tier: "Silver", rank: "Silver I", pts: "+33", prize: "+5" },
  { name: "DeadAirDan", tier: "Bronze", rank: "Bronze I", pts: "+12", prize: null },
  { name: "LoreGoblin", tier: "Bronze", rank: "Bronze II", pts: "−6", prize: null },
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
  const stats = await getSiteStats();
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />

      {/* ── Hero: the result screen ── */}
      <section className="v3-hero">
        <div className="v3-hero-copy">
          {/* Only renders for visitors who came through a partner link. */}
          <ReferralLine />
          {/* The latest real update, straight from the changelog. A product
              that shipped something this week reads as looked after. */}
          <Link href="/changelog" className="v3-new">
            <span className="v3-new-tag">New</span>
            <span className="v3-new-text">{LATEST_UPDATE.title}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="v3-h1">
            <span className="v3-soft">You streamed four hours.</span>
            <br />
            Did you rank up?
          </h1>
          <p className="v3-sub">
            Paste a Twitch VOD. We go through the whole stream, tell you what went wrong and when, and rank you on a
            ladder from Iron to Grandmaster.
          </p>
          <div className="v3-paste">
            <UrlPasteHero hint={null} />
          </div>
          <p className="v3-fine">Try it free on the first 12 minutes of any stream. No account needed.</p>
        </div>

        {/* The promotion plays once on load: the old emblem steps back, the
            new one lands, the word and the points arrive, the bar fills.
            Under reduced motion it simply shows the finished state. */}
        <div className="v3-result" role="img" aria-label="Example result: promoted from Silver I to Gold IV, plus 34 points">
          <div className="v3-frame">
            <div className="v3-result-top">
              <span>Example result</span>
              <span>4h 11m</span>
            </div>
            <div className="v3-rankup">
              <Emblem tier="silver" className="v3-from" size={256} />
              <span className="v3-arrow" aria-hidden="true" />
              <Emblem tier="gold" className="v3-to" size={256} />
            </div>
            <p className="v3-result-word">Promoted</p>
            <p className="v3-result-line">
              <span className="v3-result-rank">Gold IV</span>
              <span className="v3-result-delta">+34</span>
            </p>
            <div className="v3-bar-track" aria-hidden="true">
              <span className="v3-bar-fill" />
            </div>
            <p className="v3-result-sub">10% to Gold III</p>
          </div>
        </div>
      </section>

      {/* ── Proof: real numbers, live ── */}
      <section className="v3-proof" aria-label="LevlCast so far">
        <dl className="v3-proof-list">
          {stats && (
            <>
              <div>
                <dt>Streams analyzed</dt>
                <dd>{fmt(stats.streams)}</dd>
              </div>
              <div>
                <dt>Hours of streams</dt>
                <dd>{fmt(stats.hours)}</dd>
              </div>
              <div>
                <dt>Streamers ranked</dt>
                <dd>{fmt(stats.streamers)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Updates since {UPDATES_SINCE}</dt>
            <dd>
              <Link href="/changelog">{changelog.length}</Link>
            </dd>
          </div>
        </dl>
      </section>

      {/* ── The breakdown: timeline + scoreboard ── */}
      <section className="v3-sec" id="breakdown">
        <p className="v3-label">The breakdown <span className="v3-eg">Example</span></p>
        <h2 className="v3-h2">
          Here&apos;s what we found in one four hour stream.
        </h2>

        <div className="v3-tl" aria-label="Where things happened across the stream">
          <div className="v3-tl-times" aria-hidden="true">
            <span>00:00</span>
            <span>04:11</span>
          </div>
          <div className="v3-tl-track">
            <span className="v3-tl-dead" style={{ left: "52%", width: "11%" }} />
            {/* Labels alternate between two rows so neighbours never collide
                on a narrow screen, and the last one hangs left of its pin so
                it can't run off the edge. */}
            {MARKS.map((m, i) => (
              <span
                key={m.label}
                className="v3-tl-pin"
                data-tone={m.tone}
                data-row={i % 2 === 1 ? "2" : undefined}
                data-edge={m.at > 70 ? "end" : undefined}
                style={{ left: `${m.at}%` }}
              >
                <span className="v3-tl-pin-label">{m.label}</span>
              </span>
            ))}
          </div>
        </div>

        <dl className="v3-stats">
          {STATS.map((s) => (
            <div key={s.k} className="v3-stat" data-tone={s.tone}>
              <dt>{s.k}</dt>
              <dd>
                <span className="v3-stat-v">{s.v}</span>
                <span className="v3-stat-n">{s.note}</span>
              </dd>
            </div>
          ))}
        </dl>

        {/* The coach's advice, in one line. This was a whole section of
            quotes and notes, which was more reading than the page needed;
            the stats above already show what happened, so all that's left
            to say is what to do about it. */}
        <p className="v3-fix">
          <span className="v3-fix-k">Your fix for next stream</span>
          Talk through the quiet parts and tell chat what you&apos;re doing next.
        </p>
      </section>

      {/* ── Match history + league ── */}
      <section className="v3-sec v3-split" id="ranked">
        <div className="v3-col">
          <p className="v3-label">Match history <span className="v3-eg">Example</span></p>
          <h2 className="v3-h2">
            Every stream is a win or a loss.
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

        <div className="v3-col">
          <p className="v3-label">This week&apos;s league <span className="v3-eg">Example</span></p>
          <h2 className="v3-h2">
            Race the streamers nearest your rank.
          </h2>
          <p className="v3-rival">
            <b>NovaPlays</b> is 30 points ahead. One good stream passes them.
          </p>
          <ol className="v3-league">
            {LEAGUE.map((row, i) => (
              <li key={row.name} className="v3-lg-row" data-you={"you" in row ? "yes" : undefined}>
                <span className="v3-lg-pos">{i + 1}</span>
                <Emblem tier={row.tier} className="v3-lg-emb" size={256} />
                <span className="v3-lg-name">{row.name}</span>
                <span className="v3-lg-rank" style={{ color: TIER_HEX[row.tier] }}>{row.rank}</span>
                <span className="v3-lg-pts" data-sign={row.pts.startsWith("+") ? "up" : "down"}>{row.pts}</span>
                <span className="v3-lg-prize">{row.prize ?? ""}</span>
              </li>
            ))}
          </ol>
          <p className="v3-small">Every analyzed stream counts. Top three on Monday earn +20, +10 and +5 rank points.</p>
        </div>
      </section>

      {/* ── The ladder, drawn as a climb ── */}
      <section className="v3-sec" id="ladder">
        <p className="v3-label">The ladder</p>
        <h2 className="v3-h2">
          Iron to Grandmaster, same shape as the ladders you already grind.
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

      {/* ── Clips ── */}
      <section className="v3-sec" id="clips">
        <p className="v3-label">Clips</p>
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

      {/* ── Price ── */}
      <section className="v3-sec" id="pricing">
        <p className="v3-label">Price</p>
        <div className="v3-price">
          <div className="v3-plan">
            <p className="v3-plan-n">Free</p>
            <p className="v3-plan-p">$0</p>
            <p className="v3-plan-b">
              Try it on any stream with no account. Sign in and you get two full reports and two clips every week, forever.
              Nothing in the report is held back.
            </p>
            <Link href="/analyze" className="v3-btn v3-btn-ghost">Try it free</Link>
          </div>
          <div className="v3-plan v3-plan-lead">
            <p className="v3-plan-n">Pro</p>
            <p className="v3-plan-p">
              $14.99<span>/mo</span>
            </p>
            <p className="v3-plan-b">
              For streamers going live more than twice a week. Fifteen streams a month, twenty clips, and posting straight
              to YouTube.
            </p>
            <Link href="/auth/login?plan=monthly" className="v3-btn">Go Pro</Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="v3-sec" id="faq">
        <p className="v3-label">Questions</p>
        <FaqAccordion items={FAQ} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_STRUCTURED_DATA) }}
        />
      </section>

      {/* ── Closer ── */}
      <section className="v3-close">
        <h2 className="v3-close-h">
          Play your first match.
          <br />
          <span className="v3-soft">It takes about a minute.</span>
        </h2>
        <div className="v3-paste">
          <UrlPasteHero hint={null} />
        </div>
        <p className="v3-fine">Try it free on the first 12 minutes of any stream. No account needed.</p>
      </section>

      <SiteFooter />
    </div>
  );
}
