import { Archivo, Big_Shoulders, Roboto } from "next/font/google";

/**
 * The caption face. Clips are burned with Roboto Bold (src/lib/fonts), so
 * the clip editor previews captions in the same font at the same size.
 * Exposed as --font-roboto.
 */
export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-roboto",
  display: "swap",
});

/**
 * The condensed face for numbers and result words (scores, ranks, the
 * proof strip). Loaded here once so the homepage, /analyze and shared
 * reports all use the same file. Exposed as --font-shoulders, which
 * home-ranked.css reads through --v3-display.
 */
export const shoulders = Big_Shoulders({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-shoulders",
  display: "swap",
});

/**
 * The headline face: Archivo, set wide. Most generated sites ship Plus
 * Jakarta or Geist for headings; a wide grotesk reads closer to the
 * streamer tools people already trust. Exposed as --font-archivo, which
 * home-ranked.css reads through --v3-head.
 */
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});
