import { ImageResponse } from "next/og";
import { OG, OG_SIZE, Framed, OgTop, ogFonts } from "@/lib/og";

/**
 * The picture shown when an /analyze link is shared, which is every
 * outreach DM. The page's own openGraph settings replaced the site-wide
 * image, so these links used to unfurl with no picture at all.
 */

export const alt = "LevlCast: get a free report on your last stream. Example report with an opening score of 68.";
export const size = OG_SIZE;
export const contentType = "image/png";

const label = { fontFamily: "Mono", fontSize: 16, letterSpacing: 2, color: OG.faint };

export default async function Image() {
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG.bg,
          padding: "56px 72px 60px",
        }}
      >
        <OgTop path="levlcast.com/analyze" />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 630 }}>
            <div style={{ ...label, marginBottom: 22 }}>FREE, NO ACCOUNT</div>
            <div style={{ fontFamily: "Display", fontSize: 62, lineHeight: 1.04, letterSpacing: -2.1, color: OG.fg }}>
              Get a free report on your last stream
            </div>
            <div style={{ fontFamily: "Body", fontSize: 25, lineHeight: 1.42, color: OG.mute, marginTop: 24, width: 540 }}>
              Paste a Twitch VOD link. See what&apos;s working, what&apos;s costing you viewers and what to clip.
            </div>
          </div>

          <Framed width={380}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={label}>EXAMPLE REPORT</div>
              <div style={label}>FIRST 12 MIN</div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 16,
                marginTop: 16,
                paddingBottom: 18,
                borderBottom: `1px solid ${OG.line}`,
              }}
            >
              <div style={{ fontFamily: "Numbers", fontSize: 96, lineHeight: 0.9, color: OG.warn }}>68</div>
              <div style={label}>OPENING SCORE</div>
            </div>
            <div style={{ ...label, marginTop: 18 }}>FIX THIS FIRST</div>
            <div style={{ fontFamily: "Body", fontSize: 23, lineHeight: 1.4, color: OG.fg, marginTop: 10 }}>
              Say what today&apos;s stream is in the first minute, before you touch the menu.
            </div>
          </Framed>
        </div>

        <div style={{ fontFamily: "Mono", fontSize: 19, color: OG.faint, letterSpacing: 0.6 }}>
          Reads the first 12 minutes of any stream. Sign in and it reads the whole thing.
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
