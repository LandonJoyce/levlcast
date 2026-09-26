import { createAdminClient, createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { formatDuration, ordinal } from "@/lib/utils";
import { VodProgress } from "@/components/dashboard/vod-progress";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { HighlightReelButton } from "@/components/dashboard/highlight-reel-button";
import { ShareReportButton } from "@/components/dashboard/share-report-button";
import RetryAnalyzeButton from "@/components/dashboard/retry-analyze-button";
import { FirstScoreCelebration } from "@/components/dashboard/first-score-celebration";
import { RankPanel } from "@/components/dashboard/rank-panel";
import { StreamScorecard } from "@/components/dashboard/stream-scorecard";
import { FullBreakdown } from "@/components/dashboard/full-breakdown";
import { CoachReport } from "@/components/dashboard/coach-report";
import { DownloadClip, CopyCaption, PostToYouTube, DeleteClip } from "@/components/dashboard/clip-actions";
import { getLeagueView, passedByStream } from "@/lib/league";
import { currentWeekStart } from "@/lib/limits";
import { isPlacementDelta } from "@/lib/rank";

/*
 * One page per stream. There used to be two: a summary (score, best clip,
 * more moments, a button to the report) and the report itself (rank, score
 * again, best moment, the scorecard, the breakdown, the clips again and
 * every moment again). Half of each page repeated the other, and the parts
 * people came for were split across both. It's one page now, in the order
 * a game shows you after a match: the result, what to do next time, the
 * clips, and the long read folded away at the bottom.
 *
 * /dashboard/vods/[id]/report redirects here.
 */

/** Twitch VOD link that starts at `secs`. */
function vodLinkAt(twitchVodId: string | null | undefined, secs: number): string | null {
  if (!twitchVodId) return null;
  const safe = Math.max(0, Math.floor(secs));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const t = h > 0 ? `${h}h${m}m${s}s` : m > 0 ? `${m}m${s}s` : `${s}s`;
  return `https://www.twitch.tv/videos/${twitchVodId}?t=${t}`;
}

/** "M:SS" or "H:MM:SS" to seconds. */
function parseClipTime(t: string | null | undefined): number {
  if (!t) return 0;
  const parts = t.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function clockTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

function categoryLabel(c: string | null | undefined): string {
  if (!c) return "";
  return c === "funny" ? "Comedy" : c.charAt(0).toUpperCase() + c.slice(1);
}

function passedLine(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return ` Passed ${names[0]}.`;
  if (names.length <= 3) return ` Passed ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}.`;
  return ` Passed ${names.slice(0, 2).join(", ")} and ${names.length - 2} more.`;
}

/**
 * Where this stream left the streamer in this week's league. Null for
 * anything analysed before this week, since an old report can't say
 * anything true about a table that has moved since. "Passed" is only
 * worked out for the latest analysis, the one stream whose effect on the
 * table is still exact.
 */
async function getLeagueMoment(userId: string, vodId: string, analyzedAt: string | null, rankDelta: number | null) {
  const weekStart = currentWeekStart();
  if (!analyzedAt || Date.parse(analyzedAt) < Date.parse(`${weekStart}T00:00:00Z`)) return null;
  try {
    const admin = createAdminClient();
    const view = await getLeagueView(admin, userId, weekStart);
    if (!view) return null;
    const { data: latest } = await admin
      .from("vods")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "ready")
      .order("analyzed_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    // A placement counts as a stream played, for zero points.
    const delta = rankDelta ?? 0;
    const leagueDelta = isPlacementDelta(delta) ? 0 : delta;
    return {
      name: view.name,
      position: view.you.position,
      size: view.standings.length,
      passed: latest?.id === vodId ? passedByStream(view, leagueDelta) : [],
    };
  } catch {
    return null;
  }
}

type FailureKind = "playback_token" | "timeout" | "too_short" | "quota" | "generic";

/** Sorts a failure reason into the few cases that each have their own fix. */
function categorizeFailure(reason: string | null | undefined): FailureKind {
  if (!reason) return "generic";
  const r = reason.toLowerCase();
  if (r.includes("playback token") || r.includes("blocked access") || r.includes("subscriber-only") || r.includes("dmca")) return "playback_token";
  if (r.includes("timed out") || r.includes("timeout") || r.includes("stalled")) return "timeout";
  if (r.includes("too short") || r.includes("at least 5 minutes")) return "too_short";
  if (r.includes("limit reached") || r.includes("free analyses") || r.includes("monthly analysis limit")) return "quota";
  return "generic";
}

type ClipRow = {
  id: string;
  status: string;
  start_time_seconds: number;
  video_url: string | null;
  title: string | null;
  caption_text: string | null;
  peak_score: number | null;
  is_highlight_reel: boolean | null;
  failed_reason?: string | null;
};

type PriorRow = { coach_report: Record<string, any> | null; stream_date: string | null; analyzed_at: string | null };

export default async function StreamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vod } = await supabase
    .from("vods")
    .select(
      "id, title, duration_seconds, status, stream_date, analyzed_at, coach_report, twitch_vod_id, share_token, failed_reason, peak_data, rank_delta, rank_points_after"
    )
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!vod) notFound();

  const streamDate = (vod.stream_date as string | null) ?? new Date(0).toISOString();
  const [{ data: clipRows }, { data: connections }, { data: priorRows }, { data: profile }] = await Promise.all([
    supabase.from("clips").select("*").eq("user_id", user!.id).eq("vod_id", id).order("created_at", { ascending: false }),
    supabase.from("social_connections").select("platform").eq("user_id", user!.id),
    // Only streams from before this one, so every comparison is against a
    // stream that actually came first.
    supabase
      .from("vods")
      .select("coach_report, stream_date, analyzed_at")
      .eq("user_id", user!.id)
      .eq("status", "ready")
      .neq("id", id)
      .lt("stream_date", streamDate)
      .order("stream_date", { ascending: false, nullsFirst: false })
      .limit(50),
    supabase.from("profiles").select("plan, subscription_expires_at").eq("id", user!.id).single(),
  ]);

  const isPro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date());

  const report = vod.coach_report as Record<string, any> | null;
  const peaks = (vod.peak_data as any[] | null) ?? [];
  const clips = (clipRows as ClipRow[] | null) ?? [];
  const prior = (priorRows as PriorRow[] | null) ?? [];
  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;
  const isReady = vod.status === "ready";
  const isVodProcessing = vod.status === "transcribing" || vod.status === "analyzing";

  const readyClips = clips.filter((c) => c.status === "ready" && !c.is_highlight_reel);
  const processingClips = clips.filter((c) => c.status === "processing" && !c.is_highlight_reel);
  const failedClips = clips.filter((c) => c.status === "failed" && !c.is_highlight_reel);
  const existingReel = clips.find((c) => c.is_highlight_reel && c.status === "ready");
  const processingReel = clips.find((c) => c.is_highlight_reel && c.status === "processing");
  const hasProcessingClip = clips.some((c) => c.status === "processing");

  // Does this moment have a clip yet? The editor can trim a clip's start
  // inward by a good way, so match anywhere from a minute before the
  // moment to its end. Moments are usually minutes apart.
  function clipForPeak(start: number, end: number): ClipRow | undefined {
    const s = Math.round(Number(start));
    const e = Math.round(Number(end));
    return clips.find(
      (c) =>
        !c.is_highlight_reel &&
        (c.status === "ready" || c.status === "processing") &&
        c.start_time_seconds >= s - 60 &&
        c.start_time_seconds <= e + 5
    );
  }

  // Compare against the last stream of the same kind when there is one,
  // so a switch from a game to Just Chatting doesn't read as a slump.
  const streamerType = report?.streamer_type ?? null;
  const previous =
    (streamerType ? prior.find((v) => v.coach_report?.streamer_type === streamerType) : null) ?? prior[0] ?? null;
  const currentScore = typeof report?.overall_score === "number" ? (report.overall_score as number) : undefined;
  const previousScore = previous?.coach_report?.overall_score as number | undefined;
  const scoreDelta = currentScore !== undefined && typeof previousScore === "number" ? currentScore - previousScore : null;
  const isFirstScore = isReady && currentScore !== undefined && prior.length === 0;

  const trajectory =
    currentScore !== undefined && (vod.stream_date || vod.analyzed_at)
      ? [
          ...prior
            .map((v) => {
              const score = v.coach_report?.overall_score;
              const date = v.stream_date ?? v.analyzed_at;
              return typeof score === "number" && !isNaN(score) && date ? { score, date } : null;
            })
            .filter((p): p is { score: number; date: string } => p !== null)
            .slice(0, 9),
          {
            score: currentScore,
            date: (vod.stream_date as string | null) ?? (vod.analyzed_at as string | null) ?? new Date().toISOString(),
            current: true,
          },
        ]
      : undefined;

  const rankDelta = (vod.rank_delta as number | null) ?? null;
  const placement = rankDelta !== null && isPlacementDelta(rankDelta);
  const result = rankDelta !== null && !placement ? rankDelta : null;
  const league = isReady ? await getLeagueMoment(user!.id, id, vod.analyzed_at as string | null, rankDelta) : null;

  // The coach's one-line read on the stream, and the one thing to do next
  // time. Older reports have no punch line; their recommendation stands in.
  const clean = (s: string) => s.replace(/ — /g, ". ").replace(/—/g, " ");
  const headline: string | null = report?.punch_line ?? (report?.recommendation ? clean(report.recommendation) : null);
  const mission: string | null = report?.next_stream_goals?.[0] ?? (report?.recommendation ? clean(report.recommendation) : null);
  const bestMoment = report?.best_moment as { time?: string; description?: string } | undefined;
  const bestLink = bestMoment?.time ? vodLinkAt(vod.twitch_vod_id as string | null, parseClipTime(bestMoment.time)) : null;
  const missed = report?.missed_clip as { time?: string; note?: string } | undefined;

  const failureKind = vod.status === "failed" ? categorizeFailure(vod.failed_reason as string | null) : null;
  const twitchVodUrl = vod.twitch_vod_id ? `https://www.twitch.tv/videos/${vod.twitch_vod_id}` : null;
  const dateLabel = vod.stream_date
    ? new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      <VodStatusPoller hasProcessing={isVodProcessing || hasProcessingClip} />
      {isFirstScore && (
        <FirstScoreCelebration
          vodId={vod.id}
          score={currentScore!}
          points={(vod.rank_points_after as number | null) ?? null}
          recommendation={mission}
          existingToken={vod.share_token as string | null}
        />
      )}

      <header className="sp-head">
        <Link href="/dashboard/vods" className="sp-back">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" /> Streams
        </Link>
        <div className="sp-head-row">
          <div className="sp-head-main">
            <h1 className="page-title sp-title">{vod.title}</h1>
            <p className="sp-meta">
              {dateLabel}
              {vod.duration_seconds ? ` · ${formatDuration(vod.duration_seconds)}` : ""}
            </p>
          </div>
          {isReady && (
            <ShareReportButton
              vodId={vod.id}
              existingToken={vod.share_token}
              score={currentScore}
              recommendation={report?.recommendation ?? null}
            />
          )}
        </div>
      </header>

      {!isReady ? (
        isVodProcessing ? (
          <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} />
        ) : vod.status === "pending" ? (
          <div className="sp-state">
            <p className="sp-state-title">Not analyzed yet</p>
            <p>Head back to Streams and press Analyze on this one.</p>
            <Link href="/dashboard/vods" className="btn btn-ghost">Back to Streams</Link>
          </div>
        ) : failureKind === "playback_token" ? (
          <div className="sp-state" data-tone="warn">
            <p className="sp-state-k">Twitch blocked access</p>
            <p className="sp-state-title">We couldn&apos;t get this VOD&apos;s audio from Twitch.</p>
            <p>
              Twitch says the VOD is restricted, so the analysis never started and nothing counted against your
              reports. Usually it&apos;s one of these:
            </p>
            <ul>
              <li><b>Subscriber-only VOD.</b> Check the Sub-only toggle in Video Producer.</li>
              <li><b>Muted for copyrighted music.</b> Flagged VODs often get locked like this.</li>
              <li><b>Deleted or expired.</b> Affiliates keep VODs 14 days, Partners 60.</li>
              <li><b>Region restricted.</b> Rare, but it happens.</li>
            </ul>
            <div className="sp-state-actions">
              <RetryAnalyzeButton vodId={vod.id} />
              {twitchVodUrl && (
                <a href={twitchVodUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                  Open on Twitch <ArrowUpRight size={13} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        ) : failureKind === "timeout" ? (
          <div className="sp-state" data-tone="warn">
            <p className="sp-state-k">Timed out</p>
            <p className="sp-state-title">The analysis didn&apos;t finish in time.</p>
            <p>
              Usually Twitch was slow to send the audio. Nothing counted against your reports, and a retry almost
              always works.
            </p>
            <div className="sp-state-actions">
              <RetryAnalyzeButton vodId={vod.id} />
            </div>
          </div>
        ) : (
          <div className="sp-state" data-tone="bad">
            <p className="sp-state-k">Analysis failed</p>
            <p className="sp-state-title">{(vod.failed_reason as string | null) || "Something went wrong on our side."}</p>
            <div className="sp-state-actions">
              <RetryAnalyzeButton vodId={vod.id} />
            </div>
          </div>
        )
      ) : (
        <>
          {/* The result: what the ladder did, and the coach's one-line read. */}
          <section className="hm-top sp-top">
            <div className="hm-last sp-result">
              <p className="hm-k">
                Result
                {currentScore !== undefined && (
                  <span>
                    Score {currentScore}
                    {isPro && scoreDelta !== null && scoreDelta !== 0 && (
                      <em data-sign={scoreDelta > 0 ? "up" : "down"}>
                        {" "}
                        {scoreDelta > 0 ? `+${scoreDelta}` : `−${Math.abs(scoreDelta)}`}
                      </em>
                    )}
                  </span>
                )}
              </p>
              {result !== null ? (
                <p className="sp-verdict" data-r={result >= 0 ? "win" : "loss"}>
                  <b>{result >= 0 ? "Win" : "Loss"}</b>
                  <span>{result >= 0 ? `+${result}` : `−${Math.abs(result)}`}</span>
                </p>
              ) : placement ? (
                <p className="sp-verdict" data-r="placed">
                  <b>Placed</b>
                </p>
              ) : null}
              {headline && <p className="sp-headline">{headline}</p>}
              {league && (
                <p className="sp-league">
                  <b>
                    {ordinal(league.position)} of {league.size}
                  </b>{" "}
                  in {league.name} this week.{passedLine(league.passed)}
                </p>
              )}
            </div>
            <RankPanel
              points={(vod.rank_points_after as number | null) ?? null}
              delta={rankDelta}
              label="Rank after this stream"
            />
          </section>

          {/* What to do next time, and where this one's points went. */}
          {report && (
            <section className="sp-post">
              {(mission || bestMoment?.description) && (
                <div className="sp-mission">
                  {mission && (
                    <>
                      <p className="hm-k">Do this next stream</p>
                      <p className="hm-fix">{mission}</p>
                      <p className="sp-mission-note">Your next report checks whether you did it.</p>
                    </>
                  )}
                  {bestMoment?.description && (
                    <p className="sp-best">
                      <span className="sp-best-k">Best moment{bestMoment.time ? ` · ${bestMoment.time}` : ""}</span>
                      {bestMoment.description}
                      {bestLink && (
                        <a href={bestLink} target="_blank" rel="noopener noreferrer">
                          Watch on Twitch <ArrowUpRight size={12} aria-hidden="true" />
                        </a>
                      )}
                    </p>
                  )}
                </div>
              )}
              <StreamScorecard
                scores={report.score_breakdown ?? null}
                previousScores={previous?.coach_report?.score_breakdown ?? null}
                deadAirPct={report.dead_air_pct ?? null}
              />
            </section>
          )}

          {/* Clips: the ones made, then every moment worth making. */}
          {(peaks.length > 0 || readyClips.length > 0 || processingClips.length > 0 || failedClips.length > 0) && (
            <section className="hm-sec" id="clips">
              <div className="hm-head">
                <h2>Clips</h2>
                <span className="hm-record">
                  {peaks.length} {peaks.length === 1 ? "moment" : "moments"} · {readyClips.length} made
                </span>
                {peaks.length > 1 && (
                  <div className="sp-reel">
                    <HighlightReelButton
                      vodId={vod.id}
                      peakCount={peaks.length}
                      reelExisting={existingReel?.id ?? null}
                      reelProcessing={!!processingReel}
                    />
                  </div>
                )}
              </div>

              {hasProcessingClip && (
                <p className="uc-connect">Making a clip now. It takes a minute or two and this page updates on its own.</p>
              )}

              {existingReel?.video_url && (
                <div className="sp-clip sp-clip-reel">
                  <video controls preload="metadata" playsInline>
                    <source src={existingReel.video_url} type="video/mp4" />
                  </video>
                  <div className="sp-clip-body">
                    <p className="sp-clip-title">Highlight reel</p>
                    <div className="sp-clip-actions">
                      <DownloadClip clipId={existingReel.id} />
                      <PostToYouTube clipId={existingReel.id} isConnected={isYouTubeConnected} />
                      <DeleteClip clipId={existingReel.id} />
                    </div>
                  </div>
                </div>
              )}

              {readyClips.length > 0 && (
                <div className="sp-clips">
                  {readyClips.map((clip) => (
                    <div key={clip.id} className="sp-clip">
                      <video controls preload="metadata" playsInline>
                        <source src={clip.video_url ?? undefined} type="video/mp4" />
                      </video>
                      <div className="sp-clip-body">
                        <p className="sp-clip-title">
                          <Link href={`/dashboard/clips/${clip.id}/edit`}>{clip.title || "Untitled clip"}</Link>
                        </p>
                        {clip.caption_text && <p className="sp-clip-caption">{clip.caption_text}</p>}
                        <div className="sp-clip-actions">
                          <DownloadClip clipId={clip.id} />
                          <CopyCaption caption={clip.caption_text ?? ""} />
                          <PostToYouTube clipId={clip.id} isConnected={isYouTubeConnected} />
                          <DeleteClip clipId={clip.id} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {failedClips.map((clip) => (
                <div key={clip.id} className="sp-clip-failed">
                  <div>
                    <p className="sp-clip-title">{clip.title || "Untitled clip"}</p>
                    <p>{clip.failed_reason || "This clip didn't render. Delete it and make it again."}</p>
                  </div>
                  <DeleteClip clipId={clip.id} />
                </div>
              ))}

              {peaks.length > 0 && (
                <ol className="sp-moments">
                  {peaks.map((peak, i) => {
                    const start = Number(peak.start);
                    const end = Number(peak.end);
                    const clip = clipForPeak(start, end);
                    const href = vodLinkAt(vod.twitch_vod_id as string | null, start);
                    return (
                      <li key={`peak-${i}`} className="sp-moment">
                        {href ? (
                          <a className="sp-moment-time" href={href} target="_blank" rel="noopener noreferrer" title="Open this moment on Twitch">
                            {clockTime(start)}
                          </a>
                        ) : (
                          <span className="sp-moment-time">{clockTime(start)}</span>
                        )}
                        <div className="sp-moment-main">
                          <p className="sp-moment-title">
                            {peak.title}
                            {peak.category && <span className="sp-moment-cat">{categoryLabel(peak.category)}</span>}
                          </p>
                          {peak.reason && <p className="sp-moment-why">{peak.reason}</p>}
                          {peak.hook && <p className="sp-moment-hook">Hook: {peak.hook}</p>}
                        </div>
                        <div className="sp-moment-act">
                          {clip?.status === "ready" ? (
                            <Link href={`/dashboard/clips/${clip.id}/edit`} className="sp-moment-done">
                              Clip made
                            </Link>
                          ) : clip?.status === "processing" ? (
                            <span className="sp-moment-busy">Making the clip...</span>
                          ) : (
                            <GenerateClipButton vodId={vod.id} peakIndex={i} hasProcessing={hasProcessingClip} />
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {missed?.time && missed?.note && (
                    <li className="sp-moment sp-missed">
                      {vodLinkAt(vod.twitch_vod_id as string | null, parseClipTime(missed.time)) ? (
                        <a
                          className="sp-moment-time"
                          href={vodLinkAt(vod.twitch_vod_id as string | null, parseClipTime(missed.time))!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {missed.time}
                        </a>
                      ) : (
                        <span className="sp-moment-time">{missed.time}</span>
                      )}
                      <div className="sp-moment-main">
                        <p className="sp-moment-title">Almost a clip</p>
                        <p className="sp-moment-why">{missed.note}</p>
                      </div>
                    </li>
                  )}
                </ol>
              )}
            </section>
          )}

          {report ? (
            <FullBreakdown>
              <CoachReport
                report={report as any}
                twitchVodId={vod.twitch_vod_id ?? undefined}
                streamDurationSeconds={vod.duration_seconds ?? undefined}
                trajectory={trajectory}
              />
            </FullBreakdown>
          ) : (
            <div className="sp-state">
              <p>There&apos;s no coach report for this stream. Analyze it again to get one.</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
