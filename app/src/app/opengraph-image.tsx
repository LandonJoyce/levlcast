import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LevlCast — Your Personal Stream Manager";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0A0A0A",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "80px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "#C084FC",
            marginBottom: 32,
            letterSpacing: "-2px",
            display: "flex",
          }}
        >
          LevlCast
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 900,
            color: "#FFFFFF",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: "-3px",
            marginBottom: 32,
            display: "flex",
          }}
        >
          Your Personal Stream Manager.
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: 28,
            color: "#9CA3AF",
            textAlign: "center",
            maxWidth: 900,
            lineHeight: 1.4,
            marginBottom: 48,
            display: "flex",
          }}
        >
          AI coach that reviews your Twitch VODs and tells you what to fix.
        </div>

        {/* Badge */}
        <div
          style={{
            background: "rgba(168,85,247,0.15)",
            border: "2px solid rgba(168,85,247,0.5)",
            color: "#C084FC",
            fontSize: 20,
            fontWeight: 700,
            padding: "12px 28px",
            borderRadius: 999,
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          FREE TO START · NO CREDIT CARD
        </div>
      </div>
    ),
    { ...size }
  );
}
