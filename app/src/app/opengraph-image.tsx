import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { OG, OG_SIZE, Line, OgTop, ogFonts } from "@/lib/og";

/**
 * The picture shown when someone shares levlcast.com. It's the homepage's
 * hero in miniature: coaching on the left, the panel in OBS on the right.
 * Since 2026-10-06 the coach leads; before that it was the rank promotion
 * ("You streamed four hours. Did you rank up?").
 */

export const alt = "LevlCast: coaching for Twitch streamers. The LevlCast panel in OBS with a coaching tip.";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The panel, cropped from the OBS picture, as a data URI for Satori. */
async function panelSrc() {
  const png = await readFile(join(process.cwd(), "public/live/levlcast-panel.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}

export default async function Image() {
  const [fonts, panel] = await Promise.all([ogFonts(), panelSrc()]);
  const head = { fontFamily: "Display", fontSize: 72, lineHeight: 1.02, letterSpacing: 72 * -0.034, color: OG.fg };

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
          padding: "52px 72px 56px",
        }}
      >
        <OgTop path="levlcast.com" />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: 660 }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ ...head, display: "flex" }}>Coaching for</div>
              <Line text="Twitch streamers." color={OG.fg} size={72} />
            </div>
            <div style={{ display: "flex", fontFamily: "Body", fontSize: 26, lineHeight: 1.4, color: OG.mute, marginTop: 22, width: 540 }}>
              We coach you live inside OBS, and after every stream we tell you what to fix.
            </div>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={panel} width={344} height={406} style={{ borderRadius: 14, border: `1px solid ${OG.line}` }} alt="" />
        </div>

        <div style={{ fontFamily: "Mono", fontSize: 19, color: OG.faint, letterSpacing: 0.6 }}>
          Free to start, no card needed.
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
