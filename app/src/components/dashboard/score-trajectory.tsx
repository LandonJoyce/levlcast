"use client";

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

function formatTickDate(iso: string, allDates: string[]): string {
  const day = iso.slice(0, 10);
  return allDates.filter((d) => d.slice(0, 10) === day).length > 1 ? fmtDateTime(iso) : fmtShortDate(iso);
}

export function ScoreTrajectory({ points }: { points: TrajectoryPoint[] }) {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const N = sorted.length;
  const currentIdx = sorted.findIndex((p) => p.current);
  const current = currentIdx >= 0 ? sorted[currentIdx] : sorted[N - 1];
  const cIdx = currentIdx >= 0 ? currentIdx : N - 1;

  const scores = sorted.map((p) => p.score);
  const peak = Math.max(...scores);
  const first = sorted[0].score;
  const last = sorted[N - 1].score;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / N);
  const overallDelta = last - first;

  const trendColor = overallDelta > 8 ? "#A3E635" : overallDelta < -8 ? "#F87171" : "#A6B3C9";
  const trendItalic = overallDelta > 8 ? "climbing." : overallDelta < -8 ? "drifting." : "steady.";

  const W = 1000;
  const H = 260;
  const PAD_L = 48;
  const PAD_R = 24;
  const PAD_T = 40;
  const PAD_B = 44;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const yFor = (s: number) => PAD_T + innerH * (1 - s / 100);
  const baseline = PAD_T + innerH;

  const slotW = innerW / N;
  const barW = Math.min(slotW * 0.55, 60);

  const xCenter = (i: number) => PAD_L + slotW * i + slotW / 2;

  const allDates = sorted.map((p) => p.date);

  const yTicks = [0, 33, 66, 100];

  return (
    <div style={{
      margin: "0 0 36px",
      padding: "18px 22px 16px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(242,97,121,0.18)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
        <h2 style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
          fontSize: 26, letterSpacing: "-0.015em", lineHeight: 1, margin: 0, color: "#ECF1FA",
        }}>
          The <em style={{ fontStyle: "italic", color: trendColor }}>Trajectory.</em>
        </h2>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: "#6F7C95", letterSpacing: "0.1em", textTransform: "uppercase",
        }}>
          {N} streams — <span style={{ color: trendColor }}>{trendItalic}</span>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: "280px" }} aria-hidden>
        <defs>
          {sorted.map((p, i) => {
            const color = scoreColor(p.score);
            const isCurrent = i === cIdx;
            return (
              <linearGradient key={i} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={isCurrent ? 0.9 : 0.5} />
                <stop offset="100%" stopColor={color} stopOpacity={isCurrent ? 0.25 : 0.1} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Subtle horizontal grid lines */}
        {yTicks.map((s) => (
          <line key={s}
            x1={PAD_L} x2={W - PAD_R} y1={yFor(s)} y2={yFor(s)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray={s === 0 ? "none" : "4 4"}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((s) => (
          <text key={s}
            x={PAD_L - 10} y={yFor(s) + 5}
            fontFamily='"JetBrains Mono", monospace' fontSize={14}
            fill="#4D5876" textAnchor="end"
          >
            {s}
          </text>
        ))}

        {/* Bars */}
        {sorted.map((p, i) => {
          const color = scoreColor(p.score);
          const isCurrent = i === cIdx;
          const cx = xCenter(i);
          const barX = cx - barW / 2;
          const barY = yFor(p.score);
          const barH = baseline - barY;

          return (
            <g key={i}>
              {/* Bar body */}
              <rect
                x={barX} y={barY}
                width={barW} height={barH}
                rx={4}
                fill={`url(#bar-grad-${i})`}
              />
              {/* Top cap line */}
              <rect
                x={barX} y={barY}
                width={barW} height={3}
                rx={2}
                fill={color}
                opacity={isCurrent ? 1 : 0.6}
              />
              {/* Score label above bar */}
              <text
                x={cx} y={barY - 8}
                fontFamily='"JetBrains Mono", monospace'
                fontSize={isCurrent ? 18 : 13}
                fontWeight={isCurrent ? "700" : "400"}
                fill={isCurrent ? color : "rgba(255,255,255,0.3)"}
                textAnchor="middle"
              >
                {p.score}
              </text>
            </g>
          );
        })}

        {/* X-axis date labels */}
        {sorted.map((p, i) => {
          const cx = xCenter(i);
          const isCurrent = i === cIdx;
          return (
            <text key={i} x={cx} y={baseline + 28}
              fontFamily='"JetBrains Mono", monospace' fontSize={12}
              fill={isCurrent ? "#A6B3C9" : "#6F7C95"}
              letterSpacing="0.02em" textAnchor="middle"
            >
              {formatTickDate(p.date, allDates)}
            </text>
          );
        })}
      </svg>

      {/* Stats footer */}
      <div style={{
        marginTop: 16, paddingTop: 14,
        borderTop: "1px dashed rgba(255,255,255,0.1)",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 14,
      }}>
        <TrjStat n={current.score} label="This stream" color={scoreColor(current.score)} />
        <TrjStat n={peak} label="Peak score" color="#fbbf24" />
        <TrjStat n={avg} label={`Avg of ${N}`} color="#A6B3C9" />
        <TrjStat n={overallDelta} label="Change from first" color={trendColor} signed />
      </div>
    </div>
  );
}

function TrjStat({ n, label, color, signed }: { n: number; label: string; color: string; signed?: boolean }) {
  const display = signed ? (n > 0 ? `+${n}` : `${n}`) : `${n}`;
  return (
    <div>
      <div style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 28, lineHeight: 1,
        letterSpacing: "-0.02em", color, marginBottom: 4,
      }}>
        {display}
      </div>
      <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 11, color: "#6F7C95", lineHeight: 1.4 }}>
        {label}
      </div>
    </div>
  );
}

export type { TrajectoryPoint };
