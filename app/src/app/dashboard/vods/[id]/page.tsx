import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDuration } from "@/lib/utils";
import { VodProgress } from "@/components/dashboard/vod-progress";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { ShareReportButton } from "@/components/dashboard/share-report-button";
import { DownloadClip, CopyCaption, PostToYouTube, ChangeStyleButton } from "@/components/dashboard/clip-actions";
import { FirstScoreCelebration } from "@/components/dashboard/first-score-celebration";
import { scoreColorHex } from "@/lib/score-utils";

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
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export default async function VodPunchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch the VOD first so we have its stream_date for chronological filtering
  const { data: vod } = await supabase
    .from("vods")
    .select("id, title, duration_seconds, status, stream_date, analyzed_at, coach_report, twitch_vod_id, share_token, failed_reason, peak_data")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!vod) notFound();

  const streamDate = (vod.stream_date as string | null) ?? new Date(0).toISOString();

  const [
    { data: topClip },
    { data: connections },
    { data: prevVod },
    { count: priorAnalyzedCount },
    { data: processingClip },
    { data: allClipsForVod },
  ] = await Promise.all([
    supabase
      .from("clips")
      .select("id, video_url, title, caption_text, peak_score, caption_style, start_time_seconds")
      .eq("user_id", user!.id)
      .eq("vod_id", id)
      .eq("status", "ready")
      .order("peak_score", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("social_connections")
      .select("platform")
      .eq("user_id", user!.id),
    // Only VODs streamed BEFORE this one so score delta always compares
    // against a stream that actually happened earlier in time
    supabase
      .from("vods")
      .select("coach_report")
      .eq("user_id", user!.id)
      .eq("status", "ready")
      .neq("id", id)
      .lt("stream_date", streamDate)
      .order("stream_date", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    // Count uses { count: "exact", head: true } — data is always null for head
    // queries so we destructure count directly, not data
    supabase
      .from("vods")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "ready")
      .neq("id", id)
      .lt("stream_date", streamDate),
    supabase
      .from("clips")
      .select("id")
      .eq("user_id", user!.id)
      .eq("vod_id", id)
      .eq("status", "processing")
      .limit(1)
      .maybeSingle(),
    // All clips for this VOD — used to render the recommended-cuts list
    // with per-peak status (ready / processing / not yet generated).
    supabase
      .from("clips")
      .select("id, status, start_time_seconds, video_url, title")
      .eq("user_id", user!.id)
      .eq("vod_id", id)
      .in("status", ["ready", "processing"]),
  ]);

  const coachReport = vod.coach_report as any;
  const peaks = (vod.peak_data as any[]) ?? [];
  const currentScore = coachReport?.overall_score as number | undefined;
  const previousScore = (prevVod?.coach_report as any)?.overall_score as number | undefined;
  const scoreDelta = currentScore !== undefined && previousScore !== undefined ? currentScore - previousScore : null;
  const punchLine: string | null = coachReport?.punch_line ?? null;
  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;
  const isVodProcessing = vod.status === "transcribing" || vod.status === "analyzing";
  const hasProcessingClip = !!processingClip;
  const isFirstScore = vod.status === "ready" && currentScore !== undefined && (priorAnalyzedCount ?? 1) === 0;
  const scoreColor = currentScore !== undefined ? scoreColorHex(currentScore) : "#A6B3C9";
  const topPeak = peaks[0] ?? null;

  // Map each detected peak to its clip status. We match by start_time_seconds
  // ±3s — same tolerance the clip generation API uses to prevent duplicates.
  type ClipRow = { id: string; status: string; start_time_seconds: number; video_url: string | null; title: string | null };
  const clipsList: ClipRow[] = (allClipsForVod as ClipRow[] | null) ?? [];
  function findClipForPeak(peakStart: number): ClipRow | undefined {
    const target = Math.round(Number(peakStart));
    return clipsList.find((c) => Math.abs(c.start_time_seconds - target) <= 3);
  }

  return (
    <>
      <VodStatusPoller hasProcessing={isVodProcessing || hasProcessingClip} />
      {isFirstScore && <FirstScoreCelebration score={currentScore!} />}

      {/* Back */}
      <div>
        <Link href="/dashboard/vods" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginBottom: 4 }}>
          <Icons.Back /> Back to streams
        </Link>
      </div>

      {/* VOD title + meta */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 8px", color: "var(--ink)" }}>
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
        </div>
      </div>

      {vod.status !== "ready" ? (
        <>
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
        </>
      ) : (
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          overflow: "hidden",
        }}>
          {/* Score row */}
          <div style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "24px 28px 20px",
            borderBottom: "1px solid var(--line)",
          }}>
            {currentScore !== undefined && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontSize: 64, fontWeight: 800, lineHeight: 1,
                  color: scoreColor, letterSpacing: "-0.04em",
                }}>
                  {currentScore}
                </span>
                <span style={{ fontSize: 18, color: "var(--ink-3)", fontWeight: 500 }}>/100</span>
                {scoreDelta !== null && (
                  <span style={{
                    fontSize: 16, fontWeight: 700,
                    color: scoreDelta > 0 ? "var(--green)" : scoreDelta < 0 ? "var(--danger)" : "var(--ink-3)",
                    marginLeft: 4,
                  }}>
                    {scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`}
                  </span>
                )}
              </div>
            )}
            <div style={{ flex: 1 }} />
            <ShareReportButton vodId={vod.id} existingToken={vod.share_token} score={currentScore} />
          </div>

          {/* Best clip */}
          {topClip ? (
            <>
              <video
                controls
                preload="metadata"
                playsInline
                style={{ width: "100%", aspectRatio: "16/9", background: "#000", display: "block" }}
              >
                <source src={topClip.video_url} type="video/mp4" />
              </video>
              <div style={{ padding: "16px 28px 20px", borderBottom: "1px solid var(--line)" }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 12px" }}>
                  {topClip.title}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <DownloadClip clipId={topClip.id} />
                  <CopyCaption caption={topClip.caption_text} />
                  <PostToYouTube clipId={topClip.id} isConnected={isYouTubeConnected} />
                  <ChangeStyleButton
                    clipId={topClip.id}
                    vodId={id}
                    peakIndex={0}
                    currentStyle={(topClip.caption_style as any) ?? "bold"}
                  />
                </div>
              </div>
            </>
          ) : hasProcessingClip ? (
            <div style={{ padding: "28px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
              <svg viewBox="0 0 24 24" fill="none" width="18" height="18" style={{ flexShrink: 0, animation: "spin 1s linear infinite", color: "var(--blue)" }}>
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28 56" strokeLinecap="round"/>
              </svg>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 2px" }}>Generating your clip...</p>
                <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0 }}>
                  This usually takes 1 to 3 minutes. Stay on this page and it will appear automatically, or{" "}
                  <Link href="/dashboard/clips" style={{ color: "var(--blue)", textDecoration: "none" }}>check the clips page</Link>.
                </p>
              </div>
            </div>
          ) : topPeak ? (
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>
                Best moment found
              </p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", margin: "0 0 6px" }}>{topPeak.title}</p>
              <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 14px", lineHeight: 1.5 }}>{topPeak.reason}</p>
              <GenerateClipButton vodId={vod.id} peakIndex={0} hasProcessing={hasProcessingClip} />
            </div>
          ) : (
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0, marginTop: 2,
                background: "color-mix(in oklab, var(--ink-3) 10%, var(--surface-2))",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
                  <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="1.6"/>
                  <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6"/>
                  <path d="M8.12 8.12L22 22M8.12 15.88L22 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 4px" }}>
                  No viral clip found this stream
                </p>
                <p style={{ fontSize: 13, color: "var(--ink-3)", margin: 0, lineHeight: 1.5 }}>
                  Your coach reviewed this stream and didn't find a moment worth clipping. Your full coaching breakdown is below.
                </p>
              </div>
            </div>
          )}

          {/* Punch line — or fallback from recommendation for older reports */}
          {punchLine ? (
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)" }}>
              <p style={{
                fontSize: 16, lineHeight: 1.6, color: "var(--ink)",
                margin: 0, fontWeight: 500,
                borderLeft: `3px solid ${scoreColor}`,
                paddingLeft: 14,
              }}>
                {punchLine}
              </p>
            </div>
          ) : coachReport?.recommendation ? (
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 10px" }}>
                Coach note
              </p>
              <p style={{
                fontSize: 15, lineHeight: 1.6, color: "var(--ink)",
                margin: 0, fontWeight: 500,
                borderLeft: `3px solid ${scoreColor}`,
                paddingLeft: 14,
              }}>
                {(coachReport.recommendation as string).replace(/ — /g, ". ").replace(/—/g, " ")}
              </p>
            </div>
          ) : null}

          {/* Recommended cuts — additional moments beyond the top clip.
              Streamers asked for a curated list to choose from instead of a
              single auto-pick. Top peak is already shown as the hero clip
              above, so we list peaks 2..N here. */}
          {peaks.length > 1 && (
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                  More moments worth clipping
                </p>
                <p style={{ fontSize: 11, color: "var(--ink-3)", margin: 0 }}>
                  {peaks.length - 1} {peaks.length - 1 === 1 ? "pick" : "picks"}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {peaks.slice(1).map((p, i) => {
                  const realIndex = i + 1;
                  const existingClip = findClipForPeak(Number(p.start));
                  const startSec = Number(p.start);
                  const mm = Math.floor(startSec / 60);
                  const ss = Math.floor(startSec % 60);
                  const ts = `${mm}:${ss.toString().padStart(2, "0")}`;
                  return (
                    <div key={`peak-${realIndex}`} style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 14px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                    }}>
                      <span className="mono" style={{
                        fontSize: 11, color: "var(--ink-3)",
                        background: "var(--surface)", padding: "3px 7px", borderRadius: 6,
                        flexShrink: 0, marginTop: 1,
                      }}>{ts}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", margin: "0 0 3px", lineHeight: 1.35 }}>
                          {p.title}
                        </p>
                        <p style={{ fontSize: 12, color: "var(--ink-3)", margin: 0, lineHeight: 1.45 }}>
                          {p.reason}
                        </p>
                      </div>
                      <div style={{ flexShrink: 0, minWidth: 110 }}>
                        {existingClip?.status === "ready" && existingClip.video_url ? (
                          <Link
                            href="/dashboard/clips"
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                          >
                            View clip <Icons.Arrow />
                          </Link>
                        ) : existingClip?.status === "processing" ? (
                          <span className="chip" style={{ fontSize: 11, opacity: 0.8 }}>Generating…</span>
                        ) : (
                          <GenerateClipButton vodId={vod.id} peakIndex={realIndex} hasProcessing={hasProcessingClip} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {coachReport?.missed_clip?.time && coachReport?.missed_clip?.note && (
                <div style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  background: "color-mix(in oklab, var(--orange, #d97706) 6%, var(--surface-2))",
                  border: "1px dashed color-mix(in oklab, var(--orange, #d97706) 35%, var(--line))",
                  borderRadius: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                    <span className="mono" style={{
                      fontSize: 11, color: "var(--orange, #d97706)", fontWeight: 700,
                    }}>
                      MISSED
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                      {coachReport.missed_clip.time}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
                    {coachReport.missed_clip.note}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Full analysis link */}
          <div style={{ padding: "16px 28px" }}>
            <Link
              href={`/dashboard/vods/${id}/report`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 0",
                borderRadius: 10,
                fontSize: 13, fontWeight: 600, textDecoration: "none",
                background: "linear-gradient(90deg, color-mix(in oklab, var(--blue) 12%, var(--surface-2)), color-mix(in oklab, var(--blue) 6%, var(--surface-2)))",
                border: "1px solid color-mix(in oklab, var(--blue) 25%, var(--line))",
                color: "var(--blue)",
                letterSpacing: "0.01em",
              }}
            >
              Full coaching breakdown <Icons.Arrow />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
