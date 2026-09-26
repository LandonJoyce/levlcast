"use client";

import { useState, type CSSProperties } from "react";
import { RotateCcw } from "lucide-react";

/**
 * The homepage's promotion screen, played as a short sequence:
 *
 *   0.0s  Silver I, the bar filling from 76 toward 100
 *   0.9s  the emblem charges up and shakes
 *   1.15s flash, two shockwave rings and a burst of sparks; it turns Gold
 *   1.3s  PROMOTED rises in, letter by letter, then +34 pops
 *   1.9s  the new Gold bar fills to 10%
 *   2.6s  it settles into a slow float, and a replay button appears
 *
 * Everything is CSS (home-ranked.css, "The promotion"); this component
 * only exists so the replay button can restart it, by remounting the
 * frame. Under reduced motion it's the finished screen, still.
 *
 * The numbers match the rest of the homepage: 1176 points is 76 into
 * Silver I, +34 makes 1210, which is 10 into Gold IV.
 */

// Fixed, not random, so the server and browser render the same sparks.
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

const WORD = "PROMOTED";

export default function RankUp() {
  const [run, setRun] = useState(0);

  return (
    <div className="v3-result">
      <p className="sr-only">Stream result: promoted from Silver I to Gold IV, plus 34 points.</p>
      <div className="v3-frame ru" key={run}>
        <div className="v3-result-top" aria-hidden="true">
          <span>Result</span>
          <span>4h 11m</span>
        </div>

        <div className="ru-stage" aria-hidden="true">
          <span className="ru-rays" />
          <span className="ru-glow" />
          <span className="ru-flash" />
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
        </div>

        <p className="ru-word" aria-hidden="true">
          {WORD.split("").map((c, i) => (
            <span key={i} style={{ "--i": i } as CSSProperties}>
              {c}
            </span>
          ))}
        </p>
        <p className="ru-line" aria-hidden="true">
          <span className="ru-rank">Gold IV</span>
          <span className="ru-delta">+34</span>
        </p>
        <div className="ru-bar" aria-hidden="true">
          <span className="ru-bar-old" />
          <span className="ru-bar-new" />
        </div>
        <p className="ru-sub" aria-hidden="true">
          <span className="ru-sub-old">Silver I</span>
          <span className="ru-sub-new">10% to Gold III</span>
        </p>

        <button type="button" className="ru-replay" onClick={() => setRun((r) => r + 1)} aria-label="Play the promotion again">
          <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
