import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, cleanupOrphanedR2Objects, computeBurnoutScores, computeContentReports, compileWeeklyDigest, sendActivationNudge, sendStreakNudge, autoSyncTwitchVods } from "@/lib/inngest/functions";

// Capped at 300s — Vercel Hobby's hard max. Each Inngest step runs as a
// separate webhook invocation, and every step in our pipeline (get-vod-
// segments ~5s, transcribe-chunk ~30-60s with our 12-chunk cap,
// detect-peaks ~20-60s, generate-coach-report ~30-90s, clip generate
// ~30-90s) fits comfortably under this. If a single step ever exceeds
// 300s, Inngest will retry it once and surface a clear failure to the
// user — the analyze pipeline as a whole keeps running across steps.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, cleanupOrphanedR2Objects, computeBurnoutScores, computeContentReports, compileWeeklyDigest, sendActivationNudge, sendStreakNudge, autoSyncTwitchVods],
});
