import { ImageResponse } from "next/og";
import { createAdminClient } from "@/lib/supabase/server";
import { OG, OG_SIZE, OgTop, ogFonts } from "@/lib/og";

/**
 * The link preview for a shared report: the streamer, their stream, the
 * report's headline line and the score, in the site's faces and colours.
 * It used to be purple with "AI Stream Coaching" and check marks the
 * renderer couldn't draw.
 */
export const runtime = "nodejs";
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A LevlCast report on a Twitch stream";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tone(score: number) {
  if (score >= 75) return OG.good;
  if (score >= 50) return OG.warn;
  return "#F87171";
}

export default async function OgImage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fonts = await ogFonts();
  const blank = new ImageResponse(<div style={{ display: "flex", background: OG.bg, width: "100%", height: "100%" }} />, { ...OG_SIZE, fonts });
  if (!UUID.test(token)) return blank;

  const { data: vod } = await createAdminClient()
    .from("vods")
    .select("title, coach_report, profiles(twitch_display_name, twitch_login, twitch_avatar_url)")
    .eq("share_token", token)
    .single();
  const report = (vod?.coach_report ?? null) as { overall_score?: number; punch_line?: string; recommendation?: string } | null;
  if (!vod || !report) return blank;

  const profile = vod.profiles as { twitch_display_name?: string | null; twitch_login?: string | null; twitch_avatar_url?: string | null } | null;
  const name = profile?.twitch_display_name || profile?.twitch_login || "A streamer";
  const avatar = profile?.twitch_avatar_url && /^https:\/\/static-cdn\.jtvnw\.net\//.test(profile.twitch_avatar_url) ? profile.twitch_avatar_url : null;
  const title = String(vod.title ?? "Untitled stream");
  const line = report.punch_line || report.recommendation || "";
  const score = typeof report.overall_score === "number" ? report.overall_score : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: OG.bg, padding: "56px 64px" }}>
        <OgTop path="levlcast.com" />
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} width={44} height={44} style={{ borderRadius: 22 }} alt="" />
              ) : null}
              <div style={{ display: "flex", fontFamily: "Body", fontSize: 28, color: OG.mute }}>{name}</div>
            </div>
            <div style={{ display: "flex", fontFamily: "Display", fontSize: title.length > 40 ? 52 : 62, lineHeight: 1.05, letterSpacing: -1.6, color: OG.fg }}>
              {title.length > 70 ? `${title.slice(0, 67)}...` : title}
            </div>
            {line ? (
              <div style={{ display: "flex", fontFamily: "Body", fontSize: 28, lineHeight: 1.35, color: OG.dim, marginTop: 22 }}>
                {line.length > 120 ? `${line.slice(0, 117)}...` : line}
              </div>
            ) : null}
          </div>
          {score !== null ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", fontFamily: "Numbers", fontSize: 190, lineHeight: 0.86, color: tone(score) }}>{score}</div>
              <div style={{ display: "flex", fontFamily: "Body", fontSize: 24, color: OG.faint, marginTop: 10 }}>out of 100</div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", fontFamily: "Body", fontSize: 24, color: OG.faint }}>Get one on your last stream, free.</div>
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
