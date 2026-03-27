import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDuration } from "@/lib/utils";
import { Film, Scissors, Sparkles, TrendingUp } from "lucide-react";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all stats
  const [vodsResult, clipsResult, vodsData] = await Promise.all([
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
      .select("title, duration_seconds, peak_data, status, stream_date")
      .eq("user_id", user!.id)
      .order("stream_date", { ascending: false }),
  ]);

  const totalVods = vodsResult.count || 0;
  const totalClips = clipsResult.count || 0;
  const vods = vodsData.data || [];
  const clips = clipsResult.data || [];

  const analyzedVods = vods.filter((v) => v.status === "ready");
  const totalStreamMinutes = vods.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / 60;

  // Count total peaks across all VODs
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

  // Clip stats
  const totalClipSeconds = clips.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight mb-1">
          Analytics
        </h1>
        <p className="text-sm text-muted">
          Your content pipeline at a glance.
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total VODs"
          value={totalVods.toString()}
          detail={`${analyzedVods.length} analyzed`}
        />
        <StatCard
          label="Peaks Detected"
          value={totalPeaks.toString()}
          detail={`${Math.round(avgScore * 100)} avg score`}
        />
        <StatCard
          label="Clips Generated"
          value={totalClips.toString()}
          detail={totalClipSeconds > 0 ? `${formatDuration(totalClipSeconds)} total` : "Generate from peaks"}
        />
        <StatCard
          label="Stream Time"
          value={`${Math.round(totalStreamMinutes)}m`}
          detail={`${totalVods} streams synced`}
          accent
        />
      </div>

      {/* Pipeline breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Processing pipeline */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-5">
            Pipeline
          </h2>
          <div className="space-y-4">
            <PipelineRow
              icon={<Film size={16} />}
              label="VODs Synced"
              value={totalVods}
              color="text-accent-light"
            />
            <PipelineRow
              icon={<Sparkles size={16} />}
              label="VODs Analyzed"
              value={analyzedVods.length}
              color="text-yellow-400"
            />
            <PipelineRow
              icon={<TrendingUp size={16} />}
              label="Peaks Found"
              value={totalPeaks}
              color="text-green-400"
            />
            <PipelineRow
              icon={<Scissors size={16} />}
              label="Clips Generated"
              value={totalClips}
              color="text-purple-400"
            />
          </div>
        </div>

        {/* Category breakdown */}
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-5">
            Peak Categories
          </h2>
          {Object.keys(categoryCount).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(categoryCount)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <span className="text-sm capitalize">{cat}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${(count / totalPeaks) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-muted w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Analyze VODs to see category breakdown.</p>
          )}
        </div>
      </div>

      {/* Top VODs by peaks */}
      {analyzedVods.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted mb-5">
            Analyzed VODs
          </h2>
          <div className="space-y-3">
            {analyzedVods.map((vod) => {
              const peaks = (vod.peak_data as Array<{ score: number; title: string }>) || [];
              const bestScore = peaks.length > 0
                ? Math.max(...peaks.map((p) => p.score))
                : 0;
              return (
                <div key={vod.title} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{vod.title}</p>
                    <p className="text-xs text-muted">
                      {formatDuration(vod.duration_seconds)} -- {peaks.length} peak{peaks.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={13} className={bestScore >= 0.7 ? "text-green-400" : "text-yellow-400"} />
                    <span className={`text-sm font-bold ${bestScore >= 0.7 ? "text-green-400" : "text-yellow-400"}`}>
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
        <div className={color}>{icon}</div>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-lg font-bold">{value}</span>
    </div>
  );
}
