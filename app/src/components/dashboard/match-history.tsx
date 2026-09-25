/**
 * Match history rows and the record above them.
 *
 * Laid out the way ranked players already read a match history: a
 * coloured edge that says win or loss before you read anything, the
 * points in the first column, the rank you ended on in the second. The
 * coach score is deliberately absent. The row is about the ladder; the
 * report behind the click is where the feedback lives.
 */

import Link from "next/link";
import { TIER_HEX } from "@/lib/rank";
import { ordinal } from "@/lib/utils";
import type { Match, MatchSummary, MatchTag } from "@/lib/match-history";

const RESULT_LABEL: Record<string, string> = {
  win: "Win",
  loss: "Loss",
  held: "Held",
  placement: "Placed",
  unranked: "Unranked",
};

const TAG_LABEL: Record<MatchTag, string> = {
  promoted: "Promoted",
  demoted: "Demoted",
  division_up: "Division up",
  division_down: "Division down",
  shield: "Shield held",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "...";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

const Chev = () => (
  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function MatchHistoryList({ matches }: { matches: Match[] }) {
  return (
    <div className="mh-list">
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </div>
  );
}

function MatchRow({ match }: { match: Match }) {
  const result = match.kind === "league" ? "league" : match.result;
  const tierColor = match.rank ? TIER_HEX[match.rank.tier] : undefined;

  const body = (
    <>
      <div className="mh-result">
        <span className="mh-result-label">{match.kind === "league" ? "League" : RESULT_LABEL[match.result]}</span>
        {match.delta !== null && <span className="mh-delta">{signed(match.delta)}</span>}
      </div>

      <div className="mh-rank" style={tierColor ? { ["--tier" as string]: tierColor } : undefined}>
        {match.rank ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/ranks/${match.rank.tier.toLowerCase()}.png`} alt="" aria-hidden="true" />
            <span>{match.rank.label}</span>
          </>
        ) : (
          <span className="mh-rank-none">No rank</span>
        )}
      </div>

      <div className="mh-main">
        <div className="mh-title">
          {match.kind === "league"
            ? `${ordinal(match.position)} of ${match.size} in ${match.leagueName}`
            : match.title || "Untitled stream"}
        </div>
        <div className="mh-meta">
          {match.kind === "league"
            ? `Week of ${formatDate(`${match.weekStart}T12:00:00Z`)}`
            : `${formatDate(match.at)} · ${formatDuration(match.durationSeconds)}`}
          {/* The rank column is dropped on a phone, so the rank rides in
              the meta line there instead of disappearing. */}
          {match.rank && (
            <span className="mh-meta-rank" style={{ color: tierColor }}>
              {" · "}
              {match.rank.label}
            </span>
          )}
        </div>
      </div>

      <div className="mh-tag-cell">
        {match.tag && (
          <span className="mh-tag" data-tag={match.tag}>
            {TAG_LABEL[match.tag]}
          </span>
        )}
      </div>

      <span className="mh-chev">{match.kind === "stream" ? <Chev /> : null}</span>
    </>
  );

  return match.kind === "stream" ? (
    <Link href={`/dashboard/vods/${match.id}`} className="mh-row" data-result={result}>
      {body}
    </Link>
  ) : (
    <div className="mh-row" data-result={result}>
      {body}
    </div>
  );
}

/** Record, win rate, net points and recent form, over the last 20 streams. */
export function MatchSummaryStrip({ summary }: { summary: MatchSummary }) {
  if (summary.games === 0) return null;
  return (
    <div className="mh-summary">
      <div className="mh-stat">
        <span className="mono-label">Record</span>
        <span className="mh-stat-n">
          <span className="mh-w">{summary.wins}W</span> <span className="mh-l">{summary.losses}L</span>
        </span>
        <span className="mh-stat-sub">last {summary.games} streams</span>
      </div>
      <div className="mh-stat">
        <span className="mono-label">Win rate</span>
        <span className="mh-stat-n">{summary.winRate === null ? "..." : `${summary.winRate}%`}</span>
        <span className="mh-stat-sub">points gained vs lost</span>
      </div>
      <div className="mh-stat">
        <span className="mono-label">Net</span>
        <span className="mh-stat-n" data-sign={summary.net > 0 ? "up" : summary.net < 0 ? "down" : "flat"}>
          {signed(summary.net)}
        </span>
        <span className="mh-stat-sub">rank points</span>
      </div>
      <div className="mh-stat">
        <span className="mono-label">Form</span>
        <div className="mh-form" aria-label="Recent results, newest first">
          {summary.form.map((r, i) => (
            <span key={i} className="mh-pip" data-r={r}>
              {r === "win" ? "W" : r === "loss" ? "L" : "H"}
            </span>
          ))}
        </div>
        <span className="mh-stat-sub">newest first</span>
      </div>
    </div>
  );
}

/** "7W 3L" for card headers. */
export function recordLabel(summary: MatchSummary): string {
  return `${summary.wins}W ${summary.losses}L`;
}
