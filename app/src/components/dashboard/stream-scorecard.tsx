"use client";

/**
 * Where the points went: four bars, the lowest one named.
 *
 * The report used to open as an essay: a narrative paragraph, then two
 * columns of prose, then opening and closing paragraphs. Everything true,
 * nothing scannable. This is what a game shows you after a match instead.
 * The one thing to do next stream sits beside it on the stream page.
 *
 * No letter grades. Real scores here run 8 to 30, so a grade scale hands
 * almost everyone an F. Bars move; grades judge.
 *
 * The bars are one neutral color, like the breakdown on the homepage.
 * The row that costs the most points is the one that gets a mark.
 */

import { useEffect, useState } from "react";

export interface Subscores {
  energy?: number;
  engagement?: number;
  consistency?: number;
  content?: number;
}

const METRICS: Array<{ key: keyof Subscores; label: string; blurb: string }> = [
  { key: "energy", label: "Energy", blurb: "How you sounded. Pace, volume, life." },
  { key: "engagement", label: "Engagement", blurb: "Talking to chat and reacting out loud." },
  { key: "consistency", label: "Consistency", blurb: "Holding it together instead of going flat." },
  { key: "content", label: "Content", blurb: "Having something to say about what's happening." },
];

export function StreamScorecard({
  scores,
  previousScores,
  deadAirPct,
}: {
  scores: Subscores | null;
  previousScores?: Subscores | null;
  deadAirPct?: number | null;
}) {
  // Bars fill on mount. A bar that's already full when the page paints is
  // a picture of a number; a bar that fills is the number changing.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 180);
    return () => clearTimeout(t);
  }, []);

  const rows = METRICS.map((m) => {
    const value = typeof scores?.[m.key] === "number" ? (scores[m.key] as number) : null;
    const prev = typeof previousScores?.[m.key] === "number" ? (previousScores[m.key] as number) : null;
    return { ...m, value, delta: value !== null && prev !== null ? value - prev : null };
  }).filter((r) => r.value !== null);

  if (rows.length === 0) return null;

  const worst = rows.reduce((lo, r) => ((r.value as number) < (lo.value as number) ? r : lo));

  return (
    <div className="sc" aria-label="Where the points went">
      <p className="hm-k">
        Where the points went
        {typeof deadAirPct === "number" && deadAirPct > 0 && (
          <span data-bad={deadAirPct >= 25 ? "yes" : undefined}>{Math.round(deadAirPct)}% silence</span>
        )}
      </p>
      <ul className="sc-rows">
        {rows.map((r) => {
          const v = r.value as number;
          const isWorst = rows.length > 1 && r.key === worst.key;
          return (
            <li key={r.key} className="sc-row" data-worst={isWorst ? "yes" : undefined}>
              <div className="sc-line">
                <span className="sc-label">
                  {r.label}
                  {isWorst && <span className="sc-tag">Costing you most</span>}
                </span>
                {r.delta !== null && r.delta !== 0 && (
                  <span className="sc-delta" data-sign={r.delta > 0 ? "up" : "down"}>
                    {r.delta > 0 ? `+${r.delta}` : `−${Math.abs(r.delta)}`}
                  </span>
                )}
                <span className="sc-val">{v}</span>
              </div>
              <div className="sc-bar" aria-hidden="true">
                <span style={{ width: shown ? `${Math.max(2, Math.min(100, v))}%` : "0%" }} />
              </div>
              <p className="sc-blurb">{r.blurb}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
