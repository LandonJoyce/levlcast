"use client";

/**
 * ScoreTrajectory — score history chart in the report's full design
 * language. Auto-fits the Y-axis to the actual data range so a cluster
 * of low scores doesn't crawl along the bottom of a 0-100 chart.
 * Personal-best ★, current-stream pin (positioned to avoid axis-label
 * collisions), summary stats grid below.
 */

interface TrajectoryPoint {
  score: number;
  date: string;
  current?: boolean;
}

function scoreColor(n: number) {
  return n >= 66 ? "#A3E635" : n >= 33 ? "#F59E0B" : "#F87171";
}

function fmtShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
}

/**
 * Pick a Y-axis range that frames the data well. If all scores are
 * low (<50), don't show the upper half. If they're tight (e.g. 60-75),
 * pad enough to show the variance without zooming into noise.
 *
 * Returns [yMin, yMax, ticks[]] where ticks are nice round numbers to
 * label.
 */
function pickYRange(scores: number[]): { min: number; max: number; ticks: number[] } {
  if (scores.length === 0) return { min: 0, max: 100, ticks: [0, 33, 66, 100] };

  const dataMin = Math.min(...scores);
  const dataMax = Math.max(...scores);

  // If full range used, default 0-100 with standard ticks
  if (dataMin <= 5 && dataMax >= 90) {
    return { min: 0, max: 100, ticks: [0, 33, 66, 100] };
  }

  // Pad ~15% above and below; round to nearest 10 for clean ticks
  const span = Math.max(20, dataMax - dataMin); // floor at 20-pt span so flat lines don't get squished
  const padBelow = Math.max(8, span * 0.15);
  const padAbove = Math.max(8, span * 0.20);
  const min = Math.max(0, Math.floor((dataMin - padBelow) / 10) * 10);
  const max = Math.min(100, Math.ceil((dataMax + padAbove) / 10) * 10);

  // 4 evenly-spaced ticks across [min, max]
  const step = (max - min) / 3;
  const ticks = [
    min,
    Math.round(min + step),
    Math.round(min + step * 2),
    max,
  ];
  return { min, max, ticks };
}

/**
 * Disambiguate axis date labels. If multiple stream dates fall on the
 * same calendar day, add hour. Otherwise just date.
 */
function formatTickDate(iso: string, allDates: string[]): string {
  const day = iso.slice(0, 10);
  const sameDayCount = allDates.filter((d) => d.slice(0, 10) === day).length;
  return sameDayCount > 1 ? fmtDateTime(iso) : fmtShortDate(iso);
}

export function ScoreTrajectory({ points }: { points: TrajectoryPoint[] }) {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const N = sorted.length;
  const currentIdx = sorted.findIndex((p) => p.current);
  const current = currentIdx >= 0 ? sorted[currentIdx] : sorted[N - 1];

  const scores = sorted.map((p) => p.score);
  const peak = Math.max(...scores);
  const peakIdx = scores.indexOf(peak);
  const first = sorted[0].score;
  const last = sorted[N - 1].score;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / N);
  const overallDelta = last - first;
  const isPersonalBest = peakIdx === currentIdx && N >= 3;

  const trendLabel =
    overallDelta > 8 ? "trending up" :
    overallDelta < -8 ? "trending down" :
    "holding steady";
  const trendColor = overallDelta > 8 ? "#A3E635" : overallDelta < -8 ? "#F87171" : "#A6B3C9";
  const trendItalic = overallDelta > 8 ? "climbing." : overallDelta < -8 ? "drifting." : "steady.";

  const { min: yMin, max: yMax, ticks } = pickYRange(scores);

  // Geometry — slightly taller for breathing room and bigger viewBox so
  // SVG text reads as substantial at any container width.
  const W = 1000;
  const H = 220;
  const PAD_L = 58;
  const PAD_R = 58;
  const PAD_T = 38;
  const PAD_B = 46;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const yFor = (s: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, s));
    return PAD_T + innerH * (1 - (clamped - yMin) / Math.max(1, yMax - yMin));
  };
  const xFor = (i: number) => PAD_L + (i * innerW) / Math.max(1, N - 1);

  const linePath = (() => {
    const pts = sorted.map((p, i) => [xFor(i), yFor(p.score)] as const);
    if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const cx = (x0 + x1) / 2;
      d += ` C ${cx.toFixed(1)} ${y0.toFixed(1)}, ${cx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  })();

  const areaPath =
    linePath +
    ` L ${xFor(N - 1).toFixed(1)} ${(PAD_T + innerH).toFixed(1)}` +
    ` L ${xFor(0).toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`;

  // Pick a few x-axis labels (avoid all 6 dates crowding)
  const tickIndices = (() => {
    if (N <= 5) return Array.from({ length: N }, (_, i) => i);
    return [0, Math.floor((N - 1) / 3), Math.floor(2 * (N - 1) / 3), N - 1];
  })();
  const allDates = sorted.map((p) => p.date);

  // Current-stream pin position — try above, but if too close to top
  // of chart area, drop below to avoid colliding with the y-axis scale.
  const currentY = yFor(current.score);
  const pinAbove = currentY - PAD_T > 40;
  const pinY = pinAbove ? currentY - 20 : currentY + 26;

  return (
    <div style={{
      margin: "0 0 36px",
      padding: "28px 30px 24px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 6 }}>
        <h2 style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
          fontSize: 30, letterSpacing: "-0.015em", lineHeight: 1, margin: 0, color: "#ECF1FA",
        }}>
          The <em style={{ fontStyle: "italic", color: trendColor }}>Trajectory.</em>
        </h2>
        <p style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 13, color: "#6F7C95", textAlign: "right", margin: 0, maxWidth: 320, lineHeight: 1.4,
        }}>
          Last {N} streams — <span style={{ color: trendColor }}>{trendItalic}</span>
        </p>
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.28em", color: "#6F7C95",
        marginBottom: 20,
      }}>
        Score Trajectory · {trendLabel}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", height: "auto" }} aria-hidden>
        <defs>
          <linearGradient id="trj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
          <pattern id="trj-zone-red" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(248,113,113,0.06)" strokeWidth="2" />
          </pattern>
          <pattern id="trj-zone-amber" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(245,158,11,0.05)" strokeWidth="2" />
          </pattern>
          <pattern id="trj-zone-green" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(163,230,53,0.06)" strokeWidth="2" />
          </pattern>
          <filter id="trj-line-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* Score zone bands — only render bands that fall within the
            visible y-range so a 14-28 chart doesn't show a tiny green
            sliver at the top. */}
        {yMin < 33 && (
          <rect
            x={PAD_L} y={yFor(Math.min(33, yMax))}
            width={innerW}
            height={yFor(yMin) - yFor(Math.min(33, yMax))}
            fill="url(#trj-zone-red)"
          />
        )}
        {yMax > 33 && yMin < 66 && (
          <rect
            x={PAD_L} y={yFor(Math.min(66, yMax))}
            width={innerW}
            height={yFor(Math.max(33, yMin)) - yFor(Math.min(66, yMax))}
            fill="url(#trj-zone-amber)"
          />
        )}
        {yMax > 66 && (
          <rect
            x={PAD_L} y={yFor(yMax)}
            width={innerW}
            height={yFor(Math.max(66, yMin)) - yFor(yMax)}
            fill="url(#trj-zone-green)"
          />
        )}

        {/* Top + bottom borders on chart area */}
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T} y2={PAD_T} stroke="rgba(255,255,255,0.07)" />
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke="rgba(255,255,255,0.14)" />

        {/* Y-axis ticks — bigger labels (14px) for legibility on 1440p */}
        {ticks.map((s) => (
          <g key={s}>
            <line
              x1={PAD_L} x2={W - PAD_R}
              y1={yFor(s)} y2={yFor(s)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2 5"
            />
            <text
              x={PAD_L - 10} y={yFor(s) + 5}
              fontFamily='"JetBrains Mono", monospace' fontSize={14}
              fill="#6F7C95" letterSpacing="0.06em" textAnchor="end"
              fontWeight={500}
            >
              {s}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#trj-area)" />

        {/* Glow + crisp line */}
        <path d={linePath} fill="none" stroke="rgba(167,139,250,0.4)" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" filter="url(#trj-line-glow)" />
        <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" />

        {/* Bubbles */}
        {sorted.map((p, i) => {
          const x = xFor(i);
          const y = yFor(p.score);
          const isCurrent = !!p.current;
          const isPeak = i === peakIdx && N >= 3 && peak !== current.score;
          const color = isCurrent ? scoreColor(p.score) : "#a78bfa";
          const r = isCurrent ? 9 : 5;

          return (
            <g key={i}>
              {isCurrent && <circle cx={x} cy={y} r={r + 8} fill={color} opacity={0.16} />}
              <circle
                cx={x} cy={y} r={r}
                fill={isCurrent ? color : "rgba(167,139,250,0.18)"}
                stroke={isCurrent ? color : "rgba(167,139,250,0.7)"}
                strokeWidth={isCurrent ? 0 : 2}
              />
              {isPeak && (
                <text
                  x={x} y={y - 18}
                  fontFamily='"Instrument Serif", Georgia, serif' fontStyle="italic" fontSize={20}
                  fill="#fbbf24" textAnchor="middle"
                >
                  ★
                </text>
              )}
            </g>
          );
        })}

        {/* Current-stream score pin — outside the chart's left/right
            padding so it never collides with the Y-axis tick labels. */}
        {(() => {
          const x = xFor(currentIdx >= 0 ? currentIdx : N - 1);
          const color = scoreColor(current.score);
          // Push the label inward if the bubble is too close to the right edge
          const labelX = x > W - PAD_R - 40 ? x - 8 : x;
          const anchor: "start" | "middle" | "end" = x > W - PAD_R - 40 ? "end" : "middle";
          return (
            <g>
              <line
                x1={x} x2={x}
                y1={pinAbove ? currentY - 12 : currentY + 14}
                y2={pinY + (pinAbove ? 6 : -10)}
                stroke={color} strokeWidth={1} strokeDasharray="1 4" opacity={0.7}
              />
              <text
                x={labelX} y={pinY}
                fontFamily='"Instrument Serif", Georgia, serif' fontSize={28}
                fill={color} textAnchor={anchor} letterSpacing="-0.025em"
              >
                {current.score}
              </text>
              {isPersonalBest && (
                <text
                  x={labelX} y={pinY - (pinAbove ? 22 : 28)}
                  fontFamily='"JetBrains Mono", monospace' fontSize={10} fontWeight={700}
                  fill="#fbbf24" textAnchor={anchor} letterSpacing="0.18em"
                >
                  ★ PB
                </text>
              )}
            </g>
          );
        })()}

        {/* X-axis date labels */}
        {tickIndices.map((i) => {
          const x = xFor(i);
          const anchor: "start" | "middle" | "end" =
            i === 0 ? "start" : i === N - 1 ? "end" : "middle";
          return (
            <text
              key={i} x={x} y={PAD_T + innerH + 30}
              fontFamily='"JetBrains Mono", monospace' fontSize={13}
              fill="#A6B3C9" letterSpacing="0.04em" textAnchor={anchor}
              fontWeight={500}
            >
              {formatTickDate(sorted[i].date, allDates)}
            </text>
          );
        })}
      </svg>

      {/* Summary stats footer */}
      <div style={{
        marginTop: 22, paddingTop: 18,
        borderTop: "1px dashed rgba(255,255,255,0.12)",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 18,
      }}>
        <TrjStat n={current.score} label="This stream" color={scoreColor(current.score)} />
        <TrjStat n={peak} label={`Peak${isPersonalBest ? " · this stream" : ""}`} color="#fbbf24" />
        <TrjStat n={avg} label={`Avg of ${N}`} color="#A6B3C9" />
        <TrjStat n={overallDelta} label={`Δ from first (${first})`} color={trendColor} signed />
      </div>
    </div>
  );
}

function TrjStat({ n, label, color, signed }: { n: number; label: string; color: string; signed?: boolean }) {
  const display = signed ? (n > 0 ? `+${n}` : `${n}`) : `${n}`;
  return (
    <div>
      <div style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 32, lineHeight: 1,
        letterSpacing: "-0.02em", color, marginBottom: 5,
      }}>
        {display}
      </div>
      <div style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: 12, color: "#6F7C95", lineHeight: 1.4,
      }}>
        {label}
      </div>
    </div>
  );
}

export type { TrajectoryPoint };
