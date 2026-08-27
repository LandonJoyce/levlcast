"use client";

import { useEffect, useState } from "react";

function scoreHex(n: number) { return n >= 75 ? "#4ade80" : n >= 50 ? "#facc15" : "#f87171"; }
function scoreCls(n: number) { return n >= 75 ? "text-green-400" : n >= 50 ? "text-yellow-400" : "text-red-400"; }

export function WrappedArc({ score }: { score: number }) {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const duration = 1800;
    const delay = 350;
    let raf = 0;
    let startTs: number | null = null;
    const timeout = setTimeout(() => {
      const tick = (ts: number) => {
        if (startTs === null) startTs = ts;
        const t = Math.min(1, (ts - startTs) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplayScore(Math.round(score * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [score]);

  const hex = scoreHex(displayScore);
  const cls = scoreCls(displayScore);
  const R = 70, cx = 80, cy = 90;
  const startAngle = -200, sweep = 220;
  const polar = (a: number, r = R) => {
    const rad = (a * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const start = polar(startAngle);
  const end = polar(startAngle + sweep);
  const progEnd = polar(startAngle + (displayScore / 100) * sweep);
  const largeArc = 1;
  const progLarge = (displayScore / 100) * sweep > 180 ? 1 : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 144 }}>
      <svg width="200" height="144" viewBox="0 0 160 120" className="absolute inset-0">
        <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />
        {displayScore > 0 && (
          <path d={`M ${start.x} ${start.y} A ${R} ${R} 0 ${progLarge} 1 ${progEnd.x} ${progEnd.y}`} fill="none" stroke={hex} strokeWidth="6" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${hex})` }} />
        )}
        {[25, 50, 75].map((v) => {
          const a = startAngle + (v / 100) * sweep;
          const inner = polar(a, R - 10);
          const outer = polar(a, R - 4);
          return <line key={v} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />;
        })}
      </svg>
      <div className="flex flex-col items-center" style={{ marginTop: 12 }}>
        <div className="flex items-baseline gap-1">
          <span className={`font-black tabular-nums leading-none ${cls}`} style={{ fontSize: 52 }}>{displayScore}</span>
          <span className="text-xl font-bold text-white/20">/100</span>
        </div>
      </div>
    </div>
  );
}
