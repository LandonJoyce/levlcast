import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, computeBurnoutScores, computeContentReports, computeCollabSuggestions, compileWeeklyDigest, sendActivationNudge, sendStreakNudge } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, computeBurnoutScores, computeContentReports, computeCollabSuggestions, compileWeeklyDigest, sendActivationNudge, sendStreakNudge],
});
