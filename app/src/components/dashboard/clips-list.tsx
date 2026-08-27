"use client";

import { useState } from "react";
import { Sparkles, Clock } from "lucide-react";
import { CopyCaption, DownloadClip, PostToYouTube, DeleteClip, RegenerateClip } from "./clip-actions";

function categoryStyle(category: string) {
  switch (category) {
    case "hype":      return "bg-purple-500/10 text-purple-400";
    case "funny":     return "bg-yellow-500/10 text-yellow-400";
    case "emotional": return "bg-red-500/10 text-red-400";
    case "educational": return "bg-blue-500/10 text-blue-400";
    default:          return "bg-white/5 text-muted";
  }
}

function scoreColor(score: number) {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-muted";
}

interface ClipRow {
  id: string;
  vod_id: string;
  title: string;
  video_url: string;
  caption_text: string;
  peak_score: number;
  peak_category: string;
  duration_seconds: number | null;
  start_time_seconds: number;
  failed_reason?: string | null;
}

export function ReadyClipsList({
  clips,
  isYouTubeConnected,
  ytPostMap,
}: {
  clips: ClipRow[];
  isYouTubeConnected: boolean;
  ytPostMap: Record<string, string | null>;
}) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visible = clips.filter((c) => !hiddenIds.has(c.id));

  if (visible.length === 0) return null;

  return (
    <div className="mb-10">
      <h2 className="text-base font-bold text-white mb-4">
        Generated Clips <span className="text-sm font-medium text-muted">({visible.length})</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visible.map((clip) => (
          <div key={clip.id} className="bg-surface border border-border rounded-2xl overflow-hidden surface-hover">
            <video controls preload="metadata" playsInline className="w-full aspect-video bg-black">
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
                  {clip.duration_seconds ?? "?"}s
                </span>
              </div>
              <div className="bg-bg/50 rounded-lg px-3 py-2 mb-3">
                <p className="text-xs text-muted leading-relaxed line-clamp-3">{clip.caption_text}</p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-auto">
                <DownloadClip clipId={clip.id} />
                <CopyCaption caption={clip.caption_text} />
                <PostToYouTube
                  clipId={clip.id}
                  isConnected={isYouTubeConnected}
                  existingUrl={ytPostMap[clip.id] ?? null}
                />
                <RegenerateClip
                  clipId={clip.id}
                  vodId={clip.vod_id}
                  startSeconds={clip.start_time_seconds}
                  onRegenerated={() => setHiddenIds((s) => new Set([...s, clip.id]))}
                />
                <DeleteClip
                  clipId={clip.id}
                  onDeleted={() => setHiddenIds((s) => new Set([...s, clip.id]))}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FailedClipsList({ clips }: { clips: ClipRow[] }) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visible = clips.filter((c) => !hiddenIds.has(c.id));

  if (visible.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold text-white/60 mb-4">Failed ({visible.length})</h2>
      <div className="space-y-3">
        {visible.map((clip) => (
          <div key={clip.id} className="bg-surface border border-red-500/20 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{clip.title}</p>
              <p className="text-xs text-red-400 mt-0.5">
                {clip.failed_reason || "Generation failed. Regenerate or delete."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <RegenerateClip
                clipId={clip.id}
                vodId={clip.vod_id}
                startSeconds={clip.start_time_seconds}
                onRegenerated={() => setHiddenIds((s) => new Set([...s, clip.id]))}
              />
              <DeleteClip
                clipId={clip.id}
                onDeleted={() => setHiddenIds((s) => new Set([...s, clip.id]))}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
