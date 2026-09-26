"use client";

/**
 * The detailed report, folded at the bottom of the stream page.
 *
 * Everything inside is worth keeping: the stream story, what worked, the
 * opening and closing notes, the timeline, the trend, the habits that
 * cost viewers. The problem was never that it existed, it was that all of
 * it loaded at once, above the fold, so the page asked to be read before
 * it would tell you anything. The top of the page answers what people
 * open it for: did I go up, what cost me, what do I do next.
 *
 * The children stay mounted and hidden rather than conditionally
 * rendered, so the charts inside don't replay their entrance every time
 * it's toggled, and so in-page anchors and browser find still reach it.
 */

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function FullBreakdown({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="fb">
      <button type="button" className="fb-toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          <b>{open ? "Hide the full breakdown" : "Read the full breakdown"}</b>
          <span>The whole stream start to finish, what worked, where it went quiet, and your trend.</span>
        </span>
        <ChevronDown size={18} strokeWidth={2} aria-hidden="true" data-open={open ? "yes" : undefined} />
      </button>

      <div hidden={!open} className="fb-body">
        {children}
      </div>
    </section>
  );
}
