"use client";

/**
 * Records a visit to a finished free report (/analyze/<vodId>) in the
 * signup funnel. That page renders on the server with no client code of
 * its own, so without this a DM that links someone's own report would
 * look like nobody ever clicked it.
 */

import { useEffect, useRef } from "react";
import { rememberRef, track } from "./track";

export function LandingBeacon({ refParam, vodId }: { refParam?: string; vodId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    const ref = rememberRef(refParam);
    track("land", "report-link");
    // Someone handed their own finished report in a DM or a review-thread
    // reply got a free report and saw it, the same as if they'd run it.
    // Counted so the funnel's steps still add up for them.
    const via = refParam ?? ref ?? "";
    if (via.startsWith("dm-") || via === "thread") {
      const how = via === "thread" ? "thread-report" : "dm-report";
      track("preview_start", `${vodId} ${how}`);
      track("preview_ready", `${vodId} ${how}`);
    }
  }, [refParam, vodId]);
  return null;
}
