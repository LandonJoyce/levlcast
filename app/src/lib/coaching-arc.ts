import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CoachingArcData {
  synthesis: string;
  recurring_improvements: string[];
  improving_areas: string[];
  /**
   * Parallel to recurring_improvements (same length, same index). Each entry
   * is 2-3 short example lines the streamer could actually say next stream to
   * address that recurring issue. Game-specific where possible. Empty array
   * means the model couldn't produce examples for that issue.
   */
  recurring_examples?: string[][];
  score_history: Array<{ score: number; date: string; vod_id: string }>;
  generated_for_vod_id: string;
}

export async function generateCoachingArc(
  userId: string,
  latestVodId: string,
  supabase: SupabaseClient
): Promise<CoachingArcData | null> {
  const { data: vods } = await supabase
    .from("vods")
    .select("id, stream_date, coach_report, game_category, title")
    .eq("user_id", userId)
    .eq("status", "ready")
    .not("coach_report", "is", null)
    .order("stream_date", { ascending: false })
    .limit(8);

  if (!vods || vods.length < 3) return null;

  const recent = vods.slice(0, 5).reverse(); // oldest first for display

  const scoreHistory = recent.map((v) => ({
    score: (v.coach_report as any)?.overall_score ?? 0,
    date: v.stream_date,
    vod_id: v.id,
  }));

  const streamsText = recent
    .map((v, i) => {
      const r = v.coach_report as any;
      const improvements: string[] = r?.improvements ?? [];
      return `Stream ${i + 1} (score ${r?.overall_score ?? 0}, ${v.stream_date?.slice(0, 10) ?? ""}):\n${improvements.map((s: string) => `  - ${s}`).join("\n") || "  - (none flagged)"}`;
    })
    .join("\n\n");

  // Pick a representative game so the example talking points feel game-
  // specific. Use the most recent stream's category, falling back to whatever
  // we have. Empty string when nothing is set.
  const latestVod = vods[0];
  const gameContext = (latestVod?.game_category as string | null) || (latestVod?.title as string | null) || "";

  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 700,
    messages: [
      {
        role: "user",
        content: `You are reviewing coaching data for a Twitch streamer across ${recent.length} streams, listed oldest to newest.${gameContext ? `\n\nThe streamer mostly plays / streams: ${gameContext}` : ""}

${streamsText}

Tasks:
1. Find 1-2 themes that appear in 2 or more streams (persistent problems). Max 8 words each. Be specific and direct.
2. Find themes from the first 2 streams that do NOT appear in the last 2 streams (they improved). Max 8 words each. If none, use an empty array.
3. Write 2 sentences about their coaching arc. Reference specific scores and patterns. Plain sentences only. No em dashes. No bullet points. No markdown.
4. For EACH recurring theme from task 1, write 2 short example lines the streamer could actually say next stream to address it. Use first person. Make them sound like a real streamer (casual, opinionated, sometimes blunt). Reference their game when natural. Max 18 words per line. No em dashes. No quotes around the lines.

The "recurring_examples" array must be parallel to "recurring": same length, same order. Each entry is an array of 2 example lines for the corresponding recurring theme.

Respond with valid JSON only: { "recurring": string[], "improved": string[], "synthesis": string, "recurring_examples": string[][] }`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;

  let parsed: { recurring: string[]; improved: string[]; synthesis: string; recurring_examples?: string[][] };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? "{}");
  } catch {
    return null;
  }

  // Strip em/en dashes per the project-wide rule. ' — ' (with spaces) becomes
  // '. ' so sentences still flow; bare dashes become a single space. Avoid
  // hyphen replacements since 'word-word' reads the same way as an em dash.
  const clean = (s: string) =>
    s
      .replace(/ [—–] /g, ". ")
      .replace(/[—–]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

  // Pad / trim recurring_examples so it's always parallel to recurring,
  // even if the model returned the wrong shape.
  const recurring = (parsed.recurring ?? []).map(clean);
  const rawExamples = Array.isArray(parsed.recurring_examples) ? parsed.recurring_examples : [];
  const recurring_examples = recurring.map((_, i) => {
    const entry = Array.isArray(rawExamples[i]) ? rawExamples[i] : [];
    return entry
      .filter((s): s is string => typeof s === "string")
      .map(clean)
      .filter((s) => s.length > 0)
      .slice(0, 3);
  });

  return {
    synthesis: clean(parsed.synthesis ?? ""),
    recurring_improvements: recurring,
    improving_areas: (parsed.improved ?? []).map(clean),
    recurring_examples,
    score_history: scoreHistory,
    generated_for_vod_id: latestVodId,
  };
}
