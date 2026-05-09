import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, cleanupOrphanedR2Objects, computeBurnoutScores, computeContentReports, computeCollabSuggestions, compileWeeklyDigest, sendActivationNudge, sendStreakNudge, autoSyncTwitchVods } from "@/lib/inngest/functions";

// Allow up to 300s — clip generation needs time to download segments and encode video
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, cleanupOrphanedR2Objects, computeBurnoutScores, computeContentReports, computeCollabSuggestions, compileWeeklyDigest, sendActivationNudge, sendStreakNudge, autoSyncTwitchVods],
});
