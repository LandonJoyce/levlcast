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
    version: "v0.8.5",
    date: "2026-04-17",
    title: "No Fake Quotes",
    items: [
      { type: "improved", text: "Clip titles and captions no longer invent dialogue — if the AI isn't certain what you said, it describes the moment instead of quoting you" },
      { type: "improved", text: "Stricter no-quote rules across every clip field so your posts never put the wrong words in your mouth" },
    ],
  },
  {
    version: "v0.8.4",
    date: "2026-04-17",
    title: "Dashboard & VODs Redesign",
    items: [
      { type: "improved", text: "Home dashboard now opens with a big Latest Stream hero — your score, trend, and next action all in one card" },
      { type: "improved", text: "Recent streams list got progress bars and bigger score readouts so you can scan your history in seconds" },
      { type: "improved", text: "Onboarding checklist redesigned as a featured violet card — clear, glowing, and impossible to miss" },
      { type: "improved", text: "VODs page now starts with a clean status strip (total / analyzed / processing) and a Start Here spotlight for your first analysis" },
      { type: "improved", text: "VOD rows show thumbnails with a score badge, a progress bar, and a status accent stripe — one layout that works on every screen size" },
    ],
  },
  {
    version: "v0.8.3",
    date: "2026-04-17",
    title: "Analytics & Growth Redesign",
    items: [
      { type: "improved", text: "Analytics page now opens with a full Performance Pulse — your average coach score, trend, and streak all at a glance" },
      { type: "improved", text: "Best Stream and Hottest Moment get their own featured cards so your wins don't get buried" },
      { type: "improved", text: "Category breakdown shows your #1 archetype front and center, with every category ranked on glowing bars" },
      { type: "improved", text: "Growth page now leads with a Growth Pulse card that tells you plainly if you're trending up, flat, or slipping" },
      { type: "improved", text: "Top Clips #1 clip gets a hero treatment so you know exactly which one to post first" },
      { type: "improved", text: "Follower trend, consistency grid, and tactics carousel upgraded to match the new premium look" },
    ],
  },
  {
    version: "v0.8.2",
    date: "2026-04-17",
    title: "Retention & Onboarding",
    items: [
      { type: "improved", text: "Welcome screen now sends you straight to your VODs — no dead ends after sign up" },
      { type: "new",      text: "After your first analysis, a banner shows exactly how many clip moments are ready and takes you straight there" },
      { type: "new",      text: "If you sign up but don't analyze a stream within 24 hours, LevlCast emails you a reminder" },
    ],
  },
  {
    version: "v0.8.1",
    date: "2026-04-16",
    title: "Clip Accuracy Overhaul",
    items: [
      { type: "improved", text: "Clips now match their descriptions much more accurately — timestamps are snapped to real speech boundaries with strict drift limits" },
      { type: "improved", text: "Long streams (2+ hours) no longer miss great moments that happen on chunk boundaries" },
      { type: "improved", text: "Stricter clip selection — fewer mediocre clips, only moments that actually stop someone scrolling" },
      { type: "improved", text: "Coach no longer penalizes silence during intros, movie reactions, or intense gameplay" },
      { type: "fix",      text: "Clips can no longer balloon past 90 seconds from timestamp snapping" },
      { type: "fix",      text: "More precise video segment timing on long VODs prevents gradual timestamp drift" },
    ],
  },
  {
    version: "v0.8",
    date: "2026-04-15",
    title: "The Honest Coach Patch",
    items: [
      { type: "improved", text: "Landing page now leads with what the coach actually does — specific fixes for dead air, slow openings, and the habits you can't see while you're live" },
      { type: "improved", text: "Gaming VODs are now correctly classified even when the transcript is quiet (game audio is stripped by speaker filtering) — the coach reads the stream title to know what you're actually playing" },
      { type: "new",      text: "Sharper positioning: real coaching on your actual stream, so every session makes you sharper than the last" },
      { type: "new",      text: "Twitch Panel — download a 'Coached by LevlCast' panel to put under your Twitch stream. Takes 30 seconds and shows your viewers you take growth seriously" },
    ],
  },
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
