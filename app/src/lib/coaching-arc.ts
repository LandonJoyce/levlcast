import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CoachingArcData {
  synthesis: string;
  recurring_improvements: string[];
  improving_areas: string[];
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
    .select("id, stream_date, coach_report")
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

  const anthropic = new Anthropic();
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `You are reviewing coaching data for a Twitch streamer across ${recent.length} streams, listed oldest to newest.

${streamsText}

Tasks:
1. Find 1-2 themes that appear in 2 or more streams (persistent problems). Max 8 words each. Be specific and direct.
2. Find themes from the first 2 streams that do NOT appear in the last 2 streams (they improved). Max 8 words each. If none, use an empty array.
3. Write 2 sentences about their coaching arc. Reference specific scores and patterns. Plain sentences only. No em dashes. No bullet points. No markdown.

Respond with valid JSON only: { "recurring": string[], "improved": string[], "synthesis": string }`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;

  let parsed: { recurring: string[]; improved: string[]; synthesis: string };
  try {
    const match = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(match?.[0] ?? "{}");
  } catch {
    return null;
  }

  const clean = (s: string) => s.replace(/—/g, " - ").replace(/–/g, " - ").trim();

  return {
    synthesis: clean(parsed.synthesis ?? ""),
    recurring_improvements: (parsed.recurring ?? []).map(clean),
    improving_areas: (parsed.improved ?? []).map(clean),
    score_history: scoreHistory,
    generated_for_vod_id: latestVodId,
  };
}
