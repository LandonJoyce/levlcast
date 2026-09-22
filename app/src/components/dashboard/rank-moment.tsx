"use client";

/**
 * What the ladder did this stream, at the top of the report.
 *
 * Rank used to change silently: the number moved in the database, the
 * badge on the dashboard quietly read differently next visit, and nothing
 * ever said "you went up". A ladder you climb without noticing is not a
 * ladder, it is a statistic.
 *
 * Three states, deliberately different in weight, because treating a
 * promotion and an ordinary good night the same devalues the promotion:
 *
 *   TIER    Iron to Bronze, Gold to Platinum. The rare one. Full-width,
 *           both emblems, animated. This is the screenshot moment.
 *   DIVISION Silver III to Silver II. Frequent, worth a real nod, but it
 *           must not look like the tier moment or the tier moment stops
 *           meaning anything.
 *   POINTS  Everything else. The bar moved; show how far to the next step,
 *           because a partly-filled bar is an unfinished thing.
 *
 * Nothing here is stored. from/to are derived from rank_points_after and
 * rank_delta, which the analyze pipeline already writes to every VOD, so
 * this needed no migration and cannot disagree with the badge elsewhere.
 */

import { useEffect, useState } from "react";
import { rankFromPoints, TIERS, type Rank } from "@/lib/rank";

const TIER_COLOR: Record<string, string> = {
  Iron: "#9AA0A6",
  Bronze: "#C1804B",
  Silver: "#B8C2CC",
  Gold: "#E3B341",
  Platinum: "#4FD1B9",
  Diamond: "#7CC5F5",
  Master: "#C084FC",
  Grandmaster: "#A855F7",
};

function nextStepLabel(rank: Rank): string {
  if (rank.division === null) return "the top";
  if (rank.division > 1) return `${rank.tier} ${["", "I", "II", "III"][rank.division - 1]}`;
  const idx = TIERS.findIndex((t) => t.name === rank.tier);
  return TIERS[idx + 1]?.name ?? "the top";
}

export function RankMoment({
  pointsAfter,
  delta,
}: {
  pointsAfter: number | null;
  delta: number | null;
}) {
  // Entrance is delayed by a beat so the bar visibly fills rather than
  // appearing already full, which reads as a static image.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 260);
    return () => clearTimeout(t);
  }, []);

  if (pointsAfter === null || delta === null) return null;

  const to = rankFromPoints(pointsAfter);
  const from = rankFromPoints(pointsAfter - delta);

  const tierUp = from.tier !== to.tier && pointsAfter > pointsAfter - delta;
  const tierDown = from.tier !== to.tier && delta < 0;
  const divisionUp =
    !tierUp && !tierDown && from.division !== null && to.division !== null && to.division < from.division;

  const color = TIER_COLOR[to.tier] ?? TIER_COLOR.Iron;
  const isPromotion = tierUp || divisionUp;

  return (
    <section
      aria-label="Rank change"
      style={{
        margin: "0 0 28px",
        padding: tierUp ? "30px 28px" : "20px 24px",
        borderRadius: 16,
        background: tierUp
          ? `linear-gradient(135deg, ${color}1F, ${color}08)`
          : "rgba(255,255,255,0.025)",
        border: `1px solid ${isPromotion ? `${color}55` : "rgba(255,255,255,0.08)"}`,
        position: "relative",
        overflow: "hidden",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 420ms ease, transform 420ms ease",
      }}
    >
      {tierUp && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {/* On a tier change both emblems are shown, because the whole
            feeling is the difference between them. */}
        {tierUp || tierDown ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/ranks/${from.tier.toLowerCase()}.png`} alt="" aria-hidden="true"
              style={{ width: 40, height: 40, opacity: 0.35, filter: "grayscale(0.6)" }} />
            <span style={{ color: "#4D5876", fontSize: 18 }}>→</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/ranks/${to.tier.toLowerCase()}.png`} alt="" aria-hidden="true"
              style={{ width: 62, height: 62, filter: `drop-shadow(0 0 14px ${color}66)` }} />
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={`/ranks/${to.tier.toLowerCase()}.png`} alt="" aria-hidden="true"
            style={{ width: 46, height: 46 }} />
        )}

        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: tierUp ? color : tierDown ? "#F87171" : "#6F7C95",
              marginBottom: 6,
            }}
          >
            {tierUp ? "Promoted" : tierDown ? "Demoted" : divisionUp ? "Division up" : "Rank"}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: '"Instrument Serif", Georgia, serif',
                fontSize: tierUp ? 34 : 24,
                lineHeight: 1.1,
                color: "#ECF1FA",
              }}
            >
              {to.label}
            </span>
            {delta !== 0 && (
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: delta > 0 ? "#A3E635" : "#F87171",
                }}
              >
                {delta > 0 ? "+" : ""}
                {delta}
              </span>
            )}
          </div>

          {/* Progress toward the next step. Hidden on a tier promotion,
              where the news is the promotion itself and a bar underneath
              it just points at the next chore. */}
          {!tierUp && (
            <>
              <div
                aria-hidden="true"
                style={{ marginTop: 12, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}
              >
                <div
                  style={{
                    height: "100%",
                    width: shown ? `${to.progress}%` : "0%",
                    background: color,
                    borderRadius: 999,
                    transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1) 120ms",
                  }}
                />
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6F7C95", fontFamily: '"JetBrains Mono", monospace' }}>
                {to.progress}% to {nextStepLabel(to)}
              </p>
            </>
          )}

          {tierUp && (
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#A6B3C9", lineHeight: 1.6 }}>
              You moved out of {from.tier}. Analyse another stream to keep it.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
