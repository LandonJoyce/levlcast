import { ImageResponse } from "next/og";
import { OG, OG_SIZE, Framed, Line, OgTop, emblemSrc, ogFonts } from "@/lib/og";

/**
 * The picture shown when someone shares levlcast.com. It's the homepage's
 * hero in miniature: the question on the left, the promotion screen on the
 * right. It replaced a purple "Your Personal Stream Manager." card in the
 * renderer's default font, which was the old brand and looked like it.
 */

export const alt = "LevlCast: you streamed four hours, did you rank up? A promotion to Gold IV, plus 34 points.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const [fonts, silver, gold] = await Promise.all([ogFonts(), emblemSrc("silver"), emblemSrc("gold")]);

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
        <OgTop path="levlcast.com" />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
            <Line text="You streamed" color="#7E7274" size={76} />
            <Line text="four hours." color="#7E7274" size={76} />
            <Line text="Did you rank up?" color={OG.fg} size={76} />
            <div style={{ fontFamily: "Body", fontSize: 26, lineHeight: 1.4, color: OG.mute, marginTop: 26, width: 520 }}>
              Coaching on every Twitch stream, and a rank from Iron to Grandmaster.
            </div>
          </div>

          <Framed width={390} align="center">
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={silver} width={76} height={76} style={{ opacity: 0.45 }} alt="" />
              <div style={{ width: 34, height: 2, background: OG.line }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={gold} width={150} height={150} alt="" />
            </div>
            <div style={{ fontFamily: "Numbers", fontSize: 92, lineHeight: 0.9, color: OG.gold, marginTop: 14 }}>
              PROMOTED
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 12 }}>
              <div style={{ fontFamily: "Display", fontSize: 26, color: OG.fg, letterSpacing: -0.4 }}>Gold IV</div>
              <div style={{ fontFamily: "Numbers", fontSize: 44, color: OG.good }}>+34</div>
            </div>
          </Framed>
        </div>

        <div style={{ fontFamily: "Mono", fontSize: 19, color: OG.faint, letterSpacing: 0.6 }}>
          Try it free on any Twitch VOD. No account needed.
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
