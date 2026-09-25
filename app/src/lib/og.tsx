/**
 * Shared bits for the link preview images (opengraph-image.tsx files).
 *
 * These are the pictures Discord, Reddit, iMessage and X show when someone
 * pastes a LevlCast link, so they use the site's own faces rather than the
 * renderer's default sans. The fonts are static Latin TTFs in
 * src/lib/fonts (Satori can't read woff2 or variable fonts).
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FONTS = join(process.cwd(), "src/lib/fonts");

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  bg: "#100D0E",
  fg: "#FFFAF7",
  mute: "#E4DAD7",
  dim: "#A69897",
  faint: "#928688",
  line: "rgba(255, 238, 230, 0.14)",
  corner: "rgba(255, 238, 230, 0.34)",
  gold: "#E3B341",
  good: "#A3E635",
  warn: "#FCD093",
};

export async function ogFonts() {
  const [display, numbers, mono, body] = await Promise.all([
    readFile(join(FONTS, "PlusJakartaSans-ExtraBold.ttf")),
    readFile(join(FONTS, "BigShoulders-Black.ttf")),
    readFile(join(FONTS, "GeistMono-Medium.ttf")),
    readFile(join(FONTS, "Geist-Medium.ttf")),
  ]);
  return [
    { name: "Display", data: display, weight: 800 as const, style: "normal" as const },
    { name: "Numbers", data: numbers, weight: 900 as const, style: "normal" as const },
    { name: "Mono", data: mono, weight: 500 as const, style: "normal" as const },
    { name: "Body", data: body, weight: 500 as const, style: "normal" as const },
  ];
}

/** A rank emblem from /public/ranks as a data URI, for an <img> in Satori. */
export async function emblemSrc(tier: string) {
  const png = await readFile(join(process.cwd(), "public/ranks", `${tier.toLowerCase()}.png`));
  return `data:image/png;base64,${png.toString("base64")}`;
}

/**
 * The corner-marked frame the site draws around its result screens. Built
 * from rows of bordered squares rather than absolutely placed strokes,
 * which Satori measures from the wrong box.
 */
export function Framed({
  children,
  width,
  align = "stretch",
}: {
  children: React.ReactNode;
  width: number;
  align?: "stretch" | "center";
}) {
  const c = 24;
  const edge = `2px solid ${OG.corner}`;
  const row = { display: "flex", justifyContent: "space-between" } as const;
  return (
    <div style={{ display: "flex", flexDirection: "column", width, background: "rgba(255, 238, 230, 0.02)" }}>
      <div style={row}>
        <div style={{ width: c, height: c, borderTop: edge, borderLeft: edge }} />
        <div style={{ width: c, height: c, borderTop: edge, borderRight: edge }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: align, padding: "0 30px", margin: "-6px 0" }}>
        {children}
      </div>
      <div style={row}>
        <div style={{ width: c, height: c, borderBottom: edge, borderLeft: edge }} />
        <div style={{ width: c, height: c, borderBottom: edge, borderRight: edge }} />
      </div>
    </div>
  );
}

/**
 * A line of display type whose last character is punctuation. Plus Jakarta
 * at this weight and tracking leaves a gap before "." and "?", so the mark
 * is set on its own and pulled back in.
 */
export function Line({ text, color, size }: { text: string; color: string; size: number }) {
  const body = text.slice(0, -1);
  const mark = text.slice(-1);
  const type = { fontFamily: "Display", fontSize: size, lineHeight: 1.02, letterSpacing: size * -0.034, color };
  return (
    <div style={{ display: "flex" }}>
      <div style={type}>{body}</div>
      <div style={{ ...type, marginLeft: size * -0.07 }}>{mark}</div>
    </div>
  );
}

/** The top line of every preview: the wordmark and where the link goes. */
export function OgTop({ path }: { path: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontFamily: "Display", fontSize: 34, color: OG.fg, letterSpacing: -0.7 }}>LevlCast</div>
      <div style={{ fontFamily: "Mono", fontSize: 20, color: OG.faint, letterSpacing: 1 }}>{path}</div>
    </div>
  );
}
