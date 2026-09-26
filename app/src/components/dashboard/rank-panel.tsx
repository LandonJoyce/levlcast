"use client";

import { useEffect, useRef, useState } from "react";
import { rankFromPoints, TIERS, TIER_HEX, DIVISION_SIZE, type Rank } from "@/lib/rank";

/**
 * The rank at the top of the dashboard, played back each visit: the points
 * count up from where they were before the last stream, and the bar fills
 * by what that stream earned. Seeing the +34 land again is the reward for
 * opening the page. Under reduced motion it just shows where you are.
 */

function nextDivision(rank: Rank): string | null {
  const i = TIERS.findIndex((t) => t.name === rank.tier);
  if (rank.division === null) return TIERS[i + 1]?.name ?? null;
  if (rank.division > 1) return `${rank.tier} ${["", "I", "II", "III", "IV"][rank.division - 1]}`;
  const next = TIERS[i + 1];
  if (!next) return null;
  return next.name === "Master" || next.name === "Grandmaster" ? next.name : `${next.name} IV`;
}

/** "about 3 wins", from what this streamer's wins usually pay. */
function winsAway(toNext: number, avgWin: number | null): string | null {
  if (!avgWin || avgWin <= 0) return null;
  const n = Math.ceil(toNext / avgWin);
  if (n <= 1) return "one win away";
  if (n > 12) return null;
  return `about ${n} wins`;
}

export function RankPanel({
  points,
  delta,
  avgWin = null,
  label = "Your rank",
}: {
  points: number | null;
  delta: number | null;
  /** The streamer's average win, for the "about N wins" estimate. */
  avgWin?: number | null;
  label?: string;
}) {
  const [shown, setShown] = useState<number | null>(null);
  const [fill, setFill] = useState<number | null>(null);
  const started = useRef(false);

  const rank = points === null ? null : rankFromPoints(points);
  // Placements record the whole starting rating as their delta; don't
  // replay those as a gain from zero.
  const gain = delta !== null && Math.abs(delta) < 200 ? delta : 0;
  const before = points === null ? null : rankFromPoints(points - gain);
  const placed = delta !== null && Math.abs(delta) >= 200;
  const promoted = !!(rank && before && gain > 0 && before.label !== rank.label);
  const demoted = !!(rank && before && gain < 0 && before.label !== rank.label);

  useEffect(() => {
    if (!rank || started.current) return;
    started.current = true;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || gain === 0 || points === null) {
      setShown(points);
      setFill(rank.progress);
      return;
    }
    // Start where the last stream began: in the old division if it moved.
    const startFill = promoted ? 0 : before && before.label === rank.label ? before.progress : 0;
    setShown(points - gain);
    setFill(startFill);
    const t0 = performance.now() + 350;
    const dur = 900;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / dur));
      const ease = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(points - gain + gain * ease));
      setFill(startFill + (rank.progress - startFill) * ease);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  if (!rank || points === null) {
    return (
      <div className="rp rp-unranked">
        <p className="rp-k">{label}</p>
        <p className="rp-tier">Unranked</p>
        <p className="rp-note">Analyze a stream and your first report places you on the ladder.</p>
      </div>
    );
  }

  const color = TIER_HEX[rank.tier] ?? "#fff";
  const next = nextDivision(rank);
  const toNext = rank.division === null ? null : DIVISION_SIZE - (points % DIVISION_SIZE);
  const away = toNext !== null ? winsAway(toNext, avgWin) : null;
  const displayPoints = (shown ?? points).toLocaleString("en-US");

  return (
    <div className="rp" style={{ ["--tier" as string]: color }}>
      <p className="rp-k">
        {label}
        {placed && <span className="rp-tag rp-tag-up">Placed</span>}
        {promoted && <span className="rp-tag rp-tag-up">Promoted</span>}
        {demoted && <span className="rp-tag rp-tag-down">Dropped a division</span>}
      </p>
      <div className="rp-main">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="rp-emb" src={`/ranks/${rank.tier.toLowerCase()}.png`} alt="" width={384} height={384} />
        <div className="rp-body">
          <p className="rp-tier">{rank.label}</p>
          <p className="rp-points">
            <span className="rp-num">{displayPoints}</span> points
            {gain !== 0 && (
              <span className="rp-delta" data-sign={gain > 0 ? "up" : "down"}>
                {gain > 0 ? `+${gain}` : `−${Math.abs(gain)}`}
              </span>
            )}
          </p>
        </div>
      </div>
      <div className="rp-bar" aria-hidden="true">
        <span style={{ width: `${fill ?? rank.progress}%` }} />
      </div>
      <p className="rp-note">
        {next && toNext !== null ? (
          <>
            {toNext} points to {next}
            {away && <span> · {away}</span>}
          </>
        ) : next ? (
          `${rank.progress}% of the way to ${next}`
        ) : (
          "Top of the ladder"
        )}
      </p>
    </div>
  );
}
