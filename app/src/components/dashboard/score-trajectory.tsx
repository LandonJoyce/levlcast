"use client";

/**
 * ScoreTrajectory — score history chart in the report's full design
 * language. Score zone bands (red <33, amber 33-65, green >65) so the
 * line passes through visible "neighborhoods" instead of floating in
 * empty space. Personal-best star, current-stream pin with score +
 * delta, summary stats grid below.
 *
 * Same data as before; tighter information density and proper typography.
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

export function ScoreTrajectory({ points }: { points: TrajectoryPoint[] }) {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const N = sorted.length;
  const currentIdx = sorted.findIndex((p) => p.current);
  const current = currentIdx >= 0 ? sorted[currentIdx] : sorted[N - 1];

  // Stats
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

  // Geometry — wider + taller than before for breathing room
  const W = 800;
  const H = 240;
  const PAD_L = 44;     // room for y-axis labels
  const PAD_R = 32;
  const PAD_T = 36;     // room for "now" pin label above current point
  const PAD_B = 38;     // room for x-axis date labels
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const yFor = (s: number) => PAD_T + innerH * (1 - Math.max(0, Math.min(100, s)) / 100);
  const xFor = (i: number) => PAD_L + (i * innerW) / Math.max(1, N - 1);

  // Smooth path via cardinal-spline-ish midpoints — gentler than straight lines
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

  // Area under the curve
  const areaPath =
    linePath +
    ` L ${xFor(N - 1).toFixed(1)} ${(PAD_T + innerH).toFixed(1)}` +
    ` L ${xFor(0).toFixed(1)} ${(PAD_T + innerH).toFixed(1)} Z`;

  // X-axis tick selection — show first, last, and a couple in between
  // (avoid date labels overlapping)
  const tickIndices = (() => {
    if (N <= 4) return Array.from({ length: N }, (_, i) => i);
    return [0, Math.floor((N - 1) / 3), Math.floor(2 * (N - 1) / 3), N - 1];
  })();

  return (
    <div style={{
      margin: "0 0 36px",
      padding: "26px 28px 22px",
      borderRadius: 12,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {/* Header — same typography family as Silence Map */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 24, marginBottom: 4 }}>
        <h2 style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontWeight: 400,
          fontSize: 28, letterSpacing: "-0.015em", lineHeight: 1, margin: 0, color: "#ECF1FA",
        }}>
          The <em style={{ fontStyle: "italic", color: trendColor }}>Trajectory.</em>
        </h2>
        <p style={{
          fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic",
          fontSize: 14, color: "#6F7C95", textAlign: "right", margin: 0, maxWidth: 280, lineHeight: 1.4,
        }}>
          Last {N} streams. The line is your story — <span style={{ color: trendColor }}>{trendItalic}</span>
        </p>
      </div>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.28em", color: "#6F7C95",
        marginBottom: 18,
      }}>
        Score Trajectory · {trendLabel}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }} aria-hidden>
        <defs>
          <linearGradient id="trj-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.32" />
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
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Score zone bands — visualizes "where this score sits" */}
        <rect x={PAD_L} y={yFor(100)} width={innerW} height={yFor(66) - yFor(100)} fill="url(#trj-zone-green)" />
        <rect x={PAD_L} y={yFor(66)} width={innerW} height={yFor(33) - yFor(66)} fill="url(#trj-zone-amber)" />
        <rect x={PAD_L} y={yFor(33)} width={innerW} height={yFor(0) - yFor(33)} fill="url(#trj-zone-red)" />

        {/* Top + bottom borders on chart area */}
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T} y2={PAD_T} stroke="rgba(255,255,255,0.07)" />
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke="rgba(255,255,255,0.12)" />

        {/* Y-axis ticks — 0 / 33 / 66 / 100 */}
        {[0, 33, 66, 100].map((s) => (
          <g key={s}>
            <line
              x1={PAD_L} x2={W - PAD_R}
              y1={yFor(s)} y2={yFor(s)}
              stroke="rgba(255,255,255,0.06)"
              strokeDasharray="2 5"
            />
            <text
              x={PAD_L - 8} y={yFor(s) + 3}
              fontFamily='"JetBrains Mono", monospace' fontSize={10}
              fill="#4D5876" letterSpacing="0.08em" textAnchor="end"
            >
              {s}
            </text>
          </g>
        ))}

        {/* Area fill (low opacity) */}
        <path d={areaPath} fill="url(#trj-area)" />

        {/* Soft glow under the line */}
        <path d={linePath} fill="none" stroke="rgba(167,139,250,0.35)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" filter="url(#trj-line-glow)" />
        {/* Crisp line on top */}
        <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />

        {/* Bubbles — small for past, prominent for current */}
        {sorted.map((p, i) => {
          const x = xFor(i);
          const y = yFor(p.score);
          const isCurrent = !!p.current;
          const isPeak = i === peakIdx && peak >= 50 && N >= 3;
          const color = isCurrent ? scoreColor(p.score) : "#a78bfa";
          const r = isCurrent ? 7 : 4;

          return (
            <g key={i}>
              {isCurrent && <circle cx={x} cy={y} r={r + 6} fill={color} opacity={0.18} />}
              <circle
                cx={x} cy={y} r={r}
                fill={isCurrent ? color : "rgba(167,139,250,0.18)"}
                stroke={isCurrent ? color : "rgba(167,139,250,0.65)"}
                strokeWidth={isCurrent ? 0 : 1.5}
              />

              {/* Personal best star — only when current = peak */}
              {isPeak && isPersonalBest && (
                <text
                  x={x} y={y - 16}
                  fontFamily='"Instrument Serif", Georgia, serif' fontStyle="italic" fontSize={14}
                  fill="#fbbf24" textAnchor="middle"
                >
                  ★
                </text>
              )}

              {/* Current-stream score label hovering above */}
              {isCurrent && (
                <>
                  <line x1={x} x2={x} y1={y - 9} y2={PAD_T - 6} stroke={color} strokeWidth={1} strokeDasharray="1 3" opacity={0.6} />
                  <text
                    x={x} y={PAD_T - 12}
                    fontFamily='"Instrument Serif", Georgia, serif' fontSize={20}
                    fill={color} textAnchor="middle" letterSpacing="-0.02em"
                  >
                    {p.score}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* X-axis date labels */}
        {tickIndices.map((i) => {
          const x = xFor(i);
          return (
            <text
              key={i} x={x} y={PAD_T + innerH + 22}
              fontFamily='"JetBrains Mono", monospace' fontSize={10}
              fill="#6F7C95" letterSpacing="0.06em" textAnchor="middle"
            >
              {fmtShortDate(sorted[i].date)}
            </text>
          );
        })}
      </svg>

      {/* Summary stats grid — same shape as Silence Map's footer */}
      <div style={{
        marginTop: 18, paddingTop: 16,
        borderTop: "1px dashed rgba(255,255,255,0.12)",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 16,
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
        letterSpacing: "-0.02em", color, marginBottom: 6,
      }}>
        {display}
      </div>
      <div style={{
        fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic",
        fontSize: 13, color: "#6F7C95", lineHeight: 1.4,
      }}>
        {label}
      </div>
    </div>
  );
}

export type { TrajectoryPoint };
