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

function parseItem(raw: string) {
  const cleaned = raw.replace(/^RECURRING:\s*/i, "");
  const m = cleaned.match(/^\*\*(.+?)\*\*\s*[—–-]\s*([\s\S]+)$/);
  if (!m) return { label: "", body: cleaned, ts: null as string | null };
  let body = m[2].trim();
  const tsM = body.match(/\s+at\s+(\d{1,2}:\d{2}(?::\d{2})?)\.?\s*$/i);
  const ts = tsM ? tsM[1] : null;
  if (tsM) body = body.slice(0, tsM.index!).trim().replace(/\.$/, "");
  return { label: m[1], body, ts };
}

const TREND_LABEL: Record<string, string> = {
  building: "Building",
  declining: "Declining",
  consistent: "Consistent",
  volatile: "Volatile",
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

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
  const color = scoreColor(score);
  const trend = TREND_LABEL[report.energy_trend] ?? "Consistent";

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 700, height: 500, borderRadius: "50%",
        background: `radial-gradient(ellipse, color-mix(in oklab, ${color} 12%, transparent), transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", maxWidth: 580, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", background: "linear-gradient(90deg, #a78bfa, #38bdf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            LevlCast
          </span>
          <a
            href="https://www.levlcast.com/auth/login"
            style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.45)", textDecoration: "none", letterSpacing: "0.02em" }}
          >
            Get your free report
          </a>
        </div>

        {/* Streamer identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          {profile?.twitch_avatar_url && (
            <img
              src={profile.twitch_avatar_url}
              alt={profile.twitch_display_name}
              style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)" }}
            />
          )}
          <div>
            <p style={{ fontWeight: 700, fontSize: 15, margin: 0 }}>{profile?.twitch_display_name ?? "Streamer"}</p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", margin: 0 }}>@{profile?.twitch_login}</p>
          </div>
        </div>

        {/* Stream title */}
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.3 }}>{vod.title}</h1>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", margin: "0 0 28px" }}>
          {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {" · "}{formatDuration(vod.duration_seconds)}
        </p>

        {/* Hero score card */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20, padding: "28px 24px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 24,
        }}>
          <div style={{
            flexShrink: 0, width: 88, height: 88, borderRadius: "50%",
            border: `3px solid ${color}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: `color-mix(in oklab, ${color} 10%, transparent)`,
          }}>
            <span style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color }}>{score}</span>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>/100</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>Stream Score</p>
            {report.recommendation && (
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", margin: 0 }}>{report.recommendation}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
          {[
            { value: peaks.length.toString(), label: "Clip Moments" },
            { value: trend, label: "Energy Trend" },
            {
              value: (report.viewer_retention_risk ?? "unknown"),
              label: "Retention Risk",
              color: report.viewer_retention_risk === "low" ? "#22c55e" : report.viewer_retention_risk === "medium" ? "#eab308" : "#ef4444",
            },
          ].map(({ value, label, color: c }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: "16px 12px", textAlign: "center",
            }}>
              <p style={{ fontSize: 15, fontWeight: 800, margin: "0 0 4px", textTransform: "capitalize", color: c ?? "#fff" }}>{value}</p>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0, letterSpacing: "0.04em" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Strengths */}
        {report.strengths?.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "20px", marginBottom: 12,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>What they do well</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {report.strengths.slice(0, 3).map((s: string, i: number) => {
                const { label, body, ts } = parseItem(s);
                return (
                  <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.8)" }}>
                    <span style={{ color: "#22c55e", fontWeight: 800, fontSize: 15, lineHeight: 1.55, flexShrink: 0 }}>+</span>
                    <div>
                      {label && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{label}</span>
                          {ts && (
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "rgba(34,197,94,0.7)", letterSpacing: "0.04em" }}>{ts}</span>
                          )}
                        </div>
                      )}
                      <span>{body}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Improvements - teased */}
        {report.improvements?.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16, padding: "20px", marginBottom: 12, position: "relative", overflow: "hidden",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 14px" }}>Areas to improve</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {report.improvements.slice(0, 1).map((s: string, i: number) => {
                const { label, body, ts } = parseItem(s);
                return (
                  <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, fontSize: 13, lineHeight: 1.55, color: "rgba(255,255,255,0.8)" }}>
                    <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 15, lineHeight: 1.55, flexShrink: 0 }}>!</span>
                    <div>
                      {label && (
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{label}</span>
                          {ts && (
                            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: "rgba(245,158,11,0.7)", letterSpacing: "0.04em" }}>{ts}</span>
                          )}
                        </div>
                      )}
                      <span>{body}</span>
                    </div>
                  </li>
                );
              })}
              {report.improvements.length > 1 && (
                <li style={{
                  fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic",
                  filter: "blur(4px)", userSelect: "none", paddingLeft: 22,
                }}>
                  {parseItem(report.improvements[1]).body || report.improvements[1]}
                </li>
              )}
            </ul>
            {report.improvements.length > 1 && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 56,
                background: "linear-gradient(to bottom, transparent, rgba(10,10,15,0.95))",
              }} />
            )}
          </div>
        )}

        {/* Best moment */}
        {report.best_moment && (
          <div style={{
            background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 16, padding: "20px", marginBottom: 32,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(167,139,250,0.6)", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 6px" }}>Best Moment</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#a78bfa", margin: "0 0 4px" }}>{report.best_moment.time}</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", margin: 0 }}>{report.best_moment.description}</p>
          </div>
        )}

        {/* CTA */}
        <div style={{
          background: "linear-gradient(135deg, rgba(167,139,250,0.12), rgba(56,189,248,0.08))",
          border: "1px solid rgba(167,139,250,0.25)",
          borderRadius: 20, padding: "32px 28px", textAlign: "center",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(167,139,250,0.8)", textTransform: "uppercase", margin: "0 0 10px" }}>
            Want to know your score?
          </p>
          <p style={{ fontSize: 20, fontWeight: 900, margin: "0 0 8px", lineHeight: 1.2 }}>
            Get a free AI coach report<br />for your stream
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 24px", lineHeight: 1.6 }}>
            LevlCast analyzes your Twitch VODs, scores your performance, finds your best clip moments, and tells you exactly what to improve. Free to start.
          </p>
          <a
            href="https://www.levlcast.com/auth/login"
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, #a78bfa, #38bdf8)",
              color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "0.01em",
              padding: "14px 32px", borderRadius: 14, textDecoration: "none",
              boxShadow: "0 8px 32px -8px rgba(167,139,250,0.5)",
            }}
          >
            Analyze my stream free
            <svg viewBox="0 0 24 24" fill="none" width="14" height="14">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: "12px 0 0" }}>
            No credit card. Connect Twitch and go.
          </p>
        </div>

      </div>
    </div>
  );
}
