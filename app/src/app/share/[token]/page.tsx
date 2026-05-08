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

  const GRAD = "linear-gradient(135deg, rgb(148,61,255) 0%, rgb(242,97,121) 100%)";
  const HELV = '"Helvetica Neue", "Helvetica", "Arial", system-ui, sans-serif';
  const SERIF = '"Instrument Serif", Georgia, serif';
  const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const labelStyle: React.CSSProperties = {
    fontFamily: MONO, fontSize: 10, fontWeight: 700,
    letterSpacing: "0.18em", textTransform: "uppercase",
    color: "rgba(255,255,255,0.4)", margin: 0,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#ECF1FA", fontFamily: HELV }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
      {/* Background glow — purple/pink to match brand */}
      <div style={{
        position: "fixed", top: -100, left: "50%", transform: "translateX(-50%)",
        width: 720, height: 520, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(148,61,255,0.18) 0%, rgba(242,97,121,0.08) 40%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", maxWidth: 460, margin: "0 auto", padding: "24px 18px 56px", zIndex: 1 }}>

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <span style={{
            fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em",
            background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
          }}>
            LevlCast
          </span>
          <a
            href="https://www.levlcast.com/auth/login"
            style={{
              fontFamily: MONO, fontSize: 10, fontWeight: 700,
              letterSpacing: "0.18em", textTransform: "uppercase",
              color: "rgba(255,255,255,0.45)", textDecoration: "none",
            }}
          >
            Get your report →
          </a>
        </div>

        {/* Streamer + score combined card — the hero */}
        <div style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: "20px 18px", marginBottom: 10,
          position: "relative", overflow: "hidden",
        }}>
          {/* Streamer identity row */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            {profile?.twitch_avatar_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.twitch_avatar_url}
                alt={profile.twitch_display_name}
                style={{ width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#ECF1FA" }}>
                {profile?.twitch_display_name ?? "Streamer"}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", margin: 0, fontFamily: MONO }}>
                @{profile?.twitch_login}
              </p>
            </div>
            <span style={{
              ...labelStyle,
              padding: "4px 8px", borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "rgba(255,255,255,0.55)",
            }}>
              Coach Report
            </span>
          </div>

          {/* Score + recommendation */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{
              flexShrink: 0, width: 96, height: 96, borderRadius: "50%",
              background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
              padding: 3,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: "100%", height: "100%", borderRadius: "50%",
                background: "#0d0d12",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  fontFamily: SERIF, fontSize: 38, fontWeight: 400, lineHeight: 1, color, letterSpacing: "-0.03em",
                }}>{score}</span>
                <span style={{ fontSize: 9, fontFamily: MONO, color: "rgba(255,255,255,0.35)", marginTop: 2, letterSpacing: "0.1em" }}>/ 100</span>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...labelStyle, marginBottom: 6 }}>The one thing</p>
              {report.recommendation ? (
                <p style={{
                  fontFamily: SERIF, fontSize: 17, fontStyle: "italic",
                  fontWeight: 400, lineHeight: 1.35, letterSpacing: "-0.005em",
                  color: "#ECF1FA", margin: 0,
                }}>
                  {report.recommendation}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: 0 }}>No recommendation</p>
              )}
            </div>
          </div>

          {/* Stream title under score */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", margin: 0, fontWeight: 500, lineHeight: 1.4 }}>
              {vod.title}
            </p>
            <p style={{ fontSize: 10, fontFamily: MONO, color: "rgba(255,255,255,0.3)", margin: "3px 0 0", letterSpacing: "0.04em" }}>
              {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {formatDuration(vod.duration_seconds)}
            </p>
          </div>
        </div>

        {/* Stat strip — three small monospace pills */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10,
        }}>
          {[
            { value: peaks.length.toString(), label: "Clips", color: "#A3E635" },
            { value: trend, label: "Energy", color: "#fff" },
            {
              value: (report.viewer_retention_risk ?? "—"),
              label: "Retention",
              color: report.viewer_retention_risk === "low" ? "#A3E635" : report.viewer_retention_risk === "medium" ? "#F59E0B" : "#F87171",
            },
          ].map(({ value, label, color: c }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "10px 10px", textAlign: "center",
            }}>
              <p style={{
                fontFamily: SERIF, fontSize: 18, fontWeight: 400, margin: "0 0 2px",
                textTransform: "capitalize", color: c, lineHeight: 1.1, letterSpacing: "-0.01em",
              }}>{value}</p>
              <p style={{
                fontFamily: MONO, fontSize: 9, color: "rgba(255,255,255,0.4)",
                margin: 0, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
              }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Strengths */}
        {report.strengths?.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "16px 18px", marginBottom: 10,
          }}>
            <p style={{ ...labelStyle, marginBottom: 12, color: "#A3E635" }}>What worked</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
              {report.strengths.slice(0, 3).map((s: string, i: number) => {
                const { label, body, ts } = parseItem(s);
                return (
                  <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.78)" }}>
                    {label && (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ color: "#ECF1FA", fontWeight: 700, fontSize: 13 }}>{label}</span>
                        {ts && (
                          <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(163,230,53,0.85)", letterSpacing: "0.04em" }}>{ts}</span>
                        )}
                      </div>
                    )}
                    <span>{body}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Improvements - teased */}
        {report.improvements?.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "16px 18px", marginBottom: 10, position: "relative", overflow: "hidden",
          }}>
            <p style={{ ...labelStyle, marginBottom: 12, color: "#F59E0B" }}>What to fix</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {report.improvements.slice(0, 1).map((s: string, i: number) => {
                const { label, body, ts } = parseItem(s);
                return (
                  <li key={i} style={{ fontSize: 12.5, lineHeight: 1.55, color: "rgba(255,255,255,0.78)" }}>
                    {label && (
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ color: "#ECF1FA", fontWeight: 700, fontSize: 13 }}>{label}</span>
                        {ts && (
                          <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(245,158,11,0.85)", letterSpacing: "0.04em" }}>{ts}</span>
                        )}
                      </div>
                    )}
                    <span>{body}</span>
                  </li>
                );
              })}
              {report.improvements.length > 1 && (
                <li style={{
                  fontSize: 12, color: "rgba(255,255,255,0.25)", fontStyle: "italic",
                  filter: "blur(4px)", userSelect: "none",
                }}>
                  {parseItem(report.improvements[1]).body || report.improvements[1]}
                </li>
              )}
            </ul>
            {report.improvements.length > 1 && (
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 48,
                background: "linear-gradient(to bottom, transparent, rgba(8,8,13,0.96))",
                pointerEvents: "none",
              }} />
            )}
          </div>
        )}

        {/* Best moment — pull quote with gradient accent */}
        {report.best_moment && (
          <div style={{
            background: "linear-gradient(135deg, rgba(148,61,255,0.08), rgba(242,97,121,0.04))",
            border: "1px solid rgba(148,61,255,0.22)",
            borderRadius: 12, padding: "16px 18px", marginBottom: 24,
            position: "relative",
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{
                ...labelStyle,
                background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                color: "transparent",
              }}>Best moment</span>
              <span style={{
                fontFamily: MONO, fontSize: 11, fontWeight: 700,
                color: "rgba(242,97,121,0.95)", letterSpacing: "0.04em",
              }}>{report.best_moment.time}</span>
            </div>
            <p style={{
              fontFamily: SERIF, fontSize: 14, fontStyle: "italic", fontWeight: 400,
              lineHeight: 1.45, color: "rgba(255,255,255,0.85)", margin: 0, letterSpacing: "-0.005em",
            }}>
              {report.best_moment.description}
            </p>
          </div>
        )}

        {/* CTA */}
        <div style={{
          background: "linear-gradient(135deg, rgba(148,61,255,0.12), rgba(242,97,121,0.08))",
          border: "1px solid rgba(148,61,255,0.25)",
          borderRadius: 14, padding: "22px 20px", textAlign: "center",
        }}>
          <p style={{ ...labelStyle, marginBottom: 10,
            background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            color: "transparent",
          }}>
            Want your score?
          </p>
          <p style={{
            fontFamily: SERIF, fontSize: 24, fontWeight: 400, fontStyle: "italic",
            margin: "0 0 6px", lineHeight: 1.15, letterSpacing: "-0.015em", color: "#ECF1FA",
          }}>
            Get your <span style={{
              background: GRAD, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>free coach report.</span>
          </p>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 18px", lineHeight: 1.55, fontFamily: HELV }}>
            Score, timestamps, and clips ready to post. From your last VOD.
          </p>
          <a
            href="https://www.levlcast.com/auth/login"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: GRAD,
              color: "#fff", fontWeight: 700, fontSize: 13, letterSpacing: "0.01em",
              padding: "11px 22px", borderRadius: 10, textDecoration: "none",
              boxShadow: "0 6px 24px -6px rgba(148,61,255,0.5)",
            }}
          >
            Analyze my stream free
            <svg viewBox="0 0 24 24" fill="none" width="13" height="13">
              <path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <p style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", margin: "12px 0 0", textTransform: "uppercase", fontWeight: 700 }}>
            No card · Connect Twitch · Free
          </p>
        </div>

      </div>
    </div>
  );
}
