"use client";

import { useEffect, useRef, useState } from "react";

export function scoreColorVar(n: number): string {
  if (n >= 80) return "var(--green)";
  if (n >= 60) return "var(--blue)";
  if (n >= 40) return "var(--warn)";
  return "var(--danger)";
}

export function scoreColorHex(n: number): string {
  if (n >= 80) return "#74e0a8";
  if (n >= 60) return "#5da3ff";
  if (n >= 40) return "#e8c970";
  return "#e26060";
}

export interface RankInfo {
  label: string;
  cls: "fresh" | "rising" | "consist" | "crowd" | "elite" | "legend";
}

// LevlCast real 6-tier ranks (matches CLAUDE.md)
export function rankFor(n: number): RankInfo {
  if (n >= 90) return { label: "LevlCast Legend",    cls: "legend"  };
  if (n >= 80) return { label: "Elite Entertainer",  cls: "elite"   };
  if (n >= 70) return { label: "Crowd Favorite",     cls: "crowd"   };
  if (n >= 55) return { label: "Consistent Creator", cls: "consist" };
  if (n >= 40) return { label: "Rising Talent",      cls: "rising"  };
  return        { label: "Fresh Streamer",          cls: "fresh"   };
}

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
