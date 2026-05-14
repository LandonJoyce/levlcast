import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, cleanupOrphanedR2Objects, computeBurnoutScores, computeContentReports, computeCollabSuggestions, compileWeeklyDigest, sendActivationNudge, sendStreakNudge, autoSyncTwitchVods } from "@/lib/inngest/functions";

// Vercel Pro w/ Fluid Compute caps at 800s. Each Inngest step (every
// transcribe-chunk, clip generation, etc.) runs under this budget. Some
// transcription chunks have been observed to take 5-6 minutes on dense
// audio, so we go well above the default 300s.
export const maxDuration = 800;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, cleanupOrphanedR2Objects, computeBurnoutScores, computeContentReports, computeCollabSuggestions, compileWeeklyDigest, sendActivationNudge, sendStreakNudge, autoSyncTwitchVods],
});
