"use client";

/**
 * ScoreTrajectory — compact line chart showing score history across the
 * user's last N streams with the current one highlighted. Lives at the
 * top of the coach report so streamers see their trend before diving
 * into the score itself.
 *
 * Visualizes the moat: "this report sits inside a longitudinal coaching
 * arc" instead of "this report is a one-shot summary."
 */

interface TrajectoryPoint {
  /** Score 0-100 */
  score: number;
  /** Stream date — used for x-axis ordering */
  date: string;
  /** Mark the bubble for the current stream */
  current?: boolean;
}

function scoreColor(n: number) {
  return n >= 66 ? "#A3E635" : n >= 33 ? "#F59E0B" : "#F87171";
}

export function ScoreTrajectory({ points }: { points: TrajectoryPoint[] }) {
  if (points.length < 2) return null;

  // Sort oldest → newest for left-to-right chart
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const N = sorted.length;

  const W = 720;
  const H = 110;
  const PADDING_X = 28;
  const PADDING_Y = 22;
  const innerW = W - PADDING_X * 2;
  const innerH = H - PADDING_Y * 2;

  // Y axis: 0–100 fixed so streams are comparable across users
  const yFor = (s: number) => PADDING_Y + innerH * (1 - s / 100);
  const xFor = (i: number) => PADDING_X + (i * innerW) / Math.max(1, N - 1);

  const linePath = sorted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`)
    .join(" ");

  // Area under the line for subtle fill
  const areaPath =
    linePath +
    ` L ${xFor(N - 1).toFixed(1)} ${(PADDING_Y + innerH).toFixed(1)}` +
    ` L ${xFor(0).toFixed(1)} ${(PADDING_Y + innerH).toFixed(1)} Z`;

  const first = sorted[0].score;
  const last = sorted[N - 1].score;
  const overallDelta = last - first;
  const trendLabel =
    overallDelta > 8 ? "trending up" :
    overallDelta < -8 ? "trending down" :
    "holding steady";
  const trendColor = overallDelta > 8 ? "#A3E635" : overallDelta < -8 ? "#F87171" : "#A6B3C9";

  const peak = Math.max(...sorted.map((p) => p.score));

  return (
    <div style={{
      margin: "0 0 28px",
      padding: "18px 22px 22px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.28em", color: "#6F7C95",
            marginBottom: 4,
          }}>
            Score Trajectory · last {N} streams
          </div>
          <div style={{
            fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 18,
            color: "#ECF1FA", letterSpacing: "-0.01em", lineHeight: 1.3,
          }}>
            <em style={{ fontStyle: "italic", color: trendColor }}>{trendLabel}</em>
            <span style={{ color: "#6F7C95", fontFamily: '"JetBrains Mono", monospace', fontSize: 12, marginLeft: 12 }}>
              peak {peak} · first {first} · now {last}
            </span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }} aria-hidden>
        {/* Reference grid lines at 25 / 50 / 75 */}
        {[25, 50, 75].map((s) => (
          <line
            key={s}
            x1={PADDING_X} x2={W - PADDING_X}
            y1={yFor(s)} y2={yFor(s)}
            stroke="rgba(255,255,255,0.05)"
            strokeDasharray="2 4"
          />
        ))}
        {/* Reference label for 50 */}
        <text
          x={W - PADDING_X + 4} y={yFor(50) + 3}
          fontFamily='"JetBrains Mono", monospace' fontSize={9}
          fill="#4D5876" letterSpacing="0.08em"
        >
          50
        </text>

        {/* Area fill */}
        <path d={areaPath} fill="url(#trajectory-fill)" opacity={0.4} />
        <defs>
          <linearGradient id="trajectory-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Connecting line */}
        <path d={linePath} fill="none" stroke="rgba(167,139,250,0.55)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

        {/* Bubbles */}
        {sorted.map((p, i) => {
          const x = xFor(i);
          const y = yFor(p.score);
          const isCurrent = !!p.current;
          const r = isCurrent ? 6 : 4;
          const color = isCurrent ? scoreColor(p.score) : "#a78bfa";

          return (
            <g key={i}>
              {isCurrent && (
                <circle cx={x} cy={y} r={r + 4} fill={color} opacity={0.18} />
              )}
              <circle
                cx={x} cy={y} r={r}
                fill={isCurrent ? color : "rgba(167,139,250,0.18)"}
                stroke={isCurrent ? color : "rgba(167,139,250,0.65)"}
                strokeWidth={isCurrent ? 0 : 1.5}
              />
              {isCurrent && (
                <text
                  x={x} y={y - 12}
                  fontFamily='"Instrument Serif", Georgia, serif' fontSize={14}
                  fill={color} textAnchor="middle"
                  letterSpacing="-0.02em"
                >
                  {p.score}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export type { TrajectoryPoint };
