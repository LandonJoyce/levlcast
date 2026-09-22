"use client";

/**
 * The detailed report, collapsed by default.
 *
 * Everything inside this is worth keeping — the stream story, what
 * worked, the opening and closing notes, the timeline, the trajectory,
 * the growth-killer flags. The problem was never that it existed, it was
 * that all of it loaded at once, above the fold, in paragraphs, so the
 * page asked to be read before it would tell you anything.
 *
 * The post-match summary above answers the three questions someone
 * actually opens this for: did I go up, what cost me, what do I do next.
 * This is where you go when the answer was not enough, and it stays shut
 * until you ask for it.
 *
 * Rendered with the children always mounted and hidden rather than
 * conditionally rendered, so the charts inside do not re-run their
 * entrance animations every time it is toggled, and so in-page anchors
 * and browser find still reach the content.
 */

import { useState, type ReactNode } from "react";

export function FullBreakdown({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "16px 20px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.09)",
          color: "#ECF1FA",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        <span>
          {open ? "Hide the full breakdown" : "Read the full breakdown"}
          <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "#6F7C95", marginTop: 3 }}>
            The whole story of this stream, what worked, your timeline and your trend.
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 18,
            color: "#6F7C95",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 220ms ease",
            flexShrink: 0,
          }}
        >
          ⌄
        </span>
      </button>

      <div hidden={!open} style={{ marginTop: 18 }}>
        {children}
      </div>
    </div>
  );
}
