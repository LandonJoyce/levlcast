import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, computeBurnoutScores } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyzeVod, generateClip, cleanupStuckClips, cleanupStuckVods, computeBurnoutScores],
});
