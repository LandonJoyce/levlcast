import { createClient } from "@/lib/supabase/server";
import { ArchetypeCard } from "@/components/dashboard/grow/archetype-card";
import { ConsistencyGrid } from "@/components/dashboard/grow/consistency-grid";
import { TacticsCarousel } from "@/components/dashboard/grow/tactics-carousel";
import { TrendingUp, Sparkles } from "lucide-react";
import Link from "next/link";

interface Peak {
  category: string;
  score: number;
  title: string;
  caption: string;
}

const CATEGORY_STYLE: Record<string, string> = {
  hype: "bg-purple-500/10 text-purple-400",
  funny: "bg-yellow-500/10 text-yellow-400",
  educational: "bg-blue-500/10 text-blue-400",
  emotional: "bg-red-500/10 text-red-400",
};

function scoreColor(score: number) {
  if (score >= 0.7) return "text-green-400";
  if (score >= 0.4) return "text-yellow-400";
  return "text-muted";
}

export default async function GrowPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: vods } = await supabase
    .from("vods")
    .select("id, title, stream_date, peak_data")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .not("peak_data", "is", null)
    .order("stream_date", { ascending: false });

  const { data: topClips } = await supabase
    .from("clips")
    .select("id, title, video_url, peak_score, peak_category, caption_text")
    .eq("user_id", user!.id)
    .eq("status", "ready")
    .order("peak_score", { ascending: false })
    .limit(5);

  const categoryCounts: Record<string, number> = { hype: 0, funny: 0, educational: 0, emotional: 0 };
  for (const vod of vods || []) {
    const peaks = (vod.peak_data as Peak[]) || [];
    for (const peak of peaks) {
      const cat = peak.category?.toLowerCase();
      if (cat && cat in categoryCounts) categoryCounts[cat]++;
    }
  }

  const totalPeaks = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const dominantCategory = totalPeaks > 0
    ? Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const streamDates = new Set(
    (vods || []).map((v) => v.stream_date?.slice(0, 10)).filter(Boolean)
  );

  const hasData = totalPeaks > 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Growth Playbook</h1>
        <p className="text-sm text-muted">Personalized tactics based on your actual stream data.</p>
      </div>

      {!hasData ? (
        <div className="bg-surface border border-border rounded-2xl p-16 text-center">
          <TrendingUp size={28} className="text-muted mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Analyze a VOD first</h2>
          <p className="text-sm text-muted max-w-sm mx-auto mb-6">Your Growth Playbook is built from real stream data.</p>
          <Link href="/dashboard/vods" className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-5 py-2.5 rounded-xl transition-opacity text-sm">
            Go to VODs
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Archetype full width */}
          <ArchetypeCard dominantCategory={dominantCategory} categoryCounts={categoryCounts} totalPeaks={totalPeaks} />

          {/* Two col — clips + tactics */}
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">

            {/* Top clips */}
            {topClips && topClips.length > 0 && (
              <div className="bg-surface border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h2 className="text-sm font-bold text-white">Your Best Clips</h2>
                    <p className="text-xs text-muted mt-0.5">Post these on TikTok, YouTube Shorts, and Kick first</p>
                  </div>
                  <Link href="/dashboard/clips" className="text-xs font-semibold text-accent-light hover:underline">See all →</Link>
                </div>
                <div className="divide-y divide-border">
                  {topClips.map((clip, i) => (
                    <div key={clip.id} className="flex items-center gap-4 px-5 py-3">
                      <span className={`text-xs font-bold w-5 text-center flex-shrink-0 ${i === 0 ? "text-yellow-400" : "text-muted/40"}`}>
                        {i + 1}
                      </span>
                      <video src={clip.video_url} preload="metadata" muted className="w-16 aspect-video rounded bg-black flex-shrink-0 object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{clip.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${CATEGORY_STYLE[clip.peak_category] || "bg-white/5 text-muted"}`}>
                            {clip.peak_category}
                          </span>
                          <span className="text-xs text-muted line-clamp-1">{clip.caption_text}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Sparkles size={11} className={scoreColor(clip.peak_score)} />
                        <span className={`text-sm font-bold ${scoreColor(clip.peak_score)}`}>{Math.round(clip.peak_score * 100)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3 border-t border-border bg-white/[0.02]">
                  <p className="text-xs text-muted leading-relaxed">
                    When someone finds your clip on TikTok and comes to Twitch, they expect that same version of you. Stream like your top clips every time.
                  </p>
                </div>
              </div>
            )}

            {/* Tactics carousel */}
            <TacticsCarousel />
          </div>

          {/* Consistency grid full width */}
          <ConsistencyGrid streamDates={streamDates} />
        </div>
      )}
    </div>
  );
}

