"use client";

/**
 * LastStreamRecap — surfaces the longitudinal "did you do it?" delta
 * between the user's prior stream and this one. Renders only when a
 * prior stream exists. The visceral payoff that proves LevlCast
 * remembers what users tried — a thing AI wrappers cannot replicate.
 */

import {
  type ReportDelta,
  type MissionCheck,
  antiPatternLabel,
  formatSeconds,
} from "@/lib/report-delta";

const SUBSCORE_LABEL: Record<string, string> = {
  energy: "Energy",
  engagement: "Engagement",
  consistency: "Consistency",
  content: "Content",
};

function StatusPill({ status }: { status: MissionCheck["status"] }) {
  if (status === "achieved") {
    return (
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.18em",
        padding: "3px 8px", borderRadius: 999,
        background: "rgba(163,230,53,0.12)", color: "#A3E635",
        border: "1px solid rgba(163,230,53,0.32)",
      }}>
        Done
      </span>
    );
  }
  if (status === "regressed") {
    return (
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.18em",
        padding: "3px 8px", borderRadius: 999,
        background: "rgba(248,113,113,0.12)", color: "#F87171",
        border: "1px solid rgba(248,113,113,0.32)",
      }}>
        Slipped
      </span>
    );
  }
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.18em",
      padding: "3px 8px", borderRadius: 999,
      background: "rgba(255,255,255,0.04)", color: "#A6B3C9",
      border: "1px solid rgba(255,255,255,0.12)",
    }}>
      Ongoing
    </span>
  );
}

function deltaColor(delta: number) {
  if (delta > 0) return "#A3E635";
  if (delta < 0) return "#F87171";
  return "#6F7C95";
}

function deltaArrow(delta: number) {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "·";
}

export function LastStreamRecap({ delta }: { delta: ReportDelta }) {
  const { score, biggestWin, biggestRegression, subscores, deadAir, antiPatterns, missions } = delta;

  // Recurring anti-patterns are the most credibility-building signal
  // ("we noticed you do this every stream"), so we surface them first.
  const recurring = antiPatterns.filter((a) => a.recurring);
  const cleared = antiPatterns.filter((a) => a.cleared);
  const newlyFlagged = antiPatterns.filter((a) => a.newThisStream);

  const achievedMissions = missions.filter((m) => m.status === "achieved");
  const regressedMissions = missions.filter((m) => m.status === "regressed");

  // Headline copy adapts to the data — punchy where the data warrants it.
  const headline = score.delta > 5
    ? "You moved up."
    : score.delta < -5
    ? "You slipped a little."
    : "Holding steady.";

  return (
    <div style={{
      margin: "0 0 36px",
      padding: "26px 28px",
      borderRadius: 14,
      background: "linear-gradient(135deg, rgba(34,211,238,0.06), rgba(167,139,250,0.04))",
      border: "1px solid rgba(34,211,238,0.22)",
    }}>
      {/* Eyebrow */}
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.32em", color: "#22D3EE",
        marginBottom: 14,
      }}>
        Since Last Stream
      </div>

      {/* Headline + score delta */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 22 }}>
        <h2 style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
          fontSize: 30, lineHeight: 1.1, letterSpacing: "-0.02em",
          margin: 0, color: "#ECF1FA",
        }}>
          {headline}
        </h2>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: "#6F7C95", letterSpacing: "0.06em" }}>
            {score.previous} →
          </span>
          <span style={{
            fontFamily: '"Instrument Serif", Georgia, serif',
            fontSize: 36, lineHeight: 1, color: "#ECF1FA", letterSpacing: "-0.03em",
          }}>
            {score.current}
          </span>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 14, fontWeight: 700,
            color: deltaColor(score.delta), letterSpacing: "0.02em",
          }}>
            {deltaArrow(score.delta)} {score.delta > 0 ? "+" : ""}{score.delta}
          </span>
        </div>
      </div>

      {/* Sub-score grid */}
      {subscores.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10, marginBottom: 22,
        }}>
          {subscores.map((s) => (
            <div key={s.key} style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.22em", color: "#6F7C95",
                marginBottom: 6,
              }}>
                {SUBSCORE_LABEL[s.key]}
              </div>
              <div style={{
                fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 22, lineHeight: 1,
                color: "#ECF1FA", letterSpacing: "-0.02em", marginBottom: 4,
              }}>
                {s.current}
                <span style={{ color: "#4D5876", fontSize: 12 }}>/100</span>
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700,
                color: deltaColor(s.delta),
              }}>
                {deltaArrow(s.delta)} {s.delta > 0 ? "+" : ""}{s.delta}
                <span style={{ color: "#6F7C95", fontWeight: 400, marginLeft: 6 }}>
                  from {s.previous}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Biggest win callout — only if we have one */}
      {biggestWin && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "rgba(163,230,53,0.06)", border: "1px solid rgba(163,230,53,0.24)",
          marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.22em", color: "#A3E635",
            flexShrink: 0,
          }}>
            Biggest Win
          </span>
          <span style={{ fontSize: 13, color: "#ECF1FA" }}>
            {SUBSCORE_LABEL[biggestWin.key]} climbed{" "}
            <strong style={{ color: "#A3E635" }}>+{biggestWin.delta}</strong> ({biggestWin.previous} → {biggestWin.current})
          </span>
        </div>
      )}

      {biggestRegression && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.22)",
          marginBottom: 14, display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.22em", color: "#F87171",
            flexShrink: 0,
          }}>
            Watch
          </span>
          <span style={{ fontSize: 13, color: "#ECF1FA" }}>
            {SUBSCORE_LABEL[biggestRegression.key]} dropped{" "}
            <strong style={{ color: "#F87171" }}>{biggestRegression.delta}</strong> ({biggestRegression.previous} → {biggestRegression.current})
          </span>
        </div>
      )}

      {/* Dead-air delta */}
      {deadAir && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)",
          marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.22em", color: "#6F7C95",
              marginBottom: 4,
            }}>
              Dead Air
            </div>
            <div style={{ fontSize: 13, color: "#ECF1FA" }}>
              {deadAir.prevCount} gap{deadAir.prevCount !== 1 ? "s" : ""} ({formatSeconds(deadAir.prevTotalSec)}) →{" "}
              <strong>{deadAir.currentCount} gap{deadAir.currentCount !== 1 ? "s" : ""} ({formatSeconds(deadAir.currentTotalSec)})</strong>
            </div>
          </div>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700,
            color: deltaColor(deadAir.improved ? 1 : -1),
            letterSpacing: "0.02em",
          }}>
            {deadAir.improved ? "↓ less" : "↑ more"}
          </span>
        </div>
      )}

      {/* Mission check — last stream's goals matched against this stream */}
      {missions.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: "#c4b5fd",
            marginBottom: 12,
          }}>
            Last Stream&apos;s Missions · {achievedMissions.length}/{missions.length} done
          </div>
          {missions.map((m, i) => (
            <div key={i} style={{
              padding: "12px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              marginBottom: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
                <span style={{
                  fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 15,
                  color: m.status === "achieved" ? "#A3E635" : m.status === "regressed" ? "#F87171" : "#ECF1FA",
                  lineHeight: 1.35, flex: 1,
                  textDecoration: m.status === "achieved" ? "line-through" : "none",
                  textDecorationColor: "rgba(163,230,53,0.5)",
                }}>
                  {m.goal}
                </span>
                <StatusPill status={m.status} />
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                color: "#6F7C95", letterSpacing: "0.02em", marginTop: 2,
              }}>
                {m.evidence}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recurring anti-patterns — credibility kicker. Says explicitly:
          we remember what you do every stream. */}
      {recurring.length > 0 && (
        <div style={{
          marginTop: 18, padding: "14px 16px",
          borderRadius: 8, background: "rgba(248,113,113,0.05)",
          border: "1px solid rgba(248,113,113,0.2)",
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: "#F87171",
            marginBottom: 8,
          }}>
            Still happening · flagged this stream AND last
          </div>
          {recurring.map((r) => (
            <div key={r.type} style={{ fontSize: 13, color: "#ECF1FA", marginBottom: 4 }}>
              · {antiPatternLabel(r.type)}{" "}
              <span style={{ color: "#6F7C95", fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
                ({r.prevCount} → {r.currentCount})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Cleared — celebration. */}
      {cleared.length > 0 && (
        <div style={{
          marginTop: 12, padding: "12px 16px",
          borderRadius: 8, background: "rgba(163,230,53,0.05)",
          border: "1px solid rgba(163,230,53,0.2)",
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: "#A3E635",
            marginBottom: 8,
          }}>
            Cleared · was flagged last stream
          </div>
          {cleared.map((c) => (
            <div key={c.type} style={{ fontSize: 13, color: "#ECF1FA", marginBottom: 2 }}>
              · {antiPatternLabel(c.type)}
            </div>
          ))}
        </div>
      )}

      {newlyFlagged.length > 0 && (
        <div style={{
          marginTop: 12, padding: "12px 16px",
          borderRadius: 8, background: "rgba(245,158,11,0.05)",
          border: "1px solid rgba(245,158,11,0.22)",
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: "#F59E0B",
            marginBottom: 8,
          }}>
            New this stream
          </div>
          {newlyFlagged.map((n) => (
            <div key={n.type} style={{ fontSize: 13, color: "#ECF1FA", marginBottom: 2 }}>
              · {antiPatternLabel(n.type)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
