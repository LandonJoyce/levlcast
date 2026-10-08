"use client";

/**
 * Records that a signed-in person opened LevlCast, once a day per browser
 * (the outreach page's "Came back another day"). Reports alone can't show
 * that: the background jobs sync new streams and start first reports with
 * nobody there. The account comes from the session on the server.
 */

import { useEffect } from "react";
import { track } from "./track";

const DAY_KEY = "lc_open_day";

export function AppOpenPing() {
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(DAY_KEY) === day) return;
      localStorage.setItem(DAY_KEY, day);
    } catch {
      // Storage blocked: record it anyway. A repeat on the same day changes nothing.
    }
    track("app_open");
  }, []);
  return null;
}
