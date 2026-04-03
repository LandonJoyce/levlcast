import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { FollowerTrend } from "@/components/dashboard/follower-trend";
import { formatDuration } from "@/lib/utils";
import { Film, Scissors, Sparkles, Clock, TrendingUp } from "lucide-react";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [vodsResult, clipsResult, vodsData, snapshotsResult] = await Promise.all([
    supabase
      .from("vods")
      .select("id, status, duration_seconds, peak_data", { count: "exact" })
      .eq("user_id", user!.id),
    supabase
      .from("clips")
      .select("id, peak_score, peak_category, duration_seconds, created_at", { count: "exact" })
      .eq("user_id", user!.id)
      .eq("status", "ready"),
    supabase
      .from("vods")
      .select("id, title, duration_seconds, peak_data, coach_report, status, stream_date")
      .eq("user_id", user!.id)
      .order("stream_date", { ascending: false }),
    supabase
      .from("follower_snapshots")
      .select("follower_count, snapped_at")
      .eq("user_id", user!.id)
      .eq("platform", "twitch")
      .order("snapped_at", { ascending: true })
      .limit(30),
  ]);

  const totalVods = vodsResult.count || 0;
  const totalClips = clipsResult.count || 0;
  const vods = vodsData.data || [];
  const clips = clipsResult.data || [];
  const snapshots = snapshotsResult.data || [];

  const analyzedVods = vods.filter((v) => v.status === "ready");
  const totalStreamMinutes = vods.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / 60;

  let totalPeaks = 0;
  let avgScore = 0;
  const categoryCount: Record<string, number> = {};

  for (const vod of analyzedVods) {
    const peaks = (vod.peak_data as Array<{ score: number; category: string }>) || [];
    totalPeaks += peaks.length;
    for (const p of peaks) {
      avgScore += p.score;
      categoryCount[p.category] = (categoryCount[p.category] || 0) + 1;
    }
  }

  if (totalPeaks > 0) avgScore = avgScore / totalPeaks;

  const totalClipSeconds = clips.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  const coachScores = analyzedVods
    .filter((v) => v.coach_report && (v.coach_report as any).overall_score)
    .slice(0, 5)
    .reverse()
    .map((v) => ({
      title: v.title || "Stream",
      date: v.stream_date,
      score: (v.coach_report as any).overall_score as number,
    }));

  const latestScore = coachScores.length > 0 ? coachScores[coachScores.length - 1].score : null;
  const scoreColor =
    latestScore === null ? "text-muted" :
    latestScore >= 75 ? "text-green-400" :
    latestScore >= 50 ? "text-yellow-400" : "text-red-400";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">Analytics</h1>
        <p className="text-sm text-muted">Track your growth and what&apos;s driving it.</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total VODs"
          value={totalVods.toString()}
          detail={`${analyzedVods.length} analyzed`}
          icon={<Film size={14} />}
        />
        <StatCard
          label="Peaks Detected"
          value={totalPeaks.toString()}
          detail={totalPeaks > 0 ? `${Math.round(avgScore * 100)} avg score` : "Analyze a VOD"}
          icon={<Sparkles size={14} />}
        />
        <StatCard
          label="Clips Generated"
          value={totalClips.toString()}
          detail={totalClipSeconds > 0 ? `${formatDuration(totalClipSeconds)} total` : "Generate from peaks"}
          icon={<Scissors size={14} />}
        />
        <StatCard
          label="Stream Time"
          value={`${Math.round(totalStreamMinutes)}m`}
          detail={`${totalVods} streams synced`}
          icon={<Clock size={14} />}
          accent
        />
      </div>

      {/* Follower trend + Stream quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <FollowerTrend snapshots={snapshots} needsReconnect={false} />

        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-4">Stream Quality</h2>
          {coachScores.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              Analyze a VOD to see your stream quality score.
            </p>
          ) : (
            <div className="flex items-start gap-6">
              <div className="shrink-0">
                <p className={`text-4xl font-extrabold ${scoreColor}`}>{latestScore}</p>
                <p className="text-xs text-muted mt-0.5">/100</p>
              </div>
              {coachScores.length > 1 && (
                <div className="flex-1 flex items-end gap-2 h-16">
                  {coachScores.map((c, i) => {
                    const isLatest = i === coachScores.length - 1;
                    const barColor = c.score >= 75 ? "bg-green-400" : c.score >= 50 ? "bg-yellow-400" : "bg-red-400";
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end" style={{ height: "48px" }}>
                          <div
                            className={`w-full rounded-t-sm ${barColor} ${isLatest ? "" : "opacity-35"}`}
                            style={{ height: `${(c.score / 100) * 48}px` }}
                            title={`${c.title}: ${c.score}/100`}
                          />
                        </div>
                        <span className="text-xs text-muted truncate w-full text-center">
                          {new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline + Peak categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-5">Pipeline</h2>
          <div className="space-y-4">
            <PipelineRow icon={<Film size={15} />} label="VODs Synced" value={totalVods} color="text-accent-light" />
            <PipelineRow icon={<Sparkles size={15} />} label="VODs Analyzed" value={analyzedVods.length} color="text-yellow-400" />
            <PipelineRow icon={<TrendingUp size={15} />} label="Peaks Found" value={totalPeaks} color="text-green-400" />
            <PipelineRow icon={<Scissors size={15} />} label="Clips Generated" value={totalClips} color="text-purple-400" />
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-5">Peak Categories</h2>
          {Object.keys(categoryCount).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(categoryCount)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between gap-4">
                    <span className="text-sm capitalize w-24 shrink-0">{cat}</span>
                    <div className="flex-1 h-2 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full" style={{ width: `${(count / totalPeaks) * 100}%` }} />
                    </div>
                    <span className="text-sm font-bold text-muted w-4 text-right shrink-0">{count}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Analyze VODs to see category breakdown.</p>
          )}
        </div>
      </div>

      {/* Stream history */}
      {analyzedVods.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-5">Stream History</h2>
          <div className="space-y-1">
            {analyzedVods.map((vod) => {
              const peaks = (vod.peak_data as Array<{ score: number }>) || [];
              const bestScore = peaks.length > 0 ? Math.max(...peaks.map((p) => p.score)) : 0;
              const coachScore = vod.coach_report ? (vod.coach_report as any).overall_score : null;
              const isGood = bestScore >= 0.7;
              return (
                <div key={vod.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="min-w-0 mr-4">
                    <p className="text-sm font-medium truncate">{vod.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {formatDuration(vod.duration_seconds)} · {peaks.length} peak{peaks.length !== 1 ? "s" : ""}
                      {coachScore !== null ? ` · ${coachScore}/100` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Sparkles size={13} className={isGood ? "text-green-400" : "text-yellow-400"} />
                    <span className={`text-sm font-bold ${isGood ? "text-green-400" : "text-yellow-400"}`}>
                      {Math.round(bestScore * 100)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineRow({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className={color}>{icon}</span>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
