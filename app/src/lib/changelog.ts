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
    version: "v0.13.1",
    date: "2026-05-13",
    title: "Feedback channel + long stream fixes",
    items: [
      { type: "new", text: "Send feedback button in the sidebar. Anything you send goes straight to Landon." },
      { type: "new", text: "If a stream analysis fails, you can now tell us what happened with one click." },
      { type: "fix", text: "Long streams (3-4 hours) no longer time out mid-analysis." },
      { type: "fix", text: "Highlight reel and clip editor no longer fail with an unauthorized error on iOS." },
    ],
  },
  {
    version: "v0.13.0 (iOS 1.0.3)",
    date: "2026-05-11",
    title: "Mobile parity update",
    items: [
      { type: "new", text: "Edit your clips on iOS. Tap Edit on any clip to pick a hook frame, change the caption style, and rewrite caption text. Re-renders without costing a clip." },
      { type: "new", text: "Highlight reel button on the stream report page. Builds a 27-second multi-cut from your top three peaks in one tap." },
      { type: "new", text: "Recurring tag on iOS coach reports so you can tell pattern issues apart from one-offs." },
      { type: "new", text: "Tap any timestamp inside a coach report to open that exact moment on Twitch." },
      { type: "new", text: "Rewatch Two Minutes section: one win, one lesson, both linked to the Twitch timestamp." },
      { type: "new", text: "Heads up before you stream card on the iOS dashboard surfaces the one recurring pattern to keep in mind." },
      { type: "new", text: "Score trajectory sparkline on the last-stream card so you can see your trend at a glance." },
      { type: "improved", text: "Settings now shows your real trial counters (3 analyses, 5 clips lifetime) instead of the wrong monthly framing." },
      { type: "improved", text: "Subscribe screen lists the actual Pro features. No more phantom Priority Processing." },
      { type: "removed", text: "Missions section in coach reports is gone. The recommendation already covers next-stream focus." },
    ],
  },
  {
    version: "v0.12.1",
    date: "2026-05-09",
    title: "Editor Polish",
    items: [
      { type: "new", text: "Add caption cards manually. If the AI's transcript missed a line you said, hit + Add inside the editor and write it in at the current playback time." },
      { type: "new", text: "Revert to original. If you over-edit a clip, one click puts it back to the auto-generated cut. Your trim, captions, and hook frame edits get thrown away cleanly." },
      { type: "improved", text: "Hook frame thumbnails now show the timestamp under each one so you can pick a frame without playing through the whole clip." },
      { type: "improved", text: "Save & ship now shows a green confirmation with a summary of what shipped (download started, posted to YouTube). No more wondering if your click did anything." },
      { type: "fix", text: "Vertical export now honors your trim. Trimming a 30s clip to 10s and downloading vertical gives you a 10s vertical, not the original 30s." },
    ],
  },
  {
    version: "v0.12.0",
    date: "2026-05-09",
    title: "One-Click Save & Ship",
    items: [
      { type: "improved", text: "Clip and reel cards now have a single Open button instead of three different actions stacked vertically. Trim, captions, hook frame, vertical export, and YouTube posting all live inside the editor as one save-and-ship flow." },
      { type: "new", text: "Inside the editor, pick your format (16:9 horizontal or 9:16 vertical with cam layout) and where it goes (download, post to YouTube, or both), then hit Save & ship it. The editor handles the rest in one click." },
      { type: "improved", text: "Highlight reels can now use any caption style (bold, neon, fire, etc.). Visual style and the reel marker are tracked separately in the database so picking a style no longer breaks the reel identity." },
    ],
  },
  {
    version: "v0.11.2",
    date: "2026-05-08",
    title: "Edit Highlight Reels Too",
    items: [
      { type: "new", text: "Highlight reels are now editable. Trim them tighter, fix any caption typos across all the stitched moments, and pick a hook frame. Older reels need to be regenerated once before they unlock the editor." },
      { type: "fix", text: "Editing a reel no longer doubles the captions. Reels now save a clean version of the stitched video alongside the captioned one, and the editor knows how each reel segment maps back to the original VOD." },
    ],
  },
  {
    version: "v0.11.1",
    date: "2026-05-08",
    title: "Edit Your Clips",
    items: [
      { type: "new", text: "New clip editor: trim the start and end of any clip down to the exact second, fix caption typos, drop caption cards you don't want, and pick a hook frame for the thumbnail. Re-edits don't cost a clip from your quota." },
      { type: "improved", text: "Highlight reel cuts are now ~9 seconds each instead of 18, and the strongest moment leads the reel. Tighter cuts feel more produced and the hook hits in the first three seconds." },
    ],
  },
  {
    version: "v0.11.0",
    date: "2026-05-08",
    title: "Free Trial, Recommended Cuts, Highlight Reel",
    items: [
      { type: "new", text: "New free trial gives you 3 full VOD analyses and 5 clips to try LevlCast. Enough to see your scores trend, spot patterns across streams, and watch a few of your moments turn into clips before deciding to subscribe." },
      { type: "new", text: "Highlight Reel: stitch the top three moments from a stream into one short with captions baked in. Built for streamers who want a finished YouTube Short or TikTok in one click instead of cutting moments together themselves." },
      { type: "new", text: "Every report now surfaces a curated list of moments worth clipping, not just one auto-pick. The strongest clip still gets generated automatically, then you choose which of the remaining picks to spend a clip on." },
      { type: "new", text: "Missed-clip callout shows the moment in your stream that should have been a clip but wasn't fully landed, with the timestamp and what to do differently next time." },
      { type: "improved", text: "Clip moment detection now ranks up to five strong moments per stream instead of capping at three. Each pick still has to earn its slot. Padding bad clips into the list is explicitly off-limits." },
    ],
  },
  {
    version: "v0.10.3",
    date: "2026-05-07",
    title: "Coach Report Tightened",
    items: [
      { type: "removed", text: "Removed the missions section from the coach report. Generic homework-style goals weren't getting used and weren't earning their slot. The priority fix at the top is the one thing to act on." },
      { type: "new", text: "Two minutes to rewatch on every report — one win, one lesson. Click the timestamp and your VOD opens at exactly that moment so you can study your own tape." },
    ],
  },
  {
    version: "v0.10.2",
    date: "2026-05-05",
    title: "Streams Page Redesign + Clip Quality Lift",
    items: [
      { type: "new", text: "Your streams page now shows the best clip and a one-sentence coaching takeaway for each VOD right in the list. No need to open the full report to get value." },
      { type: "improved", text: "Clip moment detection now requires a stronger emotional arc before scoring a moment as clippable. Moments that only look good in context have been cut. Fewer clips, better clips." },
      { type: "improved", text: "Clip titles now follow TikTok-proven patterns that create curiosity gaps, emotional frames, and contrast instead of generic labels. Captions are now required to be specific to the exact clip situation." },
      { type: "improved", text: "Comedy clip detection now checks that the humor is in the content, not just the streamer's laugh. Delivery-only moments that don't translate to video get filtered out." },
    ],
  },
  {
    version: "v0.10.1",
    date: "2026-05-01",
    title: "Longitudinal Trend Card",
    items: [
      { type: "new", text: "Coach reports now include a trend assessment across your last 3 streams (Improving, Declining, or Consistent) with a written note from Claude referencing what changed and why" },
      { type: "improved", text: "The coaching AI now actively uses your stream history to avoid repeating advice you've already heard and instead focus on new issues or acknowledge real progress" },
    ],
  },
  {
    version: "v0.10.0",
    date: "2026-04-27",
    title: "Chat Pulse: Real Viewer Reaction Data",
    items: [
      { type: "new", text: "Coach reports now include a Chat Pulse: a timeline of your viewers' actual reactions: volume, laughs, hype, sad/cringe moments, sub events, bit cheers, and raid arrivals" },
      { type: "new", text: "Coaching insights now cite real chat behavior alongside transcript signals. Moments that looked great in audio but had quiet chat get called out as missed connections; audio dips with chat surges get scored as clip-worthy" },
      { type: "improved", text: "Clip moment detection now factors in chat reaction. If your chat exploded somewhere, that location is far more likely to make it into your clip moments" },
    ],
  },
  {
    version: "v0.9.3",
    date: "2026-04-27",
    title: "Last Stream Recap",
    items: [
      { type: "new", text: "Coach reports now open with a Last Stream Recap: score delta, sub-score moves, dead-air change, and which of last stream's missions you actually pulled off" },
      { type: "new", text: "Recurring weaknesses across streams get explicitly flagged: 'still happening this stream AND last'. The system remembers what you've been working on" },
      { type: "new", text: "Cleared anti-patterns are surfaced as wins ('was flagged last stream, gone this stream')" },
      { type: "improved", text: "Mission status pills (Done / Slipped / Ongoing) match each prior goal against the actual numbers from this stream" },
    ],
  },
  {
    version: "v0.9.2",
    date: "2026-04-27",
    title: "Coach Report Pro Unlocks + Auto-Sync",
    items: [
      { type: "new", text: "Coach report now shows exactly what Pro unlocks for THIS report: concrete counts of fixes, missions, and growth killers, not generic feature lists" },
      { type: "improved", text: "Upgrade buttons go straight to checkout from anywhere on the report. No more settings detour" },
      { type: "new", text: "We auto-detect new streams on your Twitch channel every 6 hours and email you when one's ready to analyze. Never miss a stream's coaching window again." },
      { type: "fix", text: "Clip generation reliability: tighter Twitch segment tolerance plus a remux fallback for VODs whose timestamps trip up FFmpeg's encoder" },
      { type: "fix", text: "Failed VODs now show the actual failure reason and a one-click retry button" },
    ],
  },
  {
    version: "v0.9.1",
    date: "2026-04-26",
    title: "Word-Synced Captions on Every Clip",
    items: [
      { type: "new", text: "Every generated clip now has TikTok-style word-synced captions burned in (Free and Pro), no extra step" },
      { type: "improved", text: "Captions read what you actually said (from the transcript), grouped 1–3 words at a time, synced to your voice" },
      { type: "improved", text: "Vertical export no longer re-encodes captions. Faster, no quality loss between encode passes" },
    ],
  },
  {
    version: "v0.9.0",
    date: "2026-04-25",
    title: "New Landing + Dashboard Redesign",
    items: [
      { type: "new", text: "Brand-new landing page with editorial layout, founding member tag, App Store card, and live coach-report mock" },
      { type: "new", text: "Brand-new dashboard shell: sidebar with rank, plan-aware upgrade card, breadcrumb topbar" },
      { type: "improved", text: "Dashboard home redesigned around your latest stream: score ring with reveal animation, next-session goal, score-over-time chart, recent streams table" },
      { type: "improved", text: "VODs page redesigned with quota meter, filter tabs, and cleaner status states" },
      { type: "improved", text: "Clips page redesigned with filter tabs, ready/posted/pending grouping, and a 4-up grid of vertical cards" },
      { type: "improved", text: "Account page rebuilt: profile, plan with quotas, real-only connections (Twitch + YouTube)" },
      { type: "new", text: "Free tier now shows a partial coach report: score, streamer type, stream story, and one strength visible. Priority fix, missions, anti-patterns, and best moment unlock with Pro" },
    ],
  },
  {
    version: "v0.8.16",
    date: "2026-04-24",
    title: "Sharper Coach Reports",
    items: [
      { type: "new", text: "Closing score: the coach now grades how the stream ended, not just how it opened" },
      { type: "new", text: "Anti-patterns detection: flags specific growth-killing phrases if you actually said them (viewer-count apologies, follow begging, self-deprecation). Every flag quotes the exact moment so you can verify" },
      { type: "new", text: "Shareable win: every report now surfaces one screenshot-worthy stat from your stream" },
      { type: "improved", text: "Cold-open scoring no longer penalizes the first 3–5 minutes of normal warm-up time" },
    ],
  },
  {
    version: "v0.8.15",
    date: "2026-04-24",
    title: "Faster, More Reliable Clip Generation",
    items: [
      { type: "improved", text: "Clip generation now downloads Twitch VOD segments in parallel, typically 3–5x faster, especially for longer clips" },
      { type: "fix", text: "Transient Twitch CDN hiccups now retry automatically instead of producing a broken clip or timing out" },
      { type: "improved", text: "Clearer error message when a clip fails. It tells you to regenerate instead of making you guess" },
    ],
  },
  {
    version: "v0.8.14",
    date: "2026-04-24",
    title: "New Marketing Pages",
    items: [
      { type: "new", text: "Launched dedicated pages for the VOD Analyzer, Clip Generator, and AI Stream Coach, each with deep explanations of what the tool does" },
      { type: "new", text: "Added a 'How to Grow on Twitch in 2026' guide with the honest version of what actually works" },
      { type: "improved", text: "Footer now links to every tool page so you can find what you need from anywhere on the site" },
    ],
  },
  {
    version: "v0.8.13",
    date: "2026-04-23",
    title: "Clips: Downloads, Duration, and Reliability",
    items: [
      { type: "fix", text: "Clip download button now actually downloads the file instead of opening the video in a new tab" },
      { type: "fix", text: "Clip generation now correctly handles Twitch VODs with large timestamp offsets. The cutter no longer produces zero-frame outputs on long streams" },
      { type: "improved", text: "Clip cards now show the real clip duration instead of an em dash" },
      { type: "improved", text: "Regenerating a failed clip on mobile now clears the old one instead of leaving it on the list" },
      { type: "improved", text: "Clip generation has more headroom. Longer VODs no longer time out mid-cut" },
    ],
  },
  {
    version: "v0.8.12",
    date: "2026-04-21",
    title: "Clip Generation Stability",
    items: [
      { type: "fix", text: "Fixed FFmpeg 'Invalid data' failures on clip generation. The cutter now handles stitched-together Twitch VOD segments without choking on timestamp discontinuities" },
      { type: "improved", text: "When a clip fails to generate, you now see the actual reason instead of a generic error" },
    ],
  },
  {
    version: "v0.8.11",
    date: "2026-04-21",
    title: "Clip Generation Fix",
    items: [
      { type: "fix", text: "Clip generation now reliably completes. Fixed a timeout issue that caused clips to silently fail on cold starts" },
    ],
  },
  {
    version: "v0.8.10",
    date: "2026-04-18",
    title: "Streaks, Rivals Polish & Animated Wrapped",
    items: [
      { type: "new", text: "Analysis streak badge: your consecutive-stream streak is now front and center on the VODs page" },
      { type: "new", text: "Head-to-head record: rival card now shows your wins, losses, and ties across your last 5 streams" },
      { type: "new", text: "Weekly challenge streak: see how many weeks in a row you've hit your target" },
      { type: "improved", text: "Rivals now auto-link when your rival joins LevlCast. No need to re-add them" },
      { type: "improved", text: "Monthly Wrapped average score animates up from zero when you open it" },
      { type: "improved", text: "Weekly challenge resets cleanly on Monday with clearer 'this week' wording" },
      { type: "fix", text: "Can no longer set yourself as your own rival" },
      { type: "fix", text: "Rival card now refreshes right after you pick someone, even if their data is still coming in" },
    ],
  },
  {
    version: "v0.8.9",
    date: "2026-04-18",
    title: "Rivals, Wrapped & Challenges",
    items: [
      { type: "new", text: "Rival system: pick any LevlCast streamer as your rival and track your score vs theirs after every stream" },
      { type: "new", text: "Monthly Wrapped: your full month in review: average score, best stream, best clip moment, score arc, and shareable card" },
      { type: "new", text: "Weekly challenge: a new score target every week shown on your VODs page" },
      { type: "new", text: "Next stream target: a personalized score to beat displayed before every stream" },
      { type: "new", text: "Streak protection push: get notified on mobile when your analysis streak is at risk" },
    ],
  },
  {
    version: "v0.8.7",
    date: "2026-04-18",
    title: "Score Reveal + Titles",
    items: [
      { type: "new", text: "Your stream score now counts up from zero when you open a report. The arc and color animate live as the number rises" },
      { type: "new", text: "Personal best detection: a gold badge flashes when you beat your all-time high score" },
      { type: "new", text: "Streamer title earned from your last 5 stream average: Fresh Streamer, Rising Talent, Consistent Creator, Crowd Favorite, Elite Entertainer, or LevlCast Legend" },
    ],
  },
  {
    version: "v0.8.6",
    date: "2026-04-18",
    title: "Stream Report Emails",
    items: [
      { type: "new", text: "Get an email when your stream report is ready: includes your score and top coaching recommendation with a direct link back to the full report" },
    ],
  },
  {
    version: "v0.8.5",
    date: "2026-04-17",
    title: "No Fake Quotes",
    items: [
      { type: "improved", text: "Clip titles and captions no longer invent dialogue. If the AI isn't certain what you said, it describes the moment instead of quoting you" },
      { type: "improved", text: "Stricter no-quote rules across every clip field so your posts never put the wrong words in your mouth" },
    ],
  },
  {
    version: "v0.8.4",
    date: "2026-04-17",
    title: "Dashboard & VODs Redesign",
    items: [
      { type: "improved", text: "Home dashboard now opens with a big Latest Stream hero: your score, trend, and next action all in one card" },
      { type: "improved", text: "Recent streams list got progress bars and bigger score readouts so you can scan your history in seconds" },
      { type: "improved", text: "Onboarding checklist redesigned as a featured violet card: clear, glowing, and impossible to miss" },
      { type: "improved", text: "VODs page now starts with a clean status strip (total / analyzed / processing) and a Start Here spotlight for your first analysis" },
      { type: "improved", text: "VOD rows show thumbnails with a score badge, a progress bar, and a status accent stripe, one layout that works on every screen size" },
    ],
  },
  {
    version: "v0.8.3",
    date: "2026-04-17",
    title: "Analytics & Growth Redesign",
    items: [
      { type: "improved", text: "Analytics page now opens with a full Performance Pulse: your average coach score, trend, and streak all at a glance" },
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
      { type: "improved", text: "Welcome screen now sends you straight to your VODs. No dead ends after sign up" },
      { type: "new",      text: "After your first analysis, a banner shows exactly how many clip moments are ready and takes you straight there" },
      { type: "new",      text: "If you sign up but don't analyze a stream within 24 hours, LevlCast emails you a reminder" },
    ],
  },
  {
    version: "v0.8.1",
    date: "2026-04-16",
    title: "Clip Accuracy Overhaul",
    items: [
      { type: "improved", text: "Clips now match their descriptions much more accurately. Timestamps are snapped to real speech boundaries with strict drift limits" },
      { type: "improved", text: "Long streams (2+ hours) no longer miss great moments that happen on chunk boundaries" },
      { type: "improved", text: "Stricter clip selection: fewer mediocre clips, only moments that actually stop someone scrolling" },
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
      { type: "improved", text: "Landing page now leads with what the coach actually does: specific fixes for dead air, slow openings, and the habits you can't see while you're live" },
      { type: "improved", text: "Gaming VODs are now correctly classified even when the transcript is quiet (game audio is stripped by speaker filtering). The coach reads the stream title to know what you're actually playing" },
      { type: "new",      text: "Sharper positioning: real coaching on your actual stream, so every session makes you sharper than the last" },
      { type: "new",      text: "Twitch Panel: download a 'Coached by LevlCast' panel to put under your Twitch stream. Takes 30 seconds and shows your viewers you take growth seriously" },
    ],
  },
  {
    version: "v0.7",
    date: "2026-04-12",
    title: "The Visibility Patch",
    items: [
      { type: "improved", text: "Streamer Health (burnout score) now lives in the sidebar, always visible alongside your stats, not buried at the bottom" },
      { type: "improved", text: "Coach report now shows a prominent retention alert when drop-off risk is medium or high. Easy to see before digging into the breakdown" },
      { type: "improved", text: "VOD detail page now shows a 'clips ready' nudge after generating clips, pointing you straight to the Clips page to post them" },
    ],
  },
  {
    version: "v0.6",
    date: "2026-04-11",
    title: "The Planner + Flow Patch",
    items: [
      { type: "new",      text: "Title Generator: select what you're streaming and get 3 title ideas per content type, each with a short explanation of why it works" },
      { type: "new",      text: "Silence Gap detector: your coach report now highlights the longest quiet stretches in your stream so you know where energy dropped off" },
      { type: "new",      text: "Cold Open score: each report now rates how strong your first 5 minutes were: Strong, Slow Start, or Cold Open" },
      { type: "improved", text: "Analytics top section redesigned: stream score, best stream, hottest moment, best content type, and sweet spot length are now front and center" },
      { type: "improved", text: "Navigation is now grouped into Create, Grow, and Account. Easier to know where you are and what to do next" },
      { type: "improved", text: "Clips page now nudges you to connect YouTube or TikTok if you haven't yet, so you can actually post what you've generated" },
      { type: "fix",      text: "Clip cards were showing the same caption text twice. Now shown once" },
    ],
  },
  {
    version: "v0.5",
    date: "2026-04-10",
    title: "The Coaching Patch",
    items: [
      { type: "improved", text: "Coach feedback now references specific moments from your stream. No more advice that could apply to any streamer" },
      { type: "improved", text: "Game audio and background sounds are filtered out before your stream is analyzed. Feedback is based only on what you actually said" },
      { type: "fix",      text: "Removed filler sections from the coach report that weren't adding useful information" },
      { type: "fix",      text: "Coach report layout fixed on mobile. Sections no longer squeeze into an unreadable two-column grid" },
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
      { type: "improved", text: "Subscription status is clearer throughout the app. You always know what plan you're on and when it changes" },
    ],
  },
  {
    version: "v0.3",
    date: "2026-04-06",
    title: "The Debrief Patch",
    items: [
      { type: "new",      text: "Quick Listen: tap to hear your full coaching report read aloud, useful when you don't want to read" },
      { type: "new",      text: "Score badge now shows how much you went up or down from your last stream" },
      { type: "improved", text: "Coaching style now adapts to your stream type: gaming, just chatting, IRL, variety, and educational each get different feedback" },
      { type: "improved", text: "Clip selection quality improved across the board" },
      { type: "improved", text: "Energy tracking now shows how your talking pace changed across the stream" },
    ],
  },
  {
    version: "v0.2",
    date: "2026-04-05",
    title: "The Mobile Patch",
    items: [
      { type: "new",      text: "iOS app: analyze VODs, generate clips, and view your coach report from your phone" },
      { type: "new",      text: "Live progress updates while your stream is being analyzed on mobile" },
      { type: "improved", text: "Clip start and end points are more accurate. Clips no longer cut off mid-sentence" },
    ],
  },
  {
    version: "v0.1",
    date: "2026-03-30",
    title: "Launch",
    items: [
      { type: "new", text: "VOD analysis: AI watches your stream, finds your peak moments, and scores your performance out of 100" },
      { type: "new", text: "Clip generation: your best moments cut into short-form video, ready to post" },
      { type: "new", text: "YouTube posting directly from your clip library" },
      { type: "new", text: "Pro subscription: 20 analyses and 20 clips per month" },
    ],
  },
];

/** The date of the most recent entry — used for the sidebar New badge. */
export const LATEST_CHANGELOG_DATE = changelog[0].date;
