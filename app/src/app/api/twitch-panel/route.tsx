/**
 * GET /api/twitch-panel — renders a 640x200 PNG panel image for streamers
 * to install under their Twitch channel. Twitch resizes panels to 320x100
 * display, so we render at 2x for retina sharpness.
 *
 * No auth required — the image is public by design (it's going on a public
 * Twitch channel). Personalization (the streamer's name) is passed via
 * ?name= query param.
 */
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name")?.slice(0, 20) || "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0A0A0A",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        {/* Purple glow */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            left: "-80px",
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(ellipse at center, rgba(168,85,247,0.35) 0%, transparent 60%)",
          }}
        />
        {/* Right accent glow */}
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "280px",
            height: "280px",
            background:
              "radial-gradient(ellipse at center, rgba(34,211,238,0.18) 0%, transparent 60%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
          }}
        >
          {/* Icon badge */}
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "rgba(168,85,247,0.15)",
              border: "2px solid rgba(168,85,247,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 32,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                background: "linear-gradient(135deg, #fff 0%, #C084FC 100%)",
                backgroundClip: "text",
                color: "transparent",
                letterSpacing: "-2px",
                display: "flex",
              }}
            >
              L
            </div>
          </div>

          {/* Text block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#C084FC",
                letterSpacing: "3px",
                textTransform: "uppercase",
                marginBottom: 8,
                display: "flex",
              }}
            >
              Coached by
            </div>
            <div
              style={{
                fontSize: 56,
                fontWeight: 900,
                background: "linear-gradient(135deg, #fff 20%, #C084FC 100%)",
                backgroundClip: "text",
                color: "transparent",
                letterSpacing: "-2px",
                lineHeight: 1,
                marginBottom: 10,
                display: "flex",
              }}
            >
              LevlCast
            </div>
            <div
              style={{
                fontSize: 20,
                color: "#9CA3AF",
                fontWeight: 500,
                display: "flex",
              }}
            >
              {name
                ? `Real feedback on every ${name} stream`
                : "Real feedback on every stream · levlcast.com"}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 640,
      height: 200,
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
