import { rankFromPoints } from "@/lib/rank";
import type { CoachingArcData } from "@/lib/coaching-arc";

const TIER_HEX: Record<string, string> = {
  Iron: "#9AA0A6", Bronze: "#C1804B", Silver: "#B8C2CC", Gold: "#E3B341",
  Platinum: "#4FD1B9", Diamond: "#7CC5F5", Master: "#C084FC",
  Grandmaster: "#A855F7", Challenger: "#E879F9",
};

function scoreColors(s: number) {
  if (s >= 75) return { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.55)", text: "#22c55e" };
  if (s >= 50) return { bg: "rgba(234,179,8,0.12)", border: "rgba(234,179,8,0.55)", text: "#eab308" };
  return { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.55)", text: "#ef4444" };
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Rank points per stream, oldest first, aligned to score_history.
 *
 * Passed in rather than read from the arc because the arc is generated
 * text and the ladder is live data. When present, the card shows the climb
 * instead of the scores: five red failing numbers in a row was the exact
 * thing the ranking system exists to stop showing people.
 */
export interface ArcRankPoint {
  vod_id: string;
  points: number;
}

export function CoachingArcCard({
  arc,
  rankHistory,
}: {
  arc: CoachingArcData;
  rankHistory?: ArcRankPoint[];
}) {
  const history = arc.score_history;

  const rankByVod = new Map((rankHistory ?? []).map((r) => [r.vod_id, r.points]));
  // Only use the ladder view when every stream on the arc has a rating.
  // A mixed row of ranks and raw scores would be unreadable.
  const useRank = history.length > 0 && history.every((h) => rankByVod.has(h.vod_id));

  const value = (i: number): number =>
    useRank ? rankByVod.get(history[i].vod_id)! : history[i].score;

  const first = history.length ? value(0) : 0;
  const last = history.length ? value(history.length - 1) : 0;
  const netDelta = last - first;
  const hasImproved = arc.improving_areas.length > 0;
  const hasRecurring = arc.recurring_improvements.length > 0;

  return (
    <div className="card card-pad">
      {/* Header */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <div>
          <span className="mono-label">Coaching Arc</span>
          <h3 style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
            Your progress across {history.length} streams
          </h3>
        </div>
        {history.length >= 2 && (
          <div style={{ textAlign: "right" }}>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: netDelta > 0 ? "var(--green)" : netDelta < 0 ? "var(--danger)" : "var(--ink-3)",
            }}>
              {netDelta > 0 ? "+" : ""}{netDelta} pts
            </span>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>since first stream</div>
          </div>
        )}
      </div>

      {/* Score circles */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 24, overflowX: "auto" }}>
        {history.map((point, i) => {
          const current = value(i);
          const rank = useRank ? rankFromPoints(current) : null;
          // On the ladder the circle takes the tier's colour, so the row
          // reads as a climb through tiers rather than a run of red.
          const colors = rank
            ? {
                bg: `${TIER_HEX[rank.tier] ?? "#9AA0A6"}1F`,
                border: TIER_HEX[rank.tier] ?? "#9AA0A6",
                text: TIER_HEX[rank.tier] ?? "#9AA0A6",
              }
            : scoreColors(point.score);
          const next = history[i + 1];
          const nextValue = next ? value(i + 1) : null;
          const up = nextValue !== null && nextValue > current;
          const down = nextValue !== null && nextValue < current;
          const arrowColor = up ? "var(--green)" : down ? "var(--danger)" : "var(--ink-3)";
          const arrowIcon = up ? "↗" : down ? "↘" : "→";

          return (
            <div key={point.vod_id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 64 }}>
                <div style={{
                  width: 58, height: 58, borderRadius: "50%",
                  background: colors.bg,
                  border: `2px solid ${colors.border}`,
                  boxShadow: `0 0 16px -4px ${colors.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {rank ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/ranks/${rank.tier.toLowerCase()}.png`}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 40, height: 40, objectFit: "contain", display: "block" }}
                    />
                  ) : (
                    <span style={{ fontSize: 19, fontWeight: 900, color: colors.text, lineHeight: 1, letterSpacing: "-0.02em" }}>
                      {point.score}
                    </span>
                  )}
                </div>
                {rank && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: colors.text, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                    {rank.label}
                  </span>
                )}
                <span style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                  {shortDate(point.date)}
                </span>
              </div>
              {next && (
                <span style={{
                  fontSize: 15, color: arrowColor,
                  marginBottom: 18, marginLeft: 4, marginRight: 4,
                  flexShrink: 0, fontWeight: 600,
                }}>
                  {arrowIcon}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Recurring / improving */}
      {(hasRecurring || hasImproved) && (
        <div style={{ display: "grid", gridTemplateColumns: hasRecurring && hasImproved ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 20 }}>
          {hasRecurring && (
            <div>
              <span className="mono-label" style={{ color: "var(--danger)", display: "block", marginBottom: 10 }}>
                Still working on
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {arc.recurring_improvements.map((item, i) => {
                  const examples = arc.recurring_examples?.[i] ?? [];
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                        <span style={{ color: "var(--danger)", flexShrink: 0, fontWeight: 700 }}>!</span>
                        {item}
                      </div>
                      {examples.length > 0 && (
                        // Sample lines the streamer could actually say next stream.
                        // Reads as "try this" not as homework — purely concrete examples.
                        <div style={{ paddingLeft: 16, display: "flex", flexDirection: "column", gap: 4 }}>
                          {examples.map((ex, j) => (
                            <p
                              key={j}
                              style={{
                                fontSize: 12.5,
                                color: "var(--ink-2)",
                                lineHeight: 1.5,
                                margin: 0,
                                paddingLeft: 10,
                                borderLeft: "2px solid color-mix(in oklab, var(--danger) 40%, var(--line))",
                                fontStyle: "italic",
                              }}
                            >
                              &ldquo;{ex}&rdquo;
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {hasImproved && (
            <div>
              <span className="mono-label" style={{ color: "var(--green)", display: "block", marginBottom: 10 }}>
                Getting better
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {arc.improving_areas.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
                    <span style={{ color: "var(--green)", flexShrink: 0, fontWeight: 700 }}>+</span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Synthesis */}
      {arc.synthesis && (
        <div style={{
          borderTop: "1px solid var(--line)", paddingTop: 16,
          fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.65,
        }}>
          {arc.synthesis}
        </div>
      )}
    </div>
  );
}
