import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function scoreColor(score: number) {
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#eab308";
  return "#ef4444";
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return new ImageResponse(<div style={{ background: "#0a0a0a", width: "100%", height: "100%" }} />);
  }

  const admin = createAdminClient();
  const { data: vod } = await admin
    .from("vods")
    .select("title, stream_date, peak_data, coach_report, profiles(twitch_display_name, twitch_avatar_url)")
    .eq("share_token", token)
    .single();

  if (!vod) {
    return new ImageResponse(<div style={{ background: "#0a0a0a", width: "100%", height: "100%" }} />);
  }

  const report = vod.coach_report as any;
  const peaks = (vod.peak_data as any[]) || [];
  const profile = vod.profiles as any;
  const score = report?.overall_score ?? 0;
  const color = scoreColor(score);
  const name = profile?.twitch_display_name ?? "Streamer";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0f0f13",
        display: "flex",
        flexDirection: "column",
        padding: "60px",
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* Purple glow */}
      <div style={{
        position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)",
        width: 600, height: 400, background: "rgba(124,58,237,0.15)",
        borderRadius: "50%", filter: "blur(80px)",
      }} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>LevlCast</span>
        <span style={{ fontSize: 16, color: "#666" }}>AI Stream Coaching</span>
      </div>

      {/* Main content */}
      <div style={{ display: "flex", alignItems: "center", gap: 48, flex: 1 }}>
        {/* Score ring */}
        <div style={{
          width: 160, height: 160, borderRadius: "50%",
          border: `6px solid ${color}`,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 56, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 18, color: "#666" }}>/100</span>
        </div>

        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            {profile?.twitch_avatar_url && (
              <img
                src={profile.twitch_avatar_url}
                style={{ width: 48, height: 48, borderRadius: "50%", border: "2px solid #333" }}
              />
            )}
            <span style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{name}</span>
          </div>
          <span style={{ fontSize: 20, color: "#ccc", marginBottom: 24, lineHeight: 1.3 }} >
            {vod.title}
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: "#a78bfa" }}>{peaks.length}</span>
              <span style={{ fontSize: 14, color: "#666" }}>Peak Moments</span>
            </div>
            {report?.strengths?.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <span style={{ fontSize: 14, color: "#22c55e", fontWeight: 700 }}>✓ {report.strengths[0]}</span>
                {report.strengths[1] && <span style={{ fontSize: 14, color: "#22c55e", fontWeight: 700 }}>✓ {report.strengths[1]}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 40, paddingTop: 24, borderTop: "1px solid #222" }}>
        <span style={{ fontSize: 16, color: "#666" }}>
          {new Date(vod.stream_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
        <span style={{ fontSize: 16, color: "#a78bfa", fontWeight: 700 }}>levlcast.com</span>
      </div>
    </div>,
    { ...size }
  );
}
