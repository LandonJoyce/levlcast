import { createAdminClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDuration } from "@/lib/utils";
import type { Metadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: vod } = await admin
    .from("vods")
    .select("title, coach_report, profiles(twitch_display_name)")
    .eq("share_token", token)
    .single();

  if (!vod) return { title: "LevlCast Stream Report" };

  const report = vod.coach_report as any;
  const name = (vod.profiles as any)?.twitch_display_name ?? "Streamer";
  const score = report?.overall_score ?? "?";

  return {
    title: `${name}'s Stream Report: ${score}/100 | LevlCast`,
    description: report?.recommendation ?? "AI-powered stream coaching report.",
    openGraph: {
      title: `${name} scored ${score}/100 on LevlCast`,
      description: report?.recommendation ?? "AI-powered stream coaching report.",
      images: [`/share/${token}/opengraph-image`],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} scored ${score}/100 on LevlCast`,
      description: report?.recommendation ?? "AI-powered stream coaching report.",
      images: [`/share/${token}/opengraph-image`],
    },
  };
}

function scoreColor(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

const TREND_LABEL: Record<string, string> = {
  building: "↗ Building",
  declining: "↘ Declining",
  consistent: "→ Consistent",
  volatile: "↕ Volatile",
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate token is UUID format before hitting the DB
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) notFound();

  const admin = createAdminClient();

  const { data: vod } = await admin
    .from("vods")
    .select("title, stream_date, duration_seconds, peak_data, coach_report, profiles(twitch_display_name, twitch_avatar_url, twitch_login)")
    .eq("share_token", token)
    .single();

  if (!vod) notFound();

  const report = vod.coach_report as any;
  const peaks = (vod.peak_data as any[]) || [];
  const profile = vod.profiles as any;

  if (!report) notFound();

  const score = report.overall_score ?? 0;
  const trend = TREND_LABEL[report.energy_trend] ?? "→ Consistent";

  return (
    <div className="min-h-screen bg-bg text-foreground">
      {/* Fixed background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] glow-bg pointer-events-none opacity-40" />

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        {/* LevlCast header */}
        <div className="flex items-center justify-between mb-10">
          <span className="text-xl font-extrabold tracking-tight text-gradient">LevlCast</span>
          <a
            href="https://www.levlcast.com"
            className="text-xs text-muted hover:text-white transition-colors"
          >
            Get your free analysis →
          </a>
        </div>

        {/* Streamer identity */}
        <div className="flex items-center gap-3 mb-6">
          {profile?.twitch_avatar_url && (
            <img
              src={profile.twitch_avatar_url}
              alt={profile.twitch_display_name}
              className="w-12 h-12 rounded-full border border-border"
            />
          )}
          <div>
            <p className="font-bold">{profile?.twitch_display_name ?? "Streamer"}</p>
            <p className="text-xs text-muted">@{profile?.twitch_login}</p>
          </div>
        </div>

        {/* Stream title + date */}
        <h1 className="text-lg font-extrabold tracking-tight leading-snug mb-1">{vod.title}</h1>
        <p className="text-xs text-muted mb-8">
          {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {" · "}{formatDuration(vod.duration_seconds)}
        </p>

        {/* Score + summary */}
        <div className="bg-surface border border-border rounded-2xl p-6 mb-4 flex items-center gap-6">
          <div
            className="flex-shrink-0 w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center"
            style={{ borderColor: scoreColor(score) }}
          >
            <span className="text-3xl font-extrabold leading-none" style={{ color: scoreColor(score) }}>{score}</span>
            <span className="text-xs text-muted">/100</span>
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Stream Score</p>
            {report.recommendation && <p className="text-sm leading-relaxed">{report.recommendation}</p>}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-extrabold text-accent-light">{peaks.length}</p>
            <p className="text-xs text-muted mt-1">Peak Moments</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-sm font-bold">{trend}</p>
            <p className="text-xs text-muted mt-1">Energy Trend</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <p className="text-sm font-bold capitalize" style={{
              color: report.viewer_retention_risk === "low" ? "#22c55e"
                : report.viewer_retention_risk === "medium" ? "#eab308" : "#ef4444"
            }}>
              {report.viewer_retention_risk ?? "unknown"}
            </p>
            <p className="text-xs text-muted mt-1">Retention Risk</p>
          </div>
        </div>

        {/* Strengths */}
        {report.strengths?.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Strengths</p>
            <ul className="space-y-2">
              {report.strengths.slice(0, 3).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-green-400 font-bold mt-0.5">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Best moment */}
        {report.best_moment && (
          <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 mb-8">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Best Moment</p>
            <p className="text-accent-light font-bold text-lg mb-1">{report.best_moment.time}</p>
            <p className="text-sm text-muted">{report.best_moment.description}</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center border border-border rounded-2xl p-6 bg-surface">
          <p className="font-bold mb-1">Want a report like this?</p>
          <p className="text-sm text-muted mb-4">LevlCast analyzes your Twitch VODs and finds your best clip moments, free to try.</p>
          <a
            href="https://www.levlcast.com"
            className="inline-flex items-center gap-2 bg-accent hover:opacity-85 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-opacity"
          >
            Get your free analysis
          </a>
        </div>
      </div>
    </div>
  );
}
