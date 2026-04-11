/**
 * LevlCast patch notes — add new entries at the top.
 * The sidebar uses the latest date to show a "New" badge until the user visits.
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
    version: "v0.5",
    date: "2026-04-10",
    title: "The Coaching Patch",
    items: [
      { type: "improved", text: "Coach report now reads the story of your stream — feedback references specific moments that actually happened, not generic advice" },
      { type: "new",      text: "Speaker diarization filters out game audio, NPC dialogue, and music before any AI sees your transcript" },
      { type: "fix",      text: "Removed Content Mix and Stream Summary sections — they were filler that added noise" },
      { type: "improved", text: "What Worked / Fix for Next Stream now stacks vertically on mobile instead of breaking into a two-column grid" },
      { type: "new",      text: "First-analysis spotlight on the VODs page — new users get a clear 'Start Here' prompt on their most recent stream" },
      { type: "new",      text: "Custom 404 page" },
    ],
  },
  {
    version: "v0.4",
    date: "2026-04-10",
    title: "The Billing Fix",
    items: [
      { type: "fix",      text: "Cancelling PayPal no longer immediately downgrades your account — Pro access continues until your billing period ends" },
      { type: "new",      text: "RevenueCat webhook live — iOS and Android renewals now tracked server-side automatically" },
      { type: "fix",      text: "Settings page now shows 'Cancelled — Pro access until [date]' instead of iOS instructions after web cancellation" },
      { type: "fix",      text: "PayPal activation errors now surface to the user instead of silently swallowing the failure" },
      { type: "fix",      text: "Deleting a clip no longer silently refreshes if the delete actually failed" },
    ],
  },
  {
    version: "v0.3",
    date: "2026-04-06",
    title: "The Debrief Patch",
    items: [
      { type: "new",      text: "Quick Listen — hear your full coaching report read aloud with AI voice (OpenAI onyx)" },
      { type: "new",      text: "Score delta badge shows how much you improved or dropped from your last stream" },
      { type: "improved", text: "Category-specific coaching for gaming, just chatting, IRL, variety, and educational streamers" },
      { type: "improved", text: "Peak detection upgraded to Claude Sonnet — higher quality clip selection across the board" },
      { type: "improved", text: "WPM tracked per stream section to show your energy curve over time" },
    ],
  },
  {
    version: "v0.2",
    date: "2026-04-05",
    title: "The Mobile Patch",
    items: [
      { type: "new",      text: "Full iOS app — analyze VODs, generate clips, and view coach reports on mobile" },
      { type: "new",      text: "Real-time analysis progress on mobile with live status updates" },
      { type: "improved", text: "Emotional markers (uh, wait, oh) preserved in transcription for better clip boundary accuracy" },
      { type: "fix",      text: "Auth flow now redirects to login with error on profile failure instead of showing a broken dashboard" },
    ],
  },
  {
    version: "v0.1",
    date: "2026-03-30",
    title: "Initial Release",
    items: [
      { type: "new", text: "VOD analysis — AI finds your peak moments and scores your stream out of 100" },
      { type: "new", text: "Clip generation — cuts your best moments into shareable short-form video" },
      { type: "new", text: "Cloudflare R2 storage — no clip size limits, faster delivery" },
      { type: "new", text: "YouTube posting directly from your clip library" },
      { type: "new", text: "PayPal Pro subscription" },
    ],
  },
];

/** The date of the most recent entry — used for the sidebar New badge. */
export const LATEST_CHANGELOG_DATE = changelog[0].date;
