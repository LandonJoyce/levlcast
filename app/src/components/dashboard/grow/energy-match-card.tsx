"use client";

import { Sparkles, Clock } from "lucide-react";
import Link from "next/link";

interface Clip {
  id: string;
  title: string;
  video_url: string;
  peak_score: number;
  peak_category: string;
  caption_text: string;
  description: string;
}

function scoreColor(score: number) {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-muted";
}

const CATEGORY_STYLE: Record<string, string> = {
  hype: "bg-purple-500/10 text-purple-400",
  funny: "bg-yellow-500/10 text-yellow-400",
  educational: "bg-blue-500/10 text-blue-400",
  emotional: "bg-red-500/10 text-red-400",
};

export function EnergyMatchCard({ clips }: { clips: Clip[] }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-1">Viral Energy Match</h2>
          <p className="text-white font-bold">Your highest-scoring clips</p>
        </div>
        <Link
          href="/dashboard/clips"
          className="text-xs font-semibold text-accent-light hover:underline flex-shrink-0 mt-1"
        >
          See all clips →
        </Link>
      </div>
      <p className="text-xs text-muted mb-5 leading-relaxed">
        These clips are your best content — post them on TikTok first. Then stream with this same energy so new viewers recognize you.
      </p>

      <div className="space-y-3">
        {clips.map((clip, i) => (
          <div key={clip.id} className="flex items-start gap-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
            {/* Rank badge */}
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 font-extrabold text-sm
              ${i === 0 ? "bg-yellow-400/20 text-yellow-400" : i === 1 ? "bg-white/10 text-white/50" : "bg-white/5 text-white/30"}`}>
              {i + 1}
            </div>

            {/* Video thumbnail via video element */}
            <video
              src={clip.video_url}
              preload="metadata"
              muted
              className="w-20 aspect-video rounded-lg object-cover bg-black flex-shrink-0"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-sm font-semibold line-clamp-1">{clip.title}</p>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Sparkles size={11} className={scoreColor(clip.peak_score)} />
                  <span className={`text-xs font-bold ${scoreColor(clip.peak_score)}`}>
                    {Math.round(clip.peak_score * 100)}
                  </span>
                </div>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${CATEGORY_STYLE[clip.peak_category] || "bg-white/5 text-muted"}`}>
                {clip.peak_category}
              </span>
              <p className="text-[11px] text-muted mt-1.5 line-clamp-2 leading-relaxed">{clip.caption_text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-accent/[0.06] border border-accent/15 rounded-xl">
        <p className="text-xs text-white/70 leading-relaxed">
          <span className="font-semibold text-accent-light">Pro tip:</span> When new viewers land on your stream after watching a clip, they expect the same version of you. Stream like your top clips every time.
        </p>
      </div>
    </div>
  );
}
