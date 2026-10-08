/**
 * Tonight's fix for the live panel: the main recommendation of the
 * streamer's latest report, which is exactly what their next report grades
 * (progress_on_prior_fix, from the most recent prior report by stream date,
 * in lib/inngest/functions.ts). Recommendations run two or three sentences
 * with praise and reasons; the panel needs the one thing to do, so Haiku
 * shortens it once per report. If that call fails, the recommendation's
 * last sentence (usually the actual ask) stands in.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readReportJson } from "@/lib/analyze";
import { COACH_MODEL } from "./coach";
import { fixKind, type FixKind, type LiveFix } from "./cues";

const KINDS: FixKind[] = ["opening", "quiet", "chat", "other"];

const SYSTEM = `You turn the main recommendation from a Twitch streamer's coaching report into one short line they keep in view while they're live.

- One thing they can do during the stream, said as a plain instruction.
- 12 words at most. Plain words. No dashes, quote marks or emojis.
- Keep what's specific to them (their game, their bit, their habit). Drop praise and reasons.

Also say what it's mostly about: "opening" (how the stream starts), "quiet" (talking through quiet stretches), "chat" (talking to chat or chatters), or "other".

Reply with JSON only: {"line": "...", "kind": "opening" | "quiet" | "chat" | "other"}`;

/** Dashes and quotes read like a machine wrote them. */
function tidy(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The recommendation's last real sentence (five words or more), which is usually the ask itself. */
export function fallbackLine(recommendation: string): string {
  const sentences = tidy(recommendation).match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const real = sentences.filter((s) => s.split(/\s+/).length >= 5);
  const last = real[real.length - 1] ?? sentences[sentences.length - 1] ?? tidy(recommendation);
  return last.length > 140 ? `${last.slice(0, 137).trimEnd()}...` : last;
}

/** One line and what it's about, from a report's recommendation. */
export async function shortFix(recommendation: string): Promise<LiveFix> {
  const fallback: LiveFix = { line: fallbackLine(recommendation), kind: fixKind(recommendation) };
  try {
    const res = await new Anthropic().messages.create(
      {
        model: COACH_MODEL,
        max_tokens: 100,
        temperature: 0,
        system: SYSTEM,
        messages: [{ role: "user", content: recommendation }],
      },
      { timeout: 10_000, maxRetries: 1 }
    );
    const json = readReportJson(res.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
    const line = typeof json?.line === "string" ? tidy(json.line).replace(/[.!]*$/, ".") : "";
    if (line.length < 8 || line.length > 120) return fallback;
    const kind = KINDS.includes(json?.kind as FixKind) ? (json!.kind as FixKind) : fixKind(recommendation);
    return { line, kind };
  } catch (err) {
    console.warn("[live] fix line failed:", err instanceof Error ? err.message : err);
    return fallback;
  }
}

/** Shortened lines by report id: a report's recommendation never changes. */
const lineCache = new Map<string, LiveFix>();
/** Which report is the latest, per streamer, rechecked every few minutes: it changes when a report lands. */
const latestCache = new Map<string, { at: number; fix: LiveFix | null }>();

/** Tonight's fix for a streamer, or null before their first report. */
export async function currentFix(admin: SupabaseClient, userId: string): Promise<LiveFix | null> {
  const hit = latestCache.get(userId);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.fix;
  let fix: LiveFix | null = null;
  try {
    // The same report the next one will grade: latest by stream date.
    const { data } = await admin
      .from("vods")
      .select("id, coach_report")
      .eq("user_id", userId)
      .eq("status", "ready")
      .not("coach_report", "is", null)
      .order("stream_date", { ascending: false })
      .limit(1);
    const row = ((data ?? [])[0] ?? null) as { id: string; coach_report: { recommendation?: unknown } | null } | null;
    const rec = typeof row?.coach_report?.recommendation === "string" ? row.coach_report.recommendation.trim() : "";
    if (row && rec) {
      fix = lineCache.get(row.id) ?? null;
      if (!fix) {
        fix = await shortFix(rec);
        if (lineCache.size > 500) lineCache.clear();
        lineCache.set(row.id, fix);
      }
    }
  } catch {
    // No fix this time; the panel works without one.
  }
  latestCache.set(userId, { at: Date.now(), fix });
  return fix;
}
