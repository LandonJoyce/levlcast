"use client";

import { useEffect } from "react";
import { LATEST_CHANGELOG_DATE } from "@/lib/changelog";

/** Marks the changelog as read in localStorage when the page is visited. */
export function ChangelogSeen() {
  useEffect(() => {
    localStorage.setItem("changelog_seen", LATEST_CHANGELOG_DATE);
  }, []);

  return null;
}
