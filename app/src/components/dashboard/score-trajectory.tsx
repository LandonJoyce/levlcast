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

function pickYRange(scores: number[]): { min: number; max: number; ticks: number[] } {
  if (scores.length === 0) return { min: 0, max: 100, ticks: [0, 33, 66, 100] };
  const dataMin = Math.min(...scores);
  const dataMax = Math.max(...scores);
  if (dataMin <= 5 && dataMax >= 90) return { min: 0, max: 100, ticks: [0, 33, 66, 100] };
  const span = Math.max(20, dataMax - dataMin);
  const padBelow = Math.max(8, span * 0.15);
  const padAbove = Math.max(8, span * 0.20);
  const min = Math.max(0, Math.floor((dataMin - padBelow) / 10) * 10);
  const max = Math.min(100, Math.ceil((dataMax + padAbove) / 10) * 10);
  const step = (max - min) / 3;
  return { min, max, ticks: [min, Math.round(min + step), Math.round(min + step * 2), max] };
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

  const scores = sorted.map((p) => p.score);
  const peak = Math.max(...scores);
  const first = sorted[0].score;
  const last = sorted[N - 1].score;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / N);
  const overallDelta = last - first;

  const trendColor = overallDelta > 8 ? "#A3E635" : overallDelta < -8 ? "#F87171" : "#A6B3C9";
  const trendItalic = overallDelta > 8 ? "climbing." : overallDelta < -8 ? "drifting." : "steady.";

  // Chart color follows current score tier — green/amber/red at a glance
  const chartColor = scoreColor(current.score);

  const { min: yMin, max: yMax, ticks } = pickYRange(scores);

  const W = 1000;
  const H = 240;
  const PAD_L = 52;
  const PAD_R = 52;
  const PAD_T = 30;
  const PAD_B = 42;
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

  const tickIndices = (() => {
    if (N <= 5) return Array.from({ length: N }, (_, i) => i);
    return [0, Math.floor((N - 1) / 3), Math.floor(2 * (N - 1) / 3), N - 1];
  })();
  const allDates = sorted.map((p) => p.date);

  // Position score label left or right of dot to avoid edge clipping
  const cIdx = currentIdx >= 0 ? currentIdx : N - 1;
  const cX = xFor(cIdx);
  const cY = yFor(current.score);
  const labelRight = cX < W - PAD_R - 80;

  return (
    <div style={{
      margin: "0 0 36px",
      padding: "18px 22px 16px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(242,97,121,0.18)",
    }}>
      {/* Header — compact single row */}
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
          {/* Area gradient uses chart color — green/amber/red at a glance */}
          <linearGradient id="trj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.26" />
            <stop offset="55%" stopColor={chartColor} stopOpacity="0.07" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Zone bands — flat solid fills, no crosshatch */}
        {yMin < 33 && (
          <rect x={PAD_L} y={yFor(Math.min(33, yMax))} width={innerW}
            height={yFor(yMin) - yFor(Math.min(33, yMax))} fill="rgba(248,113,113,0.04)" />
        )}
        {yMax > 33 && yMin < 66 && (
          <rect x={PAD_L} y={yFor(Math.min(66, yMax))} width={innerW}
            height={yFor(Math.max(33, yMin)) - yFor(Math.min(66, yMax))} fill="rgba(245,158,11,0.03)" />
        )}
        {yMax > 66 && (
          <rect x={PAD_L} y={yFor(yMax)} width={innerW}
            height={yFor(Math.max(66, yMin)) - yFor(yMax)} fill="rgba(163,230,53,0.04)" />
        )}

        {/* Subtle horizontal grid lines */}
        {ticks.map((s) => (
          <line key={s}
            x1={PAD_L} x2={W - PAD_R} y1={yFor(s)} y2={yFor(s)}
            stroke="rgba(255,255,255,0.05)"
          />
        ))}

        {/* Bottom baseline */}
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH}
          stroke="rgba(255,255,255,0.1)" />

        {/* Y-axis labels */}
        {ticks.map((s) => (
          <text key={s}
            x={PAD_L - 10} y={yFor(s) + 5}
            fontFamily='"JetBrains Mono", monospace' fontSize={15}
            fill="#4D5876" textAnchor="end"
          >
            {s}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#trj-area)" />

        {/* Line — outer glow layer, then crisp line on top */}
        <path d={linePath} fill="none" stroke={chartColor} strokeWidth={10}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.10} />
        <path d={linePath} fill="none" stroke={chartColor} strokeWidth={5}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
        <path d={linePath} fill="none" stroke={chartColor} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Historical dots — hollow */}
        {sorted.map((p, i) => {
          if (!!p.current) return null;
          const x = xFor(i);
          const y = yFor(p.score);
          return (
            <circle key={i} cx={x} cy={y} r={4.5}
              fill="rgba(10,9,20,1)"
              stroke={chartColor} strokeWidth={1.5} opacity={0.45}
            />
          );
        })}

        {/* Current stream dot — concentric rings */}
        <circle cx={cX} cy={cY} r={22} fill={chartColor} opacity={0.06} />
        <circle cx={cX} cy={cY} r={13} fill={chartColor} opacity={0.13} />
        <circle cx={cX} cy={cY} r={7} fill={chartColor} />
        <circle cx={cX} cy={cY} r={3} fill="rgba(10,9,20,0.9)" />

        {/* Score label beside dot — white so it reads against the line */}
        <text
          x={labelRight ? cX + 18 : cX - 18}
          y={cY + 9}
          fontFamily='"Instrument Serif", Georgia, serif' fontSize={30}
          fill={chartColor} opacity={0.3}
          textAnchor={labelRight ? "start" : "end"}
          letterSpacing="-0.025em"
          strokeWidth={8} stroke={chartColor} strokeLinejoin="round" paintOrder="stroke"
        >
          {current.score}
        </text>
        <text
          x={labelRight ? cX + 18 : cX - 18}
          y={cY + 9}
          fontFamily='"Instrument Serif", Georgia, serif' fontSize={30}
          fill="#ECF1FA"
          textAnchor={labelRight ? "start" : "end"}
          letterSpacing="-0.025em"
        >
          {current.score}
        </text>

        {/* X-axis date labels */}
        {tickIndices.map((i) => {
          const x = xFor(i);
          const anchor: "start" | "middle" | "end" =
            i === 0 ? "start" : i === N - 1 ? "end" : "middle";
          return (
            <text key={i} x={x} y={PAD_T + innerH + 30}
              fontFamily='"JetBrains Mono", monospace' fontSize={14}
              fill="#6F7C95" letterSpacing="0.04em" textAnchor={anchor}
            >
              {formatTickDate(sorted[i].date, allDates)}
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
        <TrjStat n={overallDelta} label={`Change from first`} color={trendColor} signed />
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
