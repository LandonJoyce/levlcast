import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashScoreRing from "@/components/dashboard/DashScoreRing";
import { scoreColorVar, rankFor } from "@/lib/score-utils";
import WelcomeModal from "@/components/dashboard/welcome-modal";
import { MissionsCard } from "@/components/dashboard/missions-card";
import { CoachingArcCard } from "@/components/dashboard/coaching-arc-card";
import type { CoachingArcData } from "@/lib/coaching-arc";

// ─── helpers ─────────────────────────────────────────────

function GradientWords({ text }: { text: string }) {
  const parts = text.split(/(\s+)/);
  return (
    <>
      {parts.map((part, i) => {
        const letters = part.replace(/[^a-zA-Z]/g, "");
        if (letters.length >= 8) {
          return <span key={i} className="grad-text">{part}</span>;
        }
        return part;
      })}
    </>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "...";
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const Icons = {
  Twitch: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M4 5l2-3h14v12l-5 5h-4l-3 3H6v-3H2V8l2-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M11 8v5M16 8v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),
  Spark: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  ),
  Trend: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M3 17l6-6 4 4 8-8M14 7h7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Arrow: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M7 5l12 7-12 7V5z" fill="currentColor"/>
    </svg>
  ),
  Chev: () => (
    <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ─── page ────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitch_display_name, plan, subscription_expires_at, mission_checks, coaching_arc")
    .eq("id", user.id)
    .single();

  const isPro =
    profile?.plan === "pro" &&
    !(profile.subscription_expires_at && new Date(profile.subscription_expires_at) < new Date());

  // Latest analyzed VODs — most recent first, up to 12 for trend
  const { data: recentVods } = await supabase
    .from("vods")
    .select("id, title, duration_seconds, analyzed_at, stream_date, coach_report, created_at, peak_data")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .order("stream_date", { ascending: false, nullsFirst: false })
    .order("analyzed_at", { ascending: false, nullsFirst: false })
    .limit(12);

  const totalAnalyzed = recentVods?.length ?? 0;
  const latest = recentVods?.[0];
  const latestScore = (latest?.coach_report as { overall_score?: number } | null)?.overall_score ?? null;
  const previousScore = (recentVods?.[1]?.coach_report as { overall_score?: number } | null)?.overall_score ?? null;
  const latestRecommendation = (latest?.coach_report as { recommendation?: string } | null)?.recommendation ?? null;
  const latestPeaks = Array.isArray(latest?.peak_data) ? latest.peak_data.length : 0;

  // Missions — from the latest coach report's next_stream_goals
  type MissionChecks = { vod_id: string; checked: number[] } | null;
  const missionChecks = (profile?.mission_checks as MissionChecks) ?? null;
  const latestMissions = (latest?.coach_report as { next_stream_goals?: string[] } | null)?.next_stream_goals ?? [];
  const missionsVodId = latest?.id ?? null;
  // Restore checked state only if the saved checks are for the current latest VOD
  const restoredChecked = missionChecks?.vod_id === missionsVodId ? (missionChecks?.checked ?? []) : [];

  // Clips this month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: clipsThisMonth } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "ready")
    .gte("created_at", monthStart.toISOString());

  // Clip performance data — aggregate views by category
  const { data: perfClips } = await supabase
    .from("clips")
    .select("peak_category, views_count, follows_gained")
    .eq("user_id", user.id)
    .eq("status", "ready")
    .not("views_count", "is", null);

  type PerfEntry = { views: number; follows: number; count: number };
  const perfByCategory: Record<string, PerfEntry> = {};
  for (const c of perfClips ?? []) {
    const cat = (c.peak_category as string) || "other";
    if (!perfByCategory[cat]) perfByCategory[cat] = { views: 0, follows: 0, count: 0 };
    perfByCategory[cat].views += (c.views_count as number) ?? 0;
    perfByCategory[cat].follows += (c.follows_gained as number) ?? 0;
    perfByCategory[cat].count++;
  }
  const topPerfCategory = Object.entries(perfByCategory).sort((a, b) => b[1].views - a[1].views)[0] ?? null;
  const totalTrackedViews = Object.values(perfByCategory).reduce((s, e) => s + e.views, 0);

  const displayName = profile?.twitch_display_name || "Streamer";

  // ─── Empty state — no streams analyzed yet ─────────────
  if (totalAnalyzed === 0) {
    return (
      <>
        <WelcomeModal name={displayName} />
        <div className="page-head">
          <span className="page-eyebrow">§ 01 · Today&apos;s focus</span>
          <h1 className="page-title">Hey, <span className="grad-text">{displayName}</span>.</h1>
          <p className="page-sub">Let&apos;s analyze your first stream.</p>
        </div>

        <div className="card bordered accent-blue" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "48px 32px", textAlign: "center", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(600px 280px at 50% 0%, color-mix(in oklab, var(--blue) 18%, transparent), transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "color-mix(in oklab, var(--blue-soft) 50%, transparent)", border: "1px solid color-mix(in oklab, var(--blue) 35%, transparent)", color: "var(--blue)", fontFamily: "var(--font-geist-mono), monospace", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 18 }}>
                Start Here
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.1, margin: "0 0 10px", color: "var(--ink)" }}>
                Get your first coaching report, free.
              </h2>
              <p style={{ margin: "0 auto 24px", color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.55, maxWidth: "52ch" }}>
                Sync your Twitch VODs, pick one, and our AI will score your stream 0–100 with a coaching report that tells you exactly what to fix.
              </p>
              <Link href="/dashboard/vods" className="btn btn-blue">
                <Icons.Twitch /> Sync your VODs <Icons.Arrow />
              </Link>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { n: "01", t: "Sync from Twitch", b: "One click. We pull your VOD library, read-only, no setup." },
            { n: "02", t: "AI watches every minute", b: "Scored on energy, engagement, consistency, and content." },
            { n: "03", t: "Get your coach report", b: "Stream story, priority fix, 3 strengths, 3 missions for next stream." },
          ].map((s) => (
            <div key={s.n} className="card card-pad">
              <span className="mono-label">{s.n}</span>
              <h3 style={{ fontSize: 14, marginTop: 8, marginBottom: 4, color: "var(--ink)" }}>{s.t}</h3>
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, margin: 0 }}>{s.b}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  // ─── Populated state ───────────────────────────────────
  const rank = rankFor(latestScore ?? 0);
  const delta = latestScore !== null && previousScore !== null ? latestScore - previousScore : null;
  const trend = (recentVods ?? [])
    .map((v) => (v.coach_report as { overall_score?: number } | null)?.overall_score ?? 0)
    .reverse();
  const avgScore = trend.length > 0 ? Math.round(trend.reduce((a, b) => a + b, 0) / trend.length) : 0;
  const trendingUp = trend.length >= 4 && trend.slice(-4).reduce((a, b) => a + b, 0) > trend.slice(-8, -4).reduce((a, b) => a + b, 0);

  const tableStreams = (recentVods ?? []).slice(0, 5);

  // SVG trend path
  const trendW = 320;
  const trendH = 90;
  const minScore = Math.max(0, Math.min(...trend) - 10);
  const maxScore = Math.max(minScore + 20, Math.max(50, ...trend));
  const points = trend.map((v, i) => [
    trend.length === 1 ? trendW / 2 : i * (trendW / (trend.length - 1)),
    trendH - ((v - minScore) / (maxScore - minScore)) * (trendH - 16),
  ]);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${trendW},${trendH} L0,${trendH} Z`;

  // Dates for x-axis labels on trend chart (oldest → newest)
  const trendDates = (recentVods ?? [])
    .slice(0, 12)
    .map((v) => {
      const d = new Date(v.stream_date ?? v.analyzed_at ?? v.created_at ?? "");
      return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    })
    .reverse();

  return (
    <>
      <WelcomeModal name={displayName} />

      {/* Header strip */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div className="page-head">
          <span className="page-eyebrow">§ 01 · Today&apos;s focus</span>
          <h1 className="page-title">Hey, <span className="grad-text">{displayName}</span>.</h1>
          <p className="page-sub">One thing to fix before you go live again.</p>
        </div>
        <div className="row gap-md">
          <span className={`rank-chip ${rank.cls}`}><Icons.Spark /> {rank.label}</span>
          <Link href="/dashboard/vods" className="btn btn-blue"><Icons.Twitch /> Sync streams</Link>
        </div>
      </div>

      {/* Hero focus card */}
      <div className="card bordered accent-blue" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 32, padding: 28, alignItems: "center", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(500px 220px at 0% 0%, color-mix(in oklab, var(--blue) 14%, transparent), transparent 70%)", pointerEvents: "none" }} />
          <DashScoreRing value={latestScore ?? 0} size={160} />
          <div className="col gap-sm" style={{ position: "relative" }}>
            <span className="mono-label">Next session goal</span>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, margin: 0, color: "var(--ink)" }}>
              <GradientWords text={latestRecommendation || "Open your latest report to see what to fix."} />
            </h2>
            <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.55, maxWidth: "52ch" }}>
              From your latest stream: <b style={{ color: "var(--ink)" }}>{latest?.title || "your most recent broadcast"}</b>.
            </p>
            <div className="row gap-sm" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {delta !== null && (
                <span className={`chip ${delta >= 0 ? "g" : "r"}`}>
                  <Icons.Trend /> {delta >= 0 ? "+" : ""}{delta} vs previous
                </span>
              )}
              {latestPeaks > 0 && (
                <span className="chip b">{latestPeaks} moments to clip</span>
              )}
            </div>
          </div>
          <div className="col gap-sm" style={{ position: "relative", minWidth: 200 }}>
            <Link href={`/dashboard/vods/${latest?.id}`} className="btn btn-blue">Open full report <Icons.Arrow /></Link>
            <Link href="/dashboard/clips" className="btn btn-ghost">See clips <Icons.Play /></Link>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 4, letterSpacing: ".04em" }}>
              {formatDate(latest?.analyzed_at ?? latest?.created_at ?? null)} · {formatDuration(latest?.duration_seconds ?? null)}
            </span>
          </div>
        </div>
      </div>

      {/* Missions card — only for Pro users with active missions */}
      {isPro && latestMissions.length > 0 && missionsVodId && (
        <MissionsCard
          missions={latestMissions}
          vodId={missionsVodId}
          vodTitle={latest?.title ?? "your last stream"}
          initialChecked={restoredChecked}
        />
      )}

      {/* Coaching Arc — shows once 3+ streams analyzed */}
      {profile?.coaching_arc && (
        <CoachingArcCard arc={profile.coaching_arc as CoachingArcData} />
      )}

      {/* Three column row: trend, stats, upgrade (if not Pro) */}
      <div style={{ display: "grid", gridTemplateColumns: isPro ? "1.4fr 1fr" : "1.4fr 1fr 1fr", gap: 20 }}>
        {/* Trend */}
        <div className="card">
          <div className="card-head">
            <h3>Score over time</h3>
            <span className="label-mono">last {trend.length} streams</span>
          </div>
          <div style={{ padding: "20px 22px 22px" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)" }}>
                  {avgScore}<span style={{ fontSize: 16, color: "var(--ink-3)", fontWeight: 500 }}> / 100 avg</span>
                </div>
                {trendingUp && (
                  <span className="mono" style={{ fontSize: 11, color: "var(--green)", letterSpacing: ".04em" }}>↑ trending up · last 4 streams</span>
                )}
              </div>
            </div>
            {trend.length > 1 ? (
              <svg viewBox={`0 0 ${trendW} ${trendH + 28}`} style={{ width: "100%", height: trendH + 28, marginTop: 14, overflow: "visible" }}>
                <defs>
                  <linearGradient id="dashTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.60 0.22 290)" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="oklch(0.60 0.22 290)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={area} fill="url(#dashTrendGradient)" />
                <path d={path} stroke="oklch(0.60 0.22 290)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => {
                  const isLast = i === points.length - 1;
                  const score = trend[i];
                  const prevScore = i > 0 ? trend[i - 1] : null;
                  const up = prevScore !== null && score > prevScore;
                  const down = prevScore !== null && score < prevScore;
                  const dotColor = isLast ? "oklch(0.60 0.22 290)" : up ? "oklch(0.72 0.18 145)" : down ? "oklch(0.65 0.22 25)" : "oklch(0.55 0.04 245)";
                  return (
                    <g key={i}>
                      {isLast && <circle cx={p[0]} cy={p[1]} r="9" fill="oklch(0.60 0.22 290)" opacity="0.25" />}
                      <circle cx={p[0]} cy={p[1]} r={isLast ? 5 : 4} fill={dotColor} />
                      <text
                        x={p[0]}
                        y={p[1] - 10}
                        textAnchor="middle"
                        fontSize="9"
                        fontFamily="var(--font-geist-mono), monospace"
                        fill={isLast ? "oklch(0.60 0.22 290)" : "oklch(0.6 0.04 245)"}
                        fontWeight={isLast ? "700" : "400"}
                      >{score}</text>
                      {trendDates[i] && (
                        <text
                          x={Math.max(16, Math.min(trendW - 16, p[0]))}
                          y={trendH + 20}
                          textAnchor="middle"
                          fontSize="8"
                          fontFamily="var(--font-geist-mono), monospace"
                          fill="oklch(0.45 0.03 245)"
                        >{trendDates[i]}</text>
                      )}
                    </g>
                  );
                })}
              </svg>
            ) : (
              <p style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)", textAlign: "center", padding: "20px 0" }}>
                One stream analyzed. analyze a few more to see your trend.
              </p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="card card-pad" style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
          <div className="col gap-sm">
            <span className="mono-label">Streams analyzed</span>
            <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>{totalAnalyzed}</span>
              <span style={{ color: "var(--ink-3)", fontSize: 13 }}>total</span>
            </div>
          </div>
          <div className="col gap-sm">
            <span className="mono-label">Clips this month</span>
            <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--green)" }}>{clipsThisMonth ?? 0}</span>
              <span style={{ color: "var(--ink-3)", fontSize: 13 }}>this month</span>
            </div>
          </div>
          {totalTrackedViews > 0 && (
            <div className="col gap-sm" style={{ paddingTop: 6, borderTop: "1px solid var(--line)" }}>
              <span className="mono-label">Best clip category</span>
              {topPerfCategory && (
                <div className="row" style={{ alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--ink)", textTransform: "uppercase" }}>
                    {topPerfCategory[0] === "funny" ? "Comedy" : topPerfCategory[0]}
                  </span>
                  <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
                    {topPerfCategory[1].views.toLocaleString()} views
                    {topPerfCategory[1].follows > 0 && ` · +${topPerfCategory[1].follows} follows`}
                  </span>
                </div>
              )}
              <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--font-geist-mono), monospace" }}>
                from {Object.values(perfByCategory).reduce((s, e) => s + e.count, 0)} tracked clips
              </span>
            </div>
          )}
          {totalTrackedViews === 0 && (
            <div className="col gap-sm" style={{ paddingTop: 6, borderTop: "1px solid var(--line)" }}>
              <span className="mono-label">Clip performance</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5 }}>Post clips to YouTube to start tracking which category performs best.</span>
            </div>
          )}
        </div>

        {/* Upgrade card (only if Free) */}
        {!isPro && (
          <div className="upgrade" style={{ padding: 20 }}>
            <div className="eb">Founding Member · 100 spots</div>
            <h4 style={{ fontSize: 18 }}>Get a report on every stream.</h4>
            <p>15 VOD analyses + 20 clips a month. $9.99/mo or $99/yr, cancel anytime.</p>
            <Link href="/dashboard/settings" className="btn btn-blue" style={{ padding: "8px 14px", fontSize: 12.5 }}>
              Upgrade to Pro <Icons.Arrow />
            </Link>
          </div>
        )}
      </div>

      {/* Recent streams table */}
      <div className="card">
        <div className="card-head">
          <h3>Recent streams</h3>
          <div className="right">
            <span className="label-mono">{totalAnalyzed} total</span>
            <Link href="/dashboard/vods" className="btn-link mono" style={{ fontSize: 11, letterSpacing: ".06em" }}>
              SEE ALL <Icons.Arrow />
            </Link>
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: "40%" }}>Stream</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Moments</th>
              <th style={{ textAlign: "right" }}>Score</th>
              <th style={{ width: 30 }}></th>
            </tr>
          </thead>
          <tbody>
            {tableStreams.map((s) => {
              const score = (s.coach_report as { overall_score?: number } | null)?.overall_score ?? 0;
              const moments = Array.isArray(s.peak_data) ? s.peak_data.length : 0;
              return (
                <tr key={s.id} style={{ cursor: "pointer" }}>
                  <td>
                    <Link href={`/dashboard/vods/${s.id}`} style={{ display: "flex", alignItems: "center", gap: 12, color: "inherit" }}>
                      <div style={{ width: 48, height: 30, borderRadius: 5, background: "linear-gradient(135deg, oklch(0.32 0.05 245), oklch(0.22 0.04 245))", display: "grid", placeItems: "center", color: "var(--ink-3)", flexShrink: 0 }}>
                        <Icons.Play />
                      </div>
                      <span className="stream-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
                    </Link>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{formatDate(s.analyzed_at ?? s.created_at)}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{formatDuration(s.duration_seconds)}</td>
                  <td>{moments > 0 ? <span className="chip b">{moments} clips</span> : <span style={{ color: "var(--ink-3)" }}>...</span>}</td>
                  <td style={{ textAlign: "right" }}>
                    <div className="score-pill" style={{ color: scoreColorVar(score), justifyContent: "flex-end" }}>
                      {score}<small>/100</small>
                    </div>
                  </td>
                  <td><Icons.Chev /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
