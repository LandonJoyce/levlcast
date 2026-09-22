"use client";

/**
 * The post-match screen.
 *
 * The report used to open as an essay: a narrative paragraph, then two
 * columns of prose, then opening and closing paragraphs, then a metrics
 * row, then a trend paragraph, then charts. Everything true, nothing
 * scannable. It reads like homework, and a streamer who just finished a
 * four-hour stream at 2am does not open homework twice.
 *
 * This is what a game shows you after a match instead: where the points
 * went, what cost you the most, and the one thing to do next time. Four
 * bars, a single objective, and everything else deliberately below it.
 *
 * Two rules it follows that the old layout did not:
 *
 *  1. NO LETTER GRADES. Real scores here run 8 to 30, so a grade scale
 *     hands almost everyone an F. Telling someone they failed is not the
 *     same as telling them what to fix, and it is a good way to make them
 *     close the tab. Bars move; grades judge.
 *
 *  2. ONE OBJECTIVE, NOT A LIST. Three ranked fixes with a paragraph each
 *     is a reading assignment. One thing, stated as an action, is
 *     something you can actually take into the next stream.
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
  { key: "content", label: "Content", blurb: "Having something to say about what is happening." },
];

/** Green above decent, amber in the middle, red where it is actually hurting. */
function barColor(v: number): string {
  if (v >= 55) return "#A3E635";
  if (v >= 30) return "#F59E0B";
  return "#F87171";
}

export function StreamScorecard({
  scores,
  previousScores,
  mission,
  deadAirPct,
}: {
  scores: Subscores | null;
  previousScores?: Subscores | null;
  /** The single thing to do next stream. */
  mission?: string | null;
  deadAirPct?: number | null;
}) {
  // Bars fill on mount. A bar that is already full when the page paints is
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

  // The lowest bar is named outright. "Your worst number is X" is a
  // sentence a tired person can act on; four numbers side by side is a
  // table they have to interpret first.
  const worst = rows.length
    ? rows.reduce((lo, r) => ((r.value as number) < (lo.value as number) ? r : lo))
    : null;

  if (rows.length === 0 && !mission) return null;

  return (
    <div style={{ display: "grid", gap: 14, marginBottom: 28 }}>
      {rows.length > 0 && (
        <section
          aria-label="Stream scorecard"
          style={{
            padding: "22px 24px",
            borderRadius: 16,
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#6F7C95",
              }}
            >
              Where the points went
            </span>
            {typeof deadAirPct === "number" && deadAirPct > 0 && (
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 11,
                  color: deadAirPct >= 25 ? "#F87171" : "#6F7C95",
                }}
              >
                {Math.round(deadAirPct)}% silence
              </span>
            )}
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {rows.map((r) => {
              const v = r.value as number;
              const color = barColor(v);
              return (
                <div key={r.key}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "#ECF1FA", flex: 1 }}>
                      {r.label}
                      {worst && r.key === worst.key && rows.length > 1 && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "#F87171",
                            border: "1px solid rgba(248,113,113,0.35)",
                            borderRadius: 4,
                            padding: "2px 6px",
                          }}
                        >
                          Costing you most
                        </span>
                      )}
                    </span>
                    {r.delta !== null && r.delta !== 0 && (
                      <span
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: 12,
                          fontWeight: 700,
                          color: r.delta > 0 ? "#A3E635" : "#F87171",
                        }}
                      >
                        {r.delta > 0 ? "+" : ""}
                        {r.delta}
                      </span>
                    )}
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 13,
                        fontWeight: 700,
                        color,
                        minWidth: 26,
                        textAlign: "right",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: shown ? `${Math.max(2, Math.min(100, v))}%` : "0%",
                        background: color,
                        borderRadius: 999,
                        transition: "width 850ms cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    />
                  </div>
                  <p style={{ margin: "5px 0 0", fontSize: 11.5, color: "#6F7C95", lineHeight: 1.5 }}>
                    {r.blurb}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {mission && (
        <section
          aria-label="Next stream objective"
          style={{
            padding: "22px 24px",
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(163,230,53,0.09), rgba(163,230,53,0.02))",
            border: "1px solid rgba(163,230,53,0.3)",
          }}
        >
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#A3E635",
              marginBottom: 10,
            }}
          >
            Do this next stream
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: '"Instrument Serif", Georgia, serif',
              fontSize: 22,
              lineHeight: 1.35,
              color: "#ECF1FA",
            }}
          >
            {mission}
          </p>
          <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#8B97AD", lineHeight: 1.6 }}>
            Your next report checks whether you did it.
          </p>
        </section>
      )}
    </div>
  );
}
