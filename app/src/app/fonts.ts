import { Big_Shoulders } from "next/font/google";

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
