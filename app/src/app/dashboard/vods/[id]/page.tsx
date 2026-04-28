import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { CoachReportCard } from "@/components/dashboard/coach-report-card";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { ShareReportButton } from "@/components/dashboard/share-report-button";
import { VodProgress } from "@/components/dashboard/vod-progress";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { DownloadClip, CopyCaption, PostToYouTube, DeleteClip } from "@/components/dashboard/clip-actions";
import { FirstScoreCelebration } from "@/components/dashboard/first-score-celebration";
import { scoreColorVar } from "@/lib/score-utils";

const Icons = {
  Back: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M19 12H5M12 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Calendar: () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Film: () => (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7 4v16M17 4v16M2 9h5M17 9h5M2 15h5M17 15h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Scissors: () => (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M8.12 8.12L22 22M8.12 15.88L22 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Silence: () => (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M17 9l4 4M21 9l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Spark: () => (
    <svg viewBox="0 0 24 24" fill="none" width="12" height="12">
      <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Loader: () => (
    <svg viewBox="0 0 24 24" fill="none" width="15" height="15" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" strokeLinecap="round"/>
    </svg>
  ),
  Trash: () => (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

function getStreamerTitle(avg: number): string {
  if (avg >= 90) return "LevlCast Legend";
  if (avg >= 80) return "Elite Entertainer";
  if (avg >= 70) return "Crowd Favorite";
  if (avg >= 55) return "Consistent Creator";
  if (avg >= 40) return "Rising Talent";
  return "Fresh Streamer";
}

export default async function VodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: vod }, { data: allClips }, { data: connections }, { data: prevVod }, { data: recentVods }, { data: priorVodsForStats }, { data: profileForPlan }] = await Promise.all([
    supabase.from("vods").select("*, share_token").eq("id", id).eq("user_id", user!.id).single(),
    supabase.from("clips").select("*").eq("user_id", user!.id).eq("vod_id", id).order("created_at", { ascending: false }),
    supabase.from("social_connections").select("platform").eq("user_id", user!.id),
    supabase.from("vods").select("coach_report").eq("user_id", user!.id).eq("status", "ready").neq("id", id).order("stream_date", { ascending: false, nullsFirst: false }).order("analyzed_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
    supabase.from("vods").select("status").eq("user_id", user!.id).order("stream_date", { ascending: false }).limit(20),
    supabase.from("vods").select("coach_report, stream_date, analyzed_at").eq("user_id", user!.id).eq("status", "ready").neq("id", id).order("stream_date", { ascending: false, nullsFirst: false }).order("analyzed_at", { ascending: false, nullsFirst: false }).limit(50),
    supabase.from("profiles").select("plan, subscription_expires_at").eq("id", user!.id).single(),
  ]);

  const isPro =
    profileForPlan?.plan === "pro" &&
    !(profileForPlan.subscription_expires_at && new Date(profileForPlan.subscription_expires_at) < new Date());

  if (!vod) notFound();

  const peaks = (vod.peak_data as any[]) || [];
  const coachReport = vod.coach_report as any;
  const previousScore = (prevVod?.coach_report as any)?.overall_score as number | undefined;
  const previousReport = (prevVod?.coach_report as any) ?? undefined;
  const chatPulse = (vod.chat_pulse as any[] | null) ?? null;
  // word_timestamps powers the per-minute energy curve overlay on the
  // Silence Map. May be null on legacy VODs analyzed before migration 007.
  const wordTimestamps = (vod.word_timestamps as Array<{ start: number; end: number }> | null) ?? null;

  let streak = 0;
  for (const v of (recentVods ?? [])) {
    if (v.status === "ready") streak++;
    else break;
  }

  const priorScores = (priorVodsForStats ?? [])
    .map((v) => (v.coach_report as any)?.overall_score as number)
    .filter((s) => typeof s === "number" && !isNaN(s));

  const currentScore = coachReport?.overall_score as number | undefined;
  const allTimeBest = priorScores.length > 0 ? Math.max(...priorScores) : 0;

  // Build the score-trajectory points: last 9 prior + the current stream.
  // Use stream_date when present (the actual stream date) and fall back to
  // analyzed_at so VODs without recorded stream_date still chart in order.
  type PriorRow = { coach_report: { overall_score?: number } | null; stream_date: string | null; analyzed_at: string | null };
  const priorTrajectoryPoints = (priorVodsForStats as PriorRow[] | null ?? [])
    .map((v): { score: number; date: string } | null => {
      const score = v.coach_report?.overall_score;
      const date = v.stream_date ?? v.analyzed_at;
      if (typeof score !== "number" || isNaN(score) || !date) return null;
      return { score, date };
    })
    .filter((p): p is { score: number; date: string } => p !== null)
    .slice(0, 9); // most recent 9 by actual stream date, not analysis date

  const trajectory = currentScore !== undefined && (vod.stream_date || vod.analyzed_at)
    ? [
        ...priorTrajectoryPoints,
        { score: currentScore, date: (vod.stream_date as string | null) ?? (vod.analyzed_at as string | null) ?? new Date().toISOString(), current: true },
      ]
    : undefined;
  const isPersonalBest = currentScore !== undefined && priorScores.length > 0 && currentScore > allTimeBest;

  const last5 = [currentScore, ...priorScores.slice(0, 4)].filter((s): s is number => s !== undefined);
  const avg5 = last5.length > 0 ? last5.reduce((a, b) => a + b, 0) / last5.length : 0;
  const streamerTitle = getStreamerTitle(avg5);

  const isVodProcessing = vod.status === "transcribing" || vod.status === "analyzing";

  const readyClips = (allClips || []).filter((c) => c.status === "ready");
  const processingClips = (allClips || []).filter((c) => c.status === "processing");
  const failedClips = (allClips || []).filter((c) => c.status === "failed");
  const hasProcessingClip = processingClips.length > 0;

  const claimedStarts = new Set(
    (allClips || [])
      .filter((c) => c.status === "ready" || c.status === "processing")
      .map((c) => c.start_time_seconds)
  );

  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;
  const isFirstScore = vod.status === "ready" && currentScore !== undefined && (priorVodsForStats?.length ?? 0) === 0;

  const thumbnailSrc = vod.thumbnail_url
    ? (vod.thumbnail_url as string).replace("%{width}", "640").replace("%{height}", "360")
    : null;

  return (
    <>
      <VodStatusPoller hasProcessing={isVodProcessing || hasProcessingClip} />
      {isFirstScore && <FirstScoreCelebration score={currentScore!} />}

      {/* Back */}
      <div>
        <Link href="/dashboard/vods" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginBottom: 4 }}>
          <Icons.Back /> Back to VODs
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: thumbnailSrc ? "auto 1fr" : "1fr", gap: 20, alignItems: "flex-start" }}>
        {thumbnailSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailSrc}
            alt={vod.title}
            style={{ width: 200, aspectRatio: "16/9", borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid var(--line)" }}
          />
        )}
        <div className="col gap-sm">
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, margin: 0, color: "var(--ink)" }}>
            {vod.title}
          </h1>
          <div className="row gap-md" style={{ flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
              <Icons.Calendar />
              {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 5 }}>
              <Icons.Clock />
              {formatDuration(vod.duration_seconds)}
            </span>
            {currentScore !== undefined && (
              <span className="score-pill" style={{ color: scoreColorVar(currentScore), fontSize: 14 }}>
                {currentScore}<small>/100</small>
              </span>
            )}
          </div>
        </div>
      </div>

      {vod.status !== "ready" ? (
        <div>
          {isVodProcessing ? (
            <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} />
          ) : (
            <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: "var(--ink-3)" }}>
                <Icons.Film />
              </div>
              <p style={{ fontSize: 14, color: "var(--ink-3)", margin: 0 }}>
                {vod.status === "pending"
                  ? "This VOD hasn't been analyzed yet. Go back and click Analyze."
                  : `Analysis failed${vod.failed_reason ? `: ${vod.failed_reason}` : ""}. Go back and try again.`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Share button */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <ShareReportButton vodId={vod.id} existingToken={vod.share_token} />
          </div>

          {/* Coach Report */}
          {coachReport ? (
            <CoachReportCard
              report={coachReport}
              previousScore={previousScore}
              previousReport={previousReport}
              streak={streak}
              isPersonalBest={isPersonalBest}
              streamerTitle={streamerTitle}
              isPro={isPro}
              streamDurationSeconds={vod.duration_seconds ?? undefined}
              chatPulse={chatPulse}
              trajectory={trajectory}
              wordTimestamps={wordTimestamps}
            />
          ) : (
            <div className="card card-pad" style={{ color: "var(--ink-3)", fontSize: 14 }}>
              Coach report not available for this VOD. Re-analyze to generate one.
            </div>
          )}

          {/* Clip nudge */}
          {peaks.length > 0 && readyClips.length === 0 && processingClips.length === 0 && (
            <div className="card bordered accent-blue" style={{ padding: "18px 22px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div className="col gap-sm">
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    {peaks.length} clip moment{peaks.length !== 1 ? "s" : ""} found
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>Turn your best moments into shareable clips — scroll down.</span>
                </div>
                <a href="#clip-moments" className="btn btn-blue" style={{ flexShrink: 0 }}>
                  Generate Clips <Icons.Arrow />
                </a>
              </div>
            </div>
          )}

          {/* Generated Clips */}
          {(readyClips.length > 0 || processingClips.length > 0 || failedClips.length > 0) && (
            <div>
              <div className="card-head" style={{ padding: "0 0 12px", marginBottom: 0 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: 0 }}>
                  Generated Clips ({readyClips.length})
                </h3>
              </div>

              {processingClips.map((clip) => (
                <div key={clip.id} className="card card-pad-sm" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <Icons.Loader />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{clip.title}</p>
                    <p style={{ fontSize: 12, color: "var(--ink-3)", margin: "2px 0 0" }}>Generating — page will update automatically.</p>
                  </div>
                </div>
              ))}

              {failedClips.map((clip) => (
                <div key={clip.id} className="card card-pad-sm" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, borderColor: "color-mix(in oklab, var(--danger) 30%, var(--line))" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{clip.title}</p>
                    <p style={{ fontSize: 12, color: "var(--danger)", margin: "2px 0 0" }}>
                      {(clip as { failed_reason?: string | null }).failed_reason || "Generation failed — delete and try again."}
                    </p>
                  </div>
                  <DeleteClip clipId={clip.id} />
                </div>
              ))}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                {readyClips.map((clip) => (
                  <div key={clip.id} className="card" style={{ overflow: "hidden" }}>
                    <video controls preload="metadata" playsInline style={{ width: "100%", aspectRatio: "16/9", background: "#000", display: "block" }}>
                      <source src={clip.video_url} type="video/mp4" />
                    </video>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0, lineHeight: 1.35 }}>{clip.title}</h3>
                        <span className="chip g" style={{ flexShrink: 0 }}>
                          <Icons.Spark />
                          {Math.round(clip.peak_score * 100)}
                        </span>
                      </div>
                      {clip.caption_text && (
                        <p style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55, marginBottom: 12, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 8 }}>
                          {clip.caption_text}
                        </p>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <DownloadClip clipId={clip.id} />
                        <CopyCaption caption={clip.caption_text} />
                        <PostToYouTube clipId={clip.id} isConnected={isYouTubeConnected} />
                        <DeleteClip clipId={clip.id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post to clips nudge */}
          {readyClips.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 18px", background: "color-mix(in oklab, var(--blue) 8%, var(--surface))", border: "1px solid color-mix(in oklab, var(--blue) 25%, var(--line))", borderRadius: "var(--r-md)" }}>
              <span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>
                <b style={{ color: "var(--ink)" }}>{readyClips.length} clip{readyClips.length !== 1 ? "s" : ""} ready.</b>{" "}
                Head to Clips to post them to YouTube.
              </span>
              <Link href="/dashboard/clips" className="btn btn-blue" style={{ padding: "7px 14px", fontSize: 12, flexShrink: 0 }}>
                Go to Clips <Icons.Arrow />
              </Link>
            </div>
          )}

          {/* Peak Moments */}
          {peaks.length > 0 && (
            <div id="clip-moments">
              <div style={{ marginBottom: 14 }}>
                <span className="page-eyebrow">Clip Moments · {peaks.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {peaks.map((peak: any, i: number) => {
                  const alreadyClaimed = claimedStarts.has(Math.round(peak.start));
                  return (
                    <div key={i} className="card card-pad-sm">
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                        <h3 style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{peak.title}</h3>
                        <span className="chip" style={{ flexShrink: 0, textTransform: "uppercase", fontSize: 10 }}>{peak.category === "funny" ? "Comedy" : peak.category}</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 8, lineHeight: 1.5 }}>{peak.reason}</p>
                      {peak.hook && (
                        <p style={{ fontSize: 12, color: "var(--blue)", background: "color-mix(in oklab, var(--blue) 8%, var(--surface-2))", border: "1px solid color-mix(in oklab, var(--blue) 20%, var(--line))", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
                          Hook: {peak.hook}
                        </p>
                      )}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                          {formatDuration(peak.start)} – {formatDuration(peak.end)}
                          {" · "}Score {Math.round(peak.score * 100)}
                        </span>
                        {alreadyClaimed ? (
                          <span className="chip g" style={{ gap: 5 }}>
                            <Icons.Scissors /> Clip generated
                          </span>
                        ) : (
                          <GenerateClipButton vodId={vod.id} peakIndex={i} hasProcessing={hasProcessingClip} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
