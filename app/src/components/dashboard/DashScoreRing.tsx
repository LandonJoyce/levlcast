"use client";

import { useEffect, useRef, useState } from "react";
import { scoreColorVar } from "@/lib/score-utils";
export { scoreColorVar, scoreColorHex, rankFor } from "@/lib/score-utils";
export type { RankInfo } from "@/lib/score-utils";

interface DashScoreRingProps {
  value: number;
  size?: number;
  animate?: boolean;
}

export default function DashScoreRing({ value, size = 132, animate = true }: DashScoreRingProps) {
  const [displayed, setDisplayed] = useState(animate ? 0 : value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      setDisplayed(value);
      return;
    }

    const start = performance.now();
    const duration = 1100;
    const from = displayed;
    const to = value;

    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    const startTimeout = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 250);

    return () => {
      clearTimeout(startTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, animate]);

  const c = scoreColorVar(displayed);

  return (
    <div
      className="score-ring"
      style={{
        ["--p" as string]: displayed,
        ["--c" as string]: c,
        width: size,
        height: size,
      } as React.CSSProperties}
    >
      <b style={{ fontSize: Math.round(size * 0.27) }}>
        {displayed}
        <small>/100</small>
      </b>
    </div>
  );
}
