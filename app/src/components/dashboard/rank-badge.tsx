/**
 * The rank badge.
 *
 * This is the number that replaces "28 out of 100" as the first thing a
 * user sees. A score is a verdict; a rank is a position with somewhere to
 * go, and the progress bar underneath is the part that makes the next
 * stream feel worth analysing.
 *
 * Tier colours are the ones these users already read fluently from ranked
 * ladders, so nothing needs explaining: iron grey, bronze, silver, gold,
 * teal platinum, pale blue diamond, purple master.
 */

import { rankFromPoints, TIERS, type Rank } from "@/lib/rank";

const TIER_COLOR: Record<string, { fg: string; bg: string }> = {
  Iron: { fg: "#9AA0A6", bg: "rgba(154,160,166,0.12)" },
  Bronze: { fg: "#C1804B", bg: "rgba(193,128,75,0.14)" },
  Silver: { fg: "#B8C2CC", bg: "rgba(184,194,204,0.14)" },
  Gold: { fg: "#E3B341", bg: "rgba(227,179,65,0.14)" },
  Platinum: { fg: "#4FD1B9", bg: "rgba(79,209,185,0.14)" },
  Diamond: { fg: "#7CC5F5", bg: "rgba(124,197,245,0.14)" },
  Master: { fg: "#C084FC", bg: "rgba(192,132,252,0.16)" },
  Grandmaster: { fg: "#A855F7", bg: "rgba(168,85,247,0.18)" },
  Challenger: { fg: "#E879F9", bg: "rgba(232,121,249,0.18)" },
};

export function RankBadge({
  points,
  delta,
  size = "md",
}: {
  points: number | null;
  /** Points gained or lost on the most recent stream, if showing one. */
  delta?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  // Never placed. Say so plainly rather than rendering a fake Iron IV,
  // which would read as a judgement nobody has earned yet.
  if (points === null) {
    return (
      <div className="rank-badge rank-badge-unranked" data-size={size}>
        <span className="rank-badge-tier">Unranked</span>
        <span className="rank-badge-sub">Analyze a stream to place</span>
      </div>
    );
  }

  const rank: Rank = rankFromPoints(points);
  const color = TIER_COLOR[rank.tier] ?? TIER_COLOR.Iron;

  return (
    <div
      className="rank-badge"
      data-size={size}
      style={{ ["--rank-fg" as string]: color.fg, ["--rank-bg" as string]: color.bg }}
    >
      <div className="rank-badge-row">
        {/* The emblem does the emotional work; the words are the label.
            eslint-disable because these are small fixed-size local PNGs and
            next/image buys nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="rank-badge-emblem"
          src={`/ranks/${rank.tier.toLowerCase()}.png`}
          alt=""
          aria-hidden="true"
        />
        <span className="rank-badge-tier">{rank.label}</span>
        {typeof delta === "number" && delta !== 0 ? (
          <span className={`rank-badge-delta ${delta > 0 ? "up" : "down"}`}>
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        ) : null}
      </div>

      {/* Progress through the current division. The whole point of showing
          a bar rather than a number is that a partly-filled bar is an
          unfinished thing, and unfinished things get finished. */}
      <div className="rank-badge-track" aria-hidden="true">
        <div className="rank-badge-fill" style={{ width: `${rank.progress}%` }} />
      </div>
      <span className="rank-badge-sub">
        {rank.division === null
          ? `${rank.points} points`
          : `${rank.progress}% to ${nextLabel(rank)}`}
      </span>
    </div>
  );
}

function nextLabel(rank: Rank): string {
  if (rank.division === null) return "the top";
  if (rank.division > 1) return `${rank.tier} ${["", "I", "II", "III"][rank.division - 1]}`;
  // Division I means the next step is a whole new tier, which is the
  // promotion moment worth naming explicitly.
  // Read the order from the source of truth rather than repeating it, so
  // adding a tier never leaves this label pointing at the wrong one.
  const idx = TIERS.findIndex((t) => t.name === rank.tier);
  return TIERS[idx + 1]?.name ?? "the top";
}
