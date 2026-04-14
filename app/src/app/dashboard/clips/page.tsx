import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/utils";
import { GenerateClipButton } from "@/components/dashboard/generate-clip-button";
import { CopyCaption, DownloadClip, PostToYouTube, PostToTikTok, DeleteClip } from "@/components/dashboard/clip-actions";
import { VodStatusPoller } from "@/components/dashboard/vod-status-poller";
import { Scissors, Sparkles, Clock, Film, Loader2, Link2 } from "lucide-react";
import Link from "next/link";

interface Peak {
  title: string;
  start: number;
  end: number;
  score: number;
  category: string;
  reason: string;
  caption: string;
}

function categoryStyle(category: string) {
  switch (category) {
    case "hype":
      return "bg-purple-500/10 text-purple-400";
    case "funny":
      return "bg-yellow-500/10 text-yellow-400";
    case "emotional":
      return "bg-red-500/10 text-red-400";
    case "educational":
      return "bg-blue-500/10 text-blue-400";
    default:
      return "bg-white/5 text-muted";
  }
}

function scoreColor(score: number) {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-muted";
}

export default async function ClipsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get generated clips (ready) and in-progress ones (processing) so we can
  // correctly track which peaks are already claimed and avoid showing them as available
  const { data: allClips } = await supabase
    .from("clips")
    .select("*")
    .eq("user_id", user!.id)
    .in("status", ["ready", "processing", "failed"])
    .order("created_at", { ascending: false });

  const clips = (allClips || []).filter((c) => c.status === "ready");
  const processingClips = (allClips || []).filter((c) => c.status === "processing");
  const failedClips = (allClips || []).filter((c) => c.status === "failed");
  const hasProcessing = processingClips.length > 0;

  // Get social connections
  const { data: connections } = await supabase
    .from("social_connections")
    .select("platform")
    .eq("user_id", user!.id);

  const isYouTubeConnected = connections?.some((c) => c.platform === "youtube") ?? false;
  // Get existing social posts for these clips
  const clipIds = (clips || []).map((c) => c.id);
  const { data: socialPosts } = clipIds.length > 0
    ? await supabase.from("social_posts").select("clip_id, platform, platform_url, platform_video_id").eq("user_id", user!.id).in("clip_id", clipIds)
    : { data: [] };

  const ytPostMap = new Map((socialPosts || []).filter((p) => p.platform === "youtube").map((p) => [p.clip_id, p.platform_url]));
  const ttPostMap = new Map((socialPosts || []).filter((p) => p.platform === "tiktok").map((p) => [p.clip_id, p.platform_video_id]));

  // Get analyzed VODs with peaks (for ungenerated peaks)
  const { data: vods } = await supabase
    .from("vods")
    .select("id, title, twitch_vod_id, thumbnail_url, peak_data, duration_seconds")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .not("peak_data", "is", null)
    .order("stream_date", { ascending: false });

  // Flatten ungenerated peaks
  const generatedKeys = new Set(
    (allClips || []).map((c) => `${c.vod_id}-${c.start_time_seconds}`)
  );

  const ungeneratedPeaks: (Peak & { vodTitle: string; vodId: string; vodThumbnail: string; peakIndex: number })[] = [];

  for (const vod of vods || []) {
    const peaks = (vod.peak_data as Peak[]) || [];
    for (let pi = 0; pi < peaks.length; pi++) {
      const key = `${vod.id}-${Math.round(peaks[pi].start)}`;
      if (!generatedKeys.has(key)) {
        ungeneratedPeaks.push({
          ...peaks[pi],
          vodTitle: vod.title,
          vodId: vod.id,
          vodThumbnail: vod.thumbnail_url,
          peakIndex: pi,
        });
      }
    }
  }

  ungeneratedPeaks.sort((a, b) => b.score - a.score);

  const hasContent = (clips?.length || 0) > 0 || ungeneratedPeaks.length > 0 || failedClips.length > 0 || processingClips.length > 0;

  return (
    <div>
      <VodStatusPoller hasProcessing={hasProcessing} />

      <div className="mb-8">
        <span className="inline-flex items-center bg-white/[0.04] border border-white/[0.08] text-muted/70 text-[11px] font-medium px-3 py-1 rounded-full mb-3 block w-fit">Clip moments</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-1">Clips</h1>
        <p className="text-sm text-muted">
          Your best moments, ready to post.
        </p>
      </div>

      {/* Nudge to connect social if no connections and there are clips */}
      {hasContent && !isYouTubeConnected && (connections?.length ?? 0) === 0 && (
        <div className="flex items-center justify-between gap-4 bg-accent/[0.06] border border-accent/20 rounded-xl px-4 py-3 mb-6">
          <div className="flex items-center gap-2.5">
            <Link2 size={14} className="text-accent-light flex-shrink-0" />
            <p className="text-sm text-white/80">Connect YouTube or TikTok to post your clips directly.</p>
          </div>
          <Link
            href="/dashboard/connections"
            className="text-xs font-semibold text-accent-light hover:opacity-80 transition-opacity flex-shrink-0"
          >
            Connect →
          </Link>
        </div>
      )}

      {!hasContent ? (
        <div className="bg-surface border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
            <Scissors size={24} className="text-accent-light" />
          </div>
          <h2 className="text-xl font-bold mb-2">No clips yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto mb-6">
            Analyze a VOD to detect peak moments. Each peak becomes a potential clip.
          </p>
          <Link
            href="/dashboard/vods"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-xl transition-opacity text-sm"
          >
            <Film size={15} />
            Go to VODs
          </Link>
        </div>
      ) : (
        <>
          {/* Processing clips */}
          {hasProcessing && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-white/60 mb-4">
                Generating ({processingClips.length})
              </h2>
              <div className="space-y-3">
                {processingClips.map((clip) => (
                  <div key={clip.id} className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
                    <Loader2 size={18} className="animate-spin text-accent-light flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">{clip.title}</p>
                      <p className="text-xs text-muted mt-0.5">Processing in background — this page will update automatically.</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed clips */}
          {failedClips.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-bold text-white/60 mb-4">
                Failed ({failedClips.length})
              </h2>
              <div className="space-y-3">
                {failedClips.map((clip) => (
                  <div key={clip.id} className="bg-surface border border-red-500/20 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm">{clip.title}</p>
                      <p className="text-xs text-red-400 mt-0.5">Generation failed — delete and try again from the peak below.</p>
                    </div>
                    <DeleteClip clipId={clip.id} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated clips */}
          {clips && clips.length > 0 && (
            <div className="mb-10">
              <h2 className="text-base font-bold text-white mb-4">
                Generated Clips <span className="text-sm font-medium text-muted">({clips.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="bg-surface border border-border rounded-2xl overflow-hidden surface-hover"
                  >
                    {/* Video player */}
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      className="w-full aspect-video bg-black"
                    >
                      <source src={clip.video_url} type="video/mp4" />
                    </video>

                    <div className="p-4 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-sm line-clamp-2 leading-snug">{clip.title}</h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Sparkles size={12} className={scoreColor(clip.peak_score)} />
                          <span className={`text-sm font-bold ${scoreColor(clip.peak_score)}`}>
                            {Math.round(clip.peak_score * 100)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${categoryStyle(clip.peak_category)}`}>
                          {clip.peak_category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted flex-shrink-0">
                          <Clock size={11} />
                          {clip.duration_seconds ?? "—"}s
                        </span>
                      </div>

                      {/* Caption */}
                      <div className="bg-bg/50 rounded-lg px-3 py-2 mb-3">
                        <p className="text-xs text-muted leading-relaxed line-clamp-3">{clip.caption_text}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-auto">
                        <DownloadClip url={clip.video_url} title={clip.title} />
                        <CopyCaption caption={clip.caption_text} />
                        <PostToYouTube
                          clipId={clip.id}
                          isConnected={isYouTubeConnected}
                          existingUrl={ytPostMap.get(clip.id)}
                        />
                        <PostToTikTok />
                        <DeleteClip clipId={clip.id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ungenerated peaks */}
          {ungeneratedPeaks.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-white mb-4">
                Detected Peaks <span className="text-sm font-medium text-muted">({ungeneratedPeaks.length})</span>
              </h2>
              <div className="space-y-3">
                {ungeneratedPeaks.map((peak, i) => (
                  <div
                    key={`${peak.vodId}-${peak.start}-${i}`}
                    className="bg-surface border border-border rounded-2xl p-5 surface-hover"
                  >
                    <div className="flex items-start gap-4">
                      <div className="relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-bg">
                        {peak.vodThumbnail ? (
                          <img
                            src={peak.vodThumbnail}
                            alt={peak.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film size={16} className="text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-bold text-sm">{peak.title}</h3>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Sparkles size={13} className={scoreColor(peak.score)} />
                            <span className={`text-sm font-bold ${scoreColor(peak.score)}`}>
                              {Math.round(peak.score * 100)}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-muted mb-3">{peak.reason}</p>

                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${categoryStyle(peak.category)}`}>
                            {peak.category}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted">
                            <Clock size={11} />
                            {formatDuration(Math.round(peak.start))} - {formatDuration(Math.round(peak.end))}
                          </span>
                          <span className="text-xs text-muted">
                            {formatDuration(Math.round(peak.end - peak.start))} clip
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted/50">from: {peak.vodTitle}</p>
                          <GenerateClipButton vodId={peak.vodId} peakIndex={peak.peakIndex} hasProcessing={hasProcessing} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
