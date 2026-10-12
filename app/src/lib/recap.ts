/**
 * A streamer's month on LevlCast: the "Your October" recap.
 *
 * Built from what's already stored: every ready report (for the rank chain
 * and the results), that month's reports (for fixes, scores and the best
 * stream), clips and OBS sessions. A stream belongs to the month it was
 * streamed in. Sealed results stay sealed: they aren't counted in the
 * record or the rank, the recap just says how many are waiting.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMatchHistory, type MatchVodRow, type StreamMatch } from "@/lib/match-history";
import type { Rank } from "@/lib/rank";

export interface Recap {
  /** "2026-10" */
  month: string;
  /** "October" */
  name: string;
  year: number;
  /** The month isn't over yet. */
  current: boolean;
  streams: number;
  hours: number;
  wins: number;
  losses: number;
  /** Rank going into the month, or null when they were placed this month. */
  rankStart: Rank | null;
  /** Rank after the month's last opened result. */
  rankEnd: Rank | null;
  /** Points gained or lost over the month (opened results only). */
  points: number | null;
  sealed: number;
  fixes: { done: number; partly: number; checked: number; lines: Array<{ line: string; status: "fixed" | "partial"; times: number }> };
  best: { id: string; title: string; delta: number } | null;
  improved: { label: string; from: number; to: number } | null;
  clips: number;
  clip: { id: string; title: string; thumbnail: string | null } | null;
  live: { streams: number; peak: number; followers: number | null } | null;
  /** What to carry into next month: the latest report's fix. */
  nextFix: string | null;
}

interface ReportShape {
  overall_score?: number;
  recommendation?: string;
  score_breakdown?: Record<string, number>;
  progress_on_prior_fix?: { prior_priority?: string; status?: string };
}

const SUB_SCORES: Array<[key: string, label: string]> = [
  ["energy", "Energy"],
  ["engagement", "Engagement"],
  ["consistency", "Consistency"],
  ["content", "Content"],
];

export function monthBounds(month: string): { start: string; end: string; name: string; year: number } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    name: start.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
    year: y,
  };
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The month a recap opens on: last month for the first week, this month after that. */
export function defaultRecapMonth(now = new Date()): string {
  if (now.getUTCDate() <= 7) return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
  return monthKey(now);
}

export const MONTH_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;

/**
 * `supabase` reads the user's own rows (reports, clips); `admin` reads the
 * OBS sessions, which the user's client can't.
 */
export async function buildRecap(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  userId: string,
  month: string,
  now = new Date()
): Promise<Recap> {
  const { start, end, name, year } = monthBounds(month);

  const [{ data: all }, { data: monthReports }, { data: clipRows }, { data: sessions }] = await Promise.all([
    supabase
      .from("vods")
      .select("id, title, analyzed_at, stream_date, created_at, duration_seconds, rank_delta, rank_points_after, result_opened_at, result_call")
      .eq("user_id", userId)
      .eq("status", "ready"),
    supabase
      .from("vods")
      .select("id, title, stream_date, duration_seconds, coach_report")
      .eq("user_id", userId)
      .eq("status", "ready")
      .gte("stream_date", start)
      .lt("stream_date", end)
      .order("stream_date", { ascending: true }),
    supabase
      .from("clips")
      .select("id, title, thumbnail_url, peak_score, vod_id")
      .eq("user_id", userId)
      .eq("status", "ready")
      .gte("created_at", start)
      .lt("created_at", end),
    admin
      .from("live_sessions")
      .select("started_at, peak_viewers, followers_start, followers_end")
      .eq("user_id", userId)
      .gte("started_at", start)
      .lt("started_at", end),
  ]);

  const reports = (monthReports ?? []) as Array<{ id: string; title: string | null; stream_date: string | null; duration_seconds: number | null; coach_report: ReportShape | null }>;
  const inMonth = new Set(reports.map((r) => r.id));

  // The rank chain needs every report, so a stream's result reads the same
  // as it does on the Matches page.
  const matches = buildMatchHistory((all ?? []) as MatchVodRow[]).filter((m): m is StreamMatch => m.kind === "stream");
  const chronological = [...matches].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const monthMatches = chronological.filter((m) => inMonth.has(m.id));
  const opened = monthMatches.filter((m) => !m.sealed);
  const sealed = monthMatches.filter((m) => m.sealed).length;

  // Rank going in: the last opened, ranked result before this month's first.
  const firstAt = monthMatches[0]?.at ?? start;
  const before = chronological.filter((m) => m.at < firstAt && !m.sealed && m.rank).pop();
  const lastOpened = [...opened].reverse().find((m) => m.rank);
  const rankStart = before?.rank ?? null;
  const rankEnd = lastOpened?.rank ?? rankStart;
  const points = rankEnd && rankStart ? rankEnd.points - rankStart.points : null;

  const wins = opened.filter((m) => m.result === "win").length;
  const losses = opened.filter((m) => m.result === "loss").length;
  const bestMatch = opened
    .filter((m) => m.result === "win" && m.delta !== null)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))[0];
  const best = bestMatch ? { id: bestMatch.id, title: bestMatch.title || "Untitled stream", delta: bestMatch.delta ?? 0 } : null;

  // Fixes: each report checks the one before it.
  const fixes = { done: 0, partly: 0, checked: 0, lines: [] as Recap["fixes"]["lines"] };
  for (const r of reports) {
    const p = r.coach_report?.progress_on_prior_fix;
    if (!p?.status || p.status === "didnt_come_up") continue;
    fixes.checked++;
    if (p.status === "fixed") fixes.done++;
    if (p.status === "partial") fixes.partly++;
    if ((p.status === "fixed" || p.status === "partial") && p.prior_priority) {
      // The same fix often runs for several streams: one line each, the best result.
      const line = firstSentence(p.prior_priority);
      const seen = fixes.lines.find((f) => f.line === line);
      if (seen) {
        seen.times++;
        if (p.status === "fixed") seen.status = "fixed";
      } else {
        fixes.lines.push({ line, status: p.status, times: 1 });
      }
    }
  }

  // Most improved: the biggest rise from the month's first report to its last.
  let improved: Recap["improved"] = null;
  const scored = reports.filter((r) => r.coach_report?.score_breakdown);
  if (scored.length >= 2) {
    const a = scored[0].coach_report!.score_breakdown!;
    const b = scored[scored.length - 1].coach_report!.score_breakdown!;
    for (const [key, label] of SUB_SCORES) {
      if (typeof a[key] !== "number" || typeof b[key] !== "number") continue;
      const rise = b[key] - a[key];
      if (rise >= 3 && (!improved || rise > improved.to - improved.from)) improved = { label, from: a[key], to: b[key] };
    }
  }

  const clipList = (clipRows ?? []) as Array<{ id: string; title: string | null; thumbnail_url: string | null; peak_score: number | null; vod_id: string | null }>;
  const topClip = [...clipList].sort((a, b) => (b.peak_score ?? 0) - (a.peak_score ?? 0))[0];

  const live = (sessions ?? []) as Array<{ peak_viewers: number | null; followers_start: number | null; followers_end: number | null }>;
  const followerRuns = live.filter((s) => typeof s.followers_start === "number" && typeof s.followers_end === "number");

  fixes.lines = fixes.lines.sort((a, b) => (a.status === b.status ? 0 : a.status === "fixed" ? -1 : 1)).slice(0, 3);

  const latest = [...reports].reverse().find((r) => r.coach_report?.recommendation);

  return {
    month,
    name,
    year,
    current: monthKey(now) === month,
    streams: reports.length,
    hours: Math.round(reports.reduce((s, r) => s + (r.duration_seconds ?? 0), 0) / 360) / 10,
    wins,
    losses,
    rankStart,
    rankEnd,
    points,
    sealed,
    fixes,
    best,
    improved,
    clips: clipList.length,
    clip: topClip ? { id: topClip.id, title: topClip.title || "Your clip", thumbnail: topClip.thumbnail_url } : null,
    live: live.length
      ? {
          streams: live.length,
          peak: Math.max(0, ...live.map((s) => s.peak_viewers ?? 0)),
          followers: followerRuns.length ? followerRuns.reduce((s, r) => s + ((r.followers_end ?? 0) - (r.followers_start ?? 0)), 0) : null,
        }
      : null,
    nextFix: latest?.coach_report?.recommendation ? firstSentence(latest.coach_report.recommendation) : null,
  };
}

/** The first sentence, for a fix line that reads on one or two lines. */
function firstSentence(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  const m = t.match(/^.+?[.!?](\s|$)/);
  return (m ? m[0] : t).trim();
}

/** Months with at least one analyzed stream, newest first, for the month picker. */
export async function recapMonths(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase.from("vods").select("stream_date").eq("user_id", userId).eq("status", "ready").not("stream_date", "is", null);
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ stream_date: string }>) set.add(monthKey(new Date(r.stream_date)));
  return [...set].sort().reverse();
}
