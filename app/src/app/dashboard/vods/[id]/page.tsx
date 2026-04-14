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
import { ArrowLeft, Calendar, Clock, Film, Loader2, Scissors, Sparkles, VolumeX } from "lucide-react";

function scoreColor(score: number) {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-muted";
}

export default async function VodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: vod }, { data: allClips }, { data: connections }, { data: prevVod }, { data: recentVods }] = await Promise.all([
    supabase
      .from("vods")
      .select("*, share_token")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single(),
    supabase
      .from("clips")
      .select("*")
      .eq("user_id", user!.id)
      .eq("vod_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("social_connections")
      .select("platform")
      .eq("user_id", user!.id),
    supabase
      .from("vods")
      .select("coach_report")
      .eq("user_id", user!.id)
      .eq("status", "ready")
      .neq("id", id)
      .order("stream_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vods")
      .select("status")
      .eq("user_id", user!.id)
      .order("stream_date", { ascending: false })
      .limit(20),
  ]);

  if (!vod) notFound();

  const peaks = (vod.peak_data as any[]) || [];
  const coachReport = vod.coach_report as any;
  const previousScore = (prevVod?.coach_report as any)?.overall_score as number | undefined;

  // Count consecutive analyzed streams (streak)
  let streak = 0;
  for (const v of (recentVods ?? [])) {
    if (v.status === "ready") streak++;
    else break;
  }

  const isVodProcessing = vod.status === "transcribing" || vod.status === "analyzing";

  const readyClips = (allClips || []).filter((c) => c.status === "ready");
  const processingClips = (allClips || []).filter((c) => c.status === "processing");
  const failedClips = (allClips || []).filter((c) => c.status === "failed");
  const hasProcessingClip = processingClips.length > 0;

  // Build a set of peak start times that already have a ready/processing clip
  const claimedStarts = new Set(
    (allClips || [])
      .filter((c) => c.status === "ready" || c.status === "processing")
      .map((c) => c.start_time_seconds)
  );

  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;

  return (
    <div>
      <VodStatusPoller hasProcessing={isVodProcessing || hasProcessingClip} />

      {/* Back + Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/vods"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-white transition-colors mb-4"
        >
          <ArrowLeft size={14} />
          Back to VODs
        </Link>
        <div className="flex gap-4 items-start">
          {vod.thumbnail_url && (
            <div className="relative flex-shrink-0 w-40 aspect-video rounded-xl overflow-hidden bg-bg">
              <img src={vod.thumbnail_url} alt={vod.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight mb-2 leading-snug">{vod.title}</h1>
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} />
                {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {formatDuration(vod.duration_seconds)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {vod.status !== "ready" ? (
        <div>
          {isVodProcessing ? (
            <VodProgress status={vod.status} durationSeconds={vod.duration_seconds} />
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-10 text-center">
              <Film size={24} className="text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">
                {vod.status === "pending"
                  ? "This VOD hasn't been analyzed yet. Go back and click Analyze."
                  : `Analysis failed${vod.failed_reason ? `: ${vod.failed_reason}` : ""}. Go back and try analyzing again.`}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Share button */}
          <div className="flex justify-end">
            <ShareReportButton vodId={vod.id} existingToken={vod.share_token} />
          </div>

          {/* Coach Report */}
          {coachReport ? (
            <CoachReportCard report={coachReport} previousScore={previousScore} streak={streak} />
          ) : (
            <div className="bg-surface border border-border rounded-2xl p-6 text-sm text-muted">
              Coach report not available for this VOD. Re-analyze to generate one.
            </div>
          )}

          {/* Dead Zones */}
          {coachReport?.dead_zones && coachReport.dead_zones.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <VolumeX size={14} className="text-red-400" />
                <h2 className="text-sm font-bold text-white">Silence Gaps</h2>
                <span className="text-xs text-muted ml-1">— moments where energy dropped off</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(coachReport.dead_zones as Array<{ time: string; duration: number }>).map((zone, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5">
                    <span className="text-xs font-semibold text-red-400">{zone.time}</span>
                    <span className="text-xs text-muted">{zone.duration}s gap</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Clips for this VOD */}
          {(readyClips.length > 0 || processingClips.length > 0 || failedClips.length > 0) && (
            <div>
              <h2 className="text-base font-bold mb-3">
                Generated Clips ({readyClips.length})
              </h2>

              {/* Processing */}
              {processingClips.map((clip) => (
                <div key={clip.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 mb-3">
                  <Loader2 size={16} className="animate-spin text-accent-light flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{clip.title}</p>
                    <p className="text-xs text-muted mt-0.5">Generating — this page will update automatically.</p>
                  </div>
                </div>
              ))}

              {/* Failed */}
              {failedClips.map((clip) => (
                <div key={clip.id} className="bg-surface border border-red-500/20 rounded-2xl p-4 flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold">{clip.title}</p>
                    <p className="text-xs text-red-400 mt-0.5">Generation failed — delete and try again.</p>
                  </div>
                  <DeleteClip clipId={clip.id} />
                </div>
              ))}

              {/* Ready */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {readyClips.map((clip) => (
                  <div key={clip.id} className="bg-surface border border-border rounded-2xl overflow-hidden">
                    <video controls preload="metadata" playsInline className="w-full aspect-video bg-black"><source src={clip.video_url} type="video/mp4" /></video>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-sm line-clamp-2">{clip.title}</h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Sparkles size={12} className={scoreColor(clip.peak_score)} />
                          <span className={`text-sm font-bold ${scoreColor(clip.peak_score)}`}>
                            {Math.round(clip.peak_score * 100)}
                          </span>
                        </div>
                      </div>
                      <div className="bg-bg/50 rounded-lg px-3 py-2 mb-3">
                        <p className="text-xs text-muted line-clamp-3">{clip.caption_text}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <DownloadClip url={clip.video_url} title={clip.title} />
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

          {/* Post nudge — shown when clips are ready */}
          {readyClips.length > 0 && (
            <div className="flex items-center justify-between gap-4 bg-accent/[0.06] border border-accent/20 rounded-xl px-4 py-3">
              <p className="text-sm text-white/80">
                <span className="font-semibold text-white">{readyClips.length} clip{readyClips.length !== 1 ? "s" : ""} ready.</span>
                {" "}Head to Clips to post them to YouTube or TikTok.
              </p>
              <Link href="/dashboard/clips" className="text-xs font-semibold text-accent-light hover:opacity-80 transition-opacity flex-shrink-0">
                Go to Clips →
              </Link>
            </div>
          )}

          {/* Peak Moments */}
          {peaks.length > 0 && (
            <div>
              <h2 className="text-base font-bold mb-3">
                Clip Moments ({peaks.length})
              </h2>
              <div className="space-y-3">
                {peaks.map((peak: any, i: number) => {
                  const alreadyClaimed = claimedStarts.has(Math.round(peak.start));
                  return (
                    <div key={i} className="bg-surface border border-border rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="font-semibold text-sm">{peak.title}</h3>
                        <span className="flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent-light capitalize">
                          {peak.category}
                        </span>
                      </div>
                      <p className="text-xs text-muted mb-2">{peak.reason}</p>
                      {peak.hook && (
                        <p className="text-xs text-accent-light/80 bg-accent/5 border border-accent/15 rounded-lg px-3 py-1.5 mb-3">
                          Hook: {peak.hook}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span>{formatDuration(peak.start)} – {formatDuration(peak.end)}</span>
                          <span className="text-accent-light font-medium">Score {Math.round(peak.score * 100)}</span>
                        </div>
                        {alreadyClaimed ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium">
                            <Scissors size={12} />
                            Clip generated
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
        </div>
      )}
    </div>
  );
}
