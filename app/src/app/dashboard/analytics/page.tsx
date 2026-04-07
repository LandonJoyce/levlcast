import { createClient } from "@/lib/supabase/server";
import { FollowerTrend } from "@/components/dashboard/follower-trend";
import { formatDuration } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  hype: "Hype",
  funny: "Comedy",
  educational: "Educational",
  emotional: "Emotional",
  clutch_play: "Clutch Plays",
  rage: "Rage",
  wholesome: "Wholesome",
};

const CATEGORY_COLORS: Record<string, string> = {
  hype: "#f97316",
  funny: "#facc15",
  educational: "#3b82f6",
  emotional: "#ec4899",
  clutch_play: "#10b981",
  rage: "#ef4444",
  wholesome: "#a78bfa",
};

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [vodsData, clipsResult, snapshotsResult] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, duration_seconds, peak_data, coach_report, status, stream_date")
      .eq("user_id", user!.id)
      .order("stream_date", { ascending: false }),
    supabase
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "ready"),
    supabase
      .from("follower_snapshots")
      .select("follower_count, snapped_at")
      .eq("user_id", user!.id)
      .eq("platform", "twitch")
      .order("snapped_at", { ascending: true })
      .limit(30),
  ]);

  const vods = vodsData.data || [];
  const totalClips = clipsResult.count || 0;
  const snapshots = snapshotsResult.data || [];

  const analyzedVods = vods.filter((v) => v.status === "ready");
  const totalStreamMinutes = Math.round(vods.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / 60);

  let totalPeaks = 0;
  const categoryCount: Record<string, number> = {};
  for (const vod of analyzedVods) {
    const peaks = (vod.peak_data as Array<{ score: number; category: string }>) || [];
    totalPeaks += peaks.length;
    for (const p of peaks) {
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    }
  }

  const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
  const topCategory = sortedCategories.length > 0 ? sortedCategories[0][0] : null;

  const coachScores = analyzedVods
    .filter((v) => v.coach_report && (v.coach_report as any).overall_score)
    .slice(0, 8)
    .reverse()
    .map((v) => ({
      id: v.id,
      title: v.title || "Stream",
      date: v.stream_date,
      score: (v.coach_report as any).overall_score as number,
      peaks: ((v.peak_data as any[]) || []).length,
      duration: v.duration_seconds || 0,
    }));

  const latestScore = coachScores.length > 0 ? coachScores[coachScores.length - 1].score : null;
  const avgScore = coachScores.length > 0 ? Math.round(coachScores.reduce((s, c) => s + c.score, 0) / coachScores.length) : null;
  const scoreTrend = coachScores.length >= 2
    ? coachScores[coachScores.length - 1].score - coachScores[coachScores.length - 2].score
    : null;

  const isEmpty = vods.length === 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Analytics</h1>
        <p className="text-sm text-muted">Your streaming story, by the numbers.</p>
      </div>

      {isEmpty ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm">Sync and analyze some VODs to see your analytics here.</p>
        </div>
      ) : (
        <>
          {/* Top summary — one flowing line of context */}
          <div className="mb-8 px-1">
            <p className="text-sm text-white/70 leading-relaxed">
              {analyzedVods.length > 0 ? (
                <>
                  You've analyzed <span className="text-white font-semibold">{analyzedVods.length}</span> stream{analyzedVods.length !== 1 ? "s" : ""} totaling <span className="text-white font-semibold">{totalStreamMinutes >= 60 ? `${Math.floor(totalStreamMinutes / 60)}h ${totalStreamMinutes % 60}m` : `${totalStreamMinutes}m`}</span>.
                  {avgScore !== null && <>{" "}Your average quality score is <span className={`font-semibold ${avgScore >= 70 ? "text-green-400" : avgScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>{avgScore}</span>.</>}
                  {topCategory && <>{" "}Most of your peaks are <span className="text-white font-semibold">{(CATEGORY_LABELS[topCategory] || topCategory).toLowerCase()}</span> moments.</>}
                </>
              ) : (
                <>You've synced {vods.length} VOD{vods.length !== 1 ? "s" : ""} but haven't analyzed any yet. Head to your VODs to get started.</>
              )}
            </p>
          </div>

          {/* Follower Growth — hero position */}
          <div className="mb-6">
            <FollowerTrend snapshots={snapshots} needsReconnect={false} />
          </div>

          {/* Stream Quality Trend */}
          {coachScores.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-6 mb-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Stream Quality</h2>
                {scoreTrend !== null && scoreTrend !== 0 && (
                  <span className={`text-xs font-semibold ${scoreTrend > 0 ? "text-green-400" : "text-red-400"}`}>
                    {scoreTrend > 0 ? "+" : ""}{scoreTrend} from last stream
                  </span>
                )}
              </div>

              {/* Score timeline */}
              <div className="flex items-end gap-2">
                {coachScores.map((c, i) => {
                  const isLatest = i === coachScores.length - 1;
                  const barColor = c.score >= 70 ? "bg-green-400" : c.score >= 50 ? "bg-yellow-400" : "bg-red-400";
                  const maxHeight = 80;
                  const height = Math.max(8, (c.score / 100) * maxHeight);

                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/vods/${c.id}`}
                      className="flex-1 group flex flex-col items-center gap-2"
                    >
                      <span className={`text-xs font-bold transition-opacity ${isLatest ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${c.score >= 70 ? "text-green-400" : c.score >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                        {c.score}
                      </span>
                      <div className="w-full flex items-end" style={{ height: `${maxHeight}px` }}>
                        <div
                          className={`w-full rounded-md transition-opacity ${barColor} ${isLatest ? "opacity-100" : "opacity-25 group-hover:opacity-60"}`}
                          style={{ height: `${height}px` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted truncate w-full text-center">
                        {new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Peak Categories — visual blocks */}
          {sortedCategories.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface p-6 mb-6">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-5">What your audience reacts to</h2>
              <div className="flex flex-wrap gap-2">
                {sortedCategories.map(([cat, count]) => {
                  const label = CATEGORY_LABELS[cat] || cat;
                  const color = CATEGORY_COLORS[cat] || "#a78bfa";
                  const pct = Math.round((count / totalPeaks) * 100);
                  return (
                    <div
                      key={cat}
                      className="rounded-xl px-4 py-3 border border-white/5"
                      style={{ backgroundColor: `${color}10`, borderColor: `${color}30` }}
                    >
                      <span className="text-sm font-bold text-white">{label}</span>
                      <span className="text-xs text-muted ml-2">{pct}%</span>
                      <span className="text-xs text-white/30 ml-1">({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Streams */}
          {analyzedVods.length > 0 && (
            <div className="rounded-2xl border border-white/[0.06] bg-surface p-6">
              <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Recent Streams</h2>
              <div className="space-y-1">
                {analyzedVods.slice(0, 10).map((vod) => {
                  const peaks = (vod.peak_data as Array<{ score: number; category: string }>) || [];
                  const coachScore = vod.coach_report ? (vod.coach_report as any).overall_score : null;
                  const scoreColor = coachScore === null ? "text-muted" : coachScore >= 70 ? "text-green-400" : coachScore >= 50 ? "text-yellow-400" : "text-red-400";
                  const topCat = peaks.length > 0 ? mostCommon(peaks.map(p => p.category)) : null;

                  return (
                    <Link
                      key={vod.id}
                      href={`/dashboard/vods/${vod.id}`}
                      className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0 mr-4 flex-1">
                        <p className="text-sm font-medium truncate text-white/90">{vod.title}</p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatDuration(vod.duration_seconds)} · {peaks.length} peak{peaks.length !== 1 ? "s" : ""}
                          {topCat && ` · ${CATEGORY_LABELS[topCat] || topCat}`}
                        </p>
                      </div>
                      {coachScore !== null && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Sparkles size={12} className={scoreColor} />
                          <span className={`text-sm font-bold ${scoreColor}`}>{coachScore}</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compact stats footer */}
          <div className="flex items-center gap-6 px-1 mt-6 text-xs text-muted">
            <span>{vods.length} VOD{vods.length !== 1 ? "s" : ""} synced</span>
            <span>{analyzedVods.length} analyzed</span>
            <span>{totalPeaks} peaks</span>
            <span>{totalClips} clips</span>
          </div>
        </>
      )}
    </div>
  );
}

function mostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
