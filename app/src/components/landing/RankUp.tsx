"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * The homepage's promotion screen, played as a short sequence and looped:
 *
 *   0.0s  Silver I, the bar filling from 76 toward 100
 *   0.6s  a cool glow builds; at 0.85s a ring pulls in and it shakes
 *   1.15s flash, two shockwave rings and a burst of sparks; it turns Gold
 *   1.3s  PROMOTED rises in, letter by letter, then +34 pops
 *   1.9s  the new Gold bar fills to 10%
 *   2.6s  it settles: a slow float, faint rays, embers drifting up
 *   7.5s  it fades out and plays again
 *
 * The motion is all CSS (home-ranked.css, "The promotion"). This component
 * only loops it, by remounting the stage, and only while it can be seen:
 * scrolled away or in a background tab it stops, and it starts over when
 * it comes back. Under reduced motion it's the finished screen, still.
 *
 * The numbers match the rest of the homepage: 1176 points is 76 into
 * Silver I, +34 makes 1210, which is 10 into Gold IV.
 */

// Fixed, not random, so the server and the browser render the same thing.
const SPARKS = [
  { a: -90, d: 138, w: 16, t: 0 },
  { a: -62, d: 118, w: 11, t: 30 },
  { a: -35, d: 146, w: 14, t: 10 },
  { a: -8, d: 124, w: 9, t: 45 },
  { a: 18, d: 150, w: 15, t: 5 },
  { a: 44, d: 116, w: 10, t: 35 },
  { a: 70, d: 132, w: 13, t: 20 },
  { a: 96, d: 110, w: 9, t: 55 },
  { a: 122, d: 142, w: 15, t: 15 },
  { a: 148, d: 120, w: 11, t: 40 },
  { a: 174, d: 136, w: 14, t: 0 },
  { a: 200, d: 112, w: 9, t: 50 },
  { a: 226, d: 148, w: 16, t: 25 },
  { a: 252, d: 124, w: 10, t: 10 },
];

// Embers rising off the new emblem while it idles: start offset, drift,
// how long each rise takes and when it first goes.
const EMBERS = [
  { x: -46, dx: -10, dur: 3400, t: 2300 },
  { x: 38, dx: 12, dur: 3900, t: 2700 },
  { x: -14, dx: 8, dur: 3100, t: 3200 },
  { x: 58, dx: -6, dur: 4200, t: 3500 },
  { x: -62, dx: 6, dur: 3700, t: 4100 },
  { x: 16, dx: -12, dur: 3300, t: 4600 },
];

const WORD = "PROMOTED";

/** One play plus the hold on the finished screen, then the fade out. */
const HOLD_UNTIL_MS = 7500;
const FADE_MS = 450;

export default function RankUp() {
  const [run, setRun] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [active, setActive] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const wasActive = useRef(true);

  // On screen and in a visible tab.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let onScreen = true;
    const update = () => setActive(onScreen && document.visibilityState === "visible");
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        update();
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  // Coming back into view starts it over rather than showing the end.
  useEffect(() => {
    if (active && !wasActive.current) {
      setLeaving(false);
      setRun((r) => r + 1);
    }
    wasActive.current = active;
  }, [active]);

  // Hold, fade out, play again, for as long as it can be seen.
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const leave = window.setTimeout(() => setLeaving(true), HOLD_UNTIL_MS);
    const again = window.setTimeout(() => {
      setLeaving(false);
      setRun((r) => r + 1);
    }, HOLD_UNTIL_MS + FADE_MS);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(again);
    };
  }, [run, active]);

  return (
    <div className="v3-result" ref={rootRef}>
      <p className="sr-only">Stream result: promoted from Silver I to Gold IV, plus 34 points.</p>
      <div className="ru" key={run} data-leaving={leaving ? "yes" : undefined} aria-hidden="true">
        <div className="ru-body">
          <div className="ru-stage">
            <span className="ru-rays" />
            <span className="ru-cool" />
            <span className="ru-glow" />
            <span className="ru-flash" />
            <span className="ru-charge" />
            <span className="ru-ring" />
            <span className="ru-ring ru-ring-late" />
            <span className="ru-sparks">
              {SPARKS.map((s, i) => (
                <i
                  key={i}
                  style={{ "--a": `${s.a}deg`, "--d": `${s.d}px`, "--w": `${s.w}px`, "--t": `${s.t}ms` } as CSSProperties}
                />
              ))}
            </span>
            {/* High priority: the sequence starts on first paint. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ru-emb ru-from" src="/ranks/silver.png" alt="" width={384} height={384} fetchPriority="high" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ru-emb ru-to" src="/ranks/gold.png" alt="" width={384} height={384} fetchPriority="high" />
            <span className="ru-embers">
              {EMBERS.map((e, i) => (
                <i
                  key={i}
                  style={
                    { "--x": `${e.x}px`, "--dx": `${e.dx}px`, "--dur": `${e.dur}ms`, "--t": `${e.t}ms` } as CSSProperties
                  }
                />
              ))}
            </span>
          </div>

          <p className="ru-word">
            {WORD.split("").map((c, i) => (
              <span key={i} style={{ "--i": i } as CSSProperties}>
                {c}
              </span>
            ))}
          </p>
          <p className="ru-line">
            <span className="ru-rank">Gold IV</span>
            <span className="ru-delta">+34</span>
          </p>
          <div className="ru-bar">
            <span className="ru-bar-old" />
            <span className="ru-bar-new" />
          </div>
          <p className="ru-sub">
            <span className="ru-sub-old">Silver I</span>
            <span className="ru-sub-new">10% to Gold III</span>
          </p>
        </div>
      </div>
    </div>
  );
}
