"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  /** The target value to count up to. */
  target: number;
  /** Total animation duration in ms. */
  duration?: number;
  /** Optional suffix rendered after the number (e.g. "+"). */
  suffix?: string;
  /** Optional class applied to the wrapping span. */
  className?: string;
  /** Start animation only when the element scrolls into view. Default true. */
  whenVisible?: boolean;
}

/**
 * Number that animates from 0 to `target` on mount or on first scroll-into-view.
 * Uses an eased curve (ease-out cubic) so it slows down at the end — feels more
 * like a slot machine than a linear count, which makes the final number feel
 * earned instead of mechanical.
 */
export default function CountUp({
  target,
  duration = 1400,
  suffix = "",
  className,
  whenVisible = true,
}: Props) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;

    const begin = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const startTime = performance.now();
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    if (!whenVisible || !ref.current) {
      begin();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          begin();
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration, whenVisible]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString()}
      {suffix}
    </span>
  );
}
