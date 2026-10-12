import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import SiteHeader from "@/components/landing/SiteHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { ReportItem, fmtDuration } from "@/components/preview/preview-report";
import { WatchMoment } from "@/components/moment/watch-moment";
import { shoulders } from "../../fonts";
import "../../home-ranked.css";
import "../../analyze/analyze.css";

/**
 * A report a streamer shared (the "Share report" button). Strangers land
 * here from the streamer's own link, so it's one of the few pages that
 * reaches new people, and it reads like the free report on /analyze: the
 * same sections, type and rules. It used to be its own page with an
 * orange-to-pink gradient, a glowing button and spaced capitals, and its
 * button went to sign-in instead of the free report anyone can try.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Report {
  overall_score?: number;
  punch_line?: string;
  stream_story?: string;
  recommendation?: string;
  strengths?: string[];
  improvements?: string[];
}

interface Peak {
  title?: string;
  start?: number;
  hook?: string;
}

async function load(token: string) {
  if (!UUID.test(token)) return null;
  const { data } = await createAdminClient()
    .from("vods")
    .select("title, twitch_vod_id, stream_date, duration_seconds, peak_data, coach_report, profiles(twitch_display_name, twitch_login, twitch_avatar_url)")
    .eq("share_token", token)
    .single();
  return data;
}

function streamerName(vod: NonNullable<Awaited<ReturnType<typeof load>>>): string {
  const p = vod.profiles as { twitch_display_name?: string | null; twitch_login?: string | null } | null;
  return p?.twitch_display_name || p?.twitch_login || "A streamer";
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const vod = await load(token);
  const report = (vod?.coach_report ?? null) as Report | null;
  if (!vod || !report) return { title: "Stream report", robots: { index: false } };
  const name = streamerName(vod);
  const line = report.punch_line || report.recommendation || "A LevlCast report on a Twitch stream.";
  const title = `${name}'s stream report`;
  return {
    title,
    description: line,
    robots: { index: false },
    openGraph: { title: `${name} scored ${report.overall_score ?? "?"} on LevlCast`, description: line, images: [`/share/${token}/opengraph-image`] },
    twitter: { card: "summary_large_image", title: `${name} scored ${report.overall_score ?? "?"} on LevlCast`, description: line, images: [`/share/${token}/opengraph-image`] },
  };
}

function scoreTone(n: number) {
  if (n >= 75) return "good";
  if (n >= 50) return "warn";
  return "bad";
}

function clock(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const vod = await load(token);
  if (!vod) notFound();
  const r = vod.coach_report as Report | null;
  if (!r) notFound();

  const name = streamerName(vod);
  const avatar = (vod.profiles as { twitch_avatar_url?: string | null } | null)?.twitch_avatar_url ?? null;
  const score = typeof r.overall_score === "number" ? r.overall_score : null;
  const peaks = ((vod.peak_data as Peak[] | null) ?? []).filter((p) => p && p.title).slice(0, 4);
  const strengths = (r.strengths ?? []).slice(0, 3);
  const improvements = (r.improvements ?? []).slice(0, 3);
  const when = vod.stream_date
    ? new Date(vod.stream_date as string).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  const length = vod.duration_seconds ? fmtDuration(vod.duration_seconds as number) : null;

  return (
    <div className={`ll-page v3 ${shoulders.variable}`}>
      <SiteHeader />
      <main className="v3-sec">
        <article className="pr">
          <header className="pr-head">
            <div className="pr-head-main">
              <p className="v3-label pr-who">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" width={22} height={22} />
                ) : null}
                {name}
                {when ? ` · ${when}` : ""}
                {length ? ` · ${length}` : ""}
              </p>
              <h1 className="pr-title">{(vod.title as string | null) || "Untitled stream"}</h1>
              {r.punch_line ? <p className="pr-scope">{r.punch_line}</p> : null}
            </div>
            {score !== null ? (
              <div className="pr-score" data-tone={scoreTone(score)}>
                <span className="pr-score-v">{score}</span>
                <span className="pr-score-k">Out of 100</span>
              </div>
            ) : null}
          </header>

          {r.stream_story ? (
            <section className="pr-sec">
              <h2 className="pr-k">Summary</h2>
              <p className="pr-story">{r.stream_story}</p>
            </section>
          ) : null}

          {r.recommendation ? (
            <section className="pr-sec">
              <h2 className="pr-k">Fix this first</h2>
              <p className="pr-fix">{r.recommendation}</p>
            </section>
          ) : null}

          {strengths.length > 0 ? (
            <section className="pr-sec">
              <h2 className="pr-k">Working</h2>
              <ul className="pr-list" data-tone="good">
                {strengths.map((s, i) => (
                  <ReportItem key={i} text={s.replace(/^RECURRING:\s*/i, "")} />
                ))}
              </ul>
            </section>
          ) : null}

          {improvements.length > 0 ? (
            <section className="pr-sec">
              <h2 className="pr-k">To work on</h2>
              <ul className="pr-list" data-tone="bad">
                {improvements.map((s, i) => (
                  <ReportItem key={i} text={s.replace(/^RECURRING:\s*/i, "")} />
                ))}
              </ul>
            </section>
          ) : null}

          {peaks.length > 0 ? (
            <section className="pr-sec">
              <h2 className="pr-k">Best moments</h2>
              <ol className="pr-clips">
                {peaks.map((p, i) => (
                  <li key={i}>
                    {vod.twitch_vod_id ? (
                      <WatchMoment vodId={vod.twitch_vod_id as string} seconds={p.start ?? 0} label={p.title} className="pr-clip-at">
                        {clock(p.start ?? 0)}
                      </WatchMoment>
                    ) : (
                      <span className="pr-clip-at">{clock(p.start ?? 0)}</span>
                    )}
                    <div>
                      <p className="pr-clip-t">{p.title}</p>
                      {p.hook ? <p className="pr-note">{p.hook}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="pr-sec pr-more">
            <p className="pr-k">Stream on Twitch?</p>
            <div>
              <h2 className="pr-more-h">Get a report like this on your last stream.</h2>
              <p className="pr-story">Type your Twitch name and it reads your last broadcast. Free, and no account needed.</p>
              <Link href="/analyze?ref=share" className="v3-btn">
                Try it on my stream <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
