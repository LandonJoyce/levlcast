import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LevlCast — Your Coach. Every Stream.";
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
          position: "relative",
        }}
      >
        {/* Purple glow */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "800px",
            height: "600px",
            background:
              "radial-gradient(ellipse at center, rgba(168,85,247,0.25) 0%, transparent 65%)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 900,
            background: "linear-gradient(135deg, #fff 20%, #C084FC 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: 24,
            letterSpacing: "-2px",
          }}
        >
          LevlCast
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#fff",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: "-3px",
            marginBottom: 24,
            maxWidth: 900,
          }}
        >
          Your Coach.{" "}
          <span style={{ color: "#A855F7" }}>Every Stream.</span>
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: 26,
            color: "#9CA3AF",
            textAlign: "center",
            maxWidth: 700,
            lineHeight: 1.4,
          }}
        >
          AI-powered tools that analyze your Twitch VODs, generate clips, and
          tell you exactly what to improve.
        </div>

        {/* Badge */}
        <div
          style={{
            marginTop: 40,
            background: "rgba(168,85,247,0.15)",
            border: "1px solid rgba(168,85,247,0.4)",
            color: "#C084FC",
            fontSize: 18,
            fontWeight: 700,
            padding: "10px 24px",
            borderRadius: 999,
            letterSpacing: "1px",
          }}
        >
          FREE TO START · NO CREDIT CARD REQUIRED
        </div>
      </div>
    ),
    { ...size }
  );
}
