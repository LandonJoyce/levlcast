/**
 * LevlCast patch notes — add new entries at the top.
 * Keep entries user-facing only. No backend details, API names, or implementation info.
 * Write from the streamer's perspective: what changed for them, not how it works.
 */

export type ChangeType = "new" | "improved" | "fix" | "removed";

export interface ChangelogItem {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: ChangelogItem[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "v0.7",
    date: "2026-04-12",
    title: "The Visibility Patch",
    items: [
      { type: "improved", text: "Streamer Health (burnout score) now lives in the sidebar — always visible alongside your stats, not buried at the bottom" },
      { type: "improved", text: "Coach report now shows a prominent retention alert when drop-off risk is medium or high — easy to see before digging into the breakdown" },
      { type: "improved", text: "VOD detail page now shows a 'clips ready' nudge after generating clips, pointing you straight to the Clips page to post them" },
    ],
  },
  {
    version: "v0.6",
    date: "2026-04-11",
    title: "The Planner + Flow Patch",
    items: [
      { type: "new",      text: "Title Generator — select what you're streaming and get 3 title ideas per content type, each with a short explanation of why it works" },
      { type: "new",      text: "Silence Gap detector — your coach report now highlights the longest quiet stretches in your stream so you know where energy dropped off" },
      { type: "new",      text: "Cold Open score — each report now rates how strong your first 5 minutes were: Strong, Slow Start, or Cold Open" },
      { type: "improved", text: "Analytics top section redesigned — stream score, best stream, hottest moment, best content type, and sweet spot length are now front and center" },
      { type: "improved", text: "Navigation is now grouped into Create, Grow, and Account — easier to know where you are and what to do next" },
      { type: "improved", text: "Clips page now nudges you to connect YouTube or TikTok if you haven't yet, so you can actually post what you've generated" },
      { type: "fix",      text: "Clip cards were showing the same caption text twice — now shown once" },
    ],
  },
  {
    version: "v0.5",
    date: "2026-04-10",
    title: "The Coaching Patch",
    items: [
      { type: "improved", text: "Coach feedback now references specific moments from your stream — no more advice that could apply to any streamer" },
      { type: "improved", text: "Game audio and background sounds are filtered out before your stream is analyzed — feedback is based only on what you actually said" },
      { type: "fix",      text: "Removed filler sections from the coach report that weren't adding useful information" },
      { type: "fix",      text: "Coach report layout fixed on mobile — sections no longer squeeze into an unreadable two-column grid" },
      { type: "new",      text: "First-time users now see a clear 'Start Here' prompt on their most recent stream so the first step is obvious" },
    ],
  },
  {
    version: "v0.4",
    date: "2026-04-10",
    title: "The Subscription Patch",
    items: [
      { type: "improved", text: "iOS and Android subscriptions now renew automatically without needing to open the app" },
      { type: "improved", text: "Settings page now shows exactly when your Pro access expires after cancellation" },
      { type: "improved", text: "Subscription status is clearer throughout the app — you always know what plan you're on and when it changes" },
    ],
  },
  {
    version: "v0.3",
    date: "2026-04-06",
    title: "The Debrief Patch",
    items: [
      { type: "new",      text: "Quick Listen — tap to hear your full coaching report read aloud, useful when you don't want to read" },
      { type: "new",      text: "Score badge now shows how much you went up or down from your last stream" },
      { type: "improved", text: "Coaching style now adapts to your stream type — gaming, just chatting, IRL, variety, and educational each get different feedback" },
      { type: "improved", text: "Clip selection quality improved across the board" },
      { type: "improved", text: "Energy tracking now shows how your talking pace changed across the stream" },
    ],
  },
  {
    version: "v0.2",
    date: "2026-04-05",
    title: "The Mobile Patch",
    items: [
      { type: "new",      text: "iOS app — analyze VODs, generate clips, and view your coach report from your phone" },
      { type: "new",      text: "Live progress updates while your stream is being analyzed on mobile" },
      { type: "improved", text: "Clip start and end points are more accurate — clips no longer cut off mid-sentence" },
    ],
  },
  {
    version: "v0.1",
    date: "2026-03-30",
    title: "Launch",
    items: [
      { type: "new", text: "VOD analysis — AI watches your stream, finds your peak moments, and scores your performance out of 100" },
      { type: "new", text: "Clip generation — your best moments cut into short-form video, ready to post" },
      { type: "new", text: "YouTube posting directly from your clip library" },
      { type: "new", text: "Pro subscription — 20 analyses and 20 clips per month" },
    ],
  },
];

/** The date of the most recent entry — used for the sidebar New badge. */
export const LATEST_CHANGELOG_DATE = changelog[0].date;
