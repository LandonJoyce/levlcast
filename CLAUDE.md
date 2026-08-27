# LevlCast — Claude Context

> **Last refreshed: 2026-05-17.** Anything in here is point-in-time. If a fact conflicts with the actual code (`limits.ts`, the `CoachReport` interface, the Inngest functions list, etc.), trust the code and update this file. Don't quote me line-and-file without checking first.

## What This Project Is
AI-powered Twitch stream analysis platform. Transcribes VODs, finds the best clip moments, generates short-form clips, and provides personalized coaching reports. Also handles multi-platform posting (YouTube Shorts, TikTok planned) and growth tools.

## Monorepo Structure
```
levlcast/
├── app/        # Next.js 15 web app (main product) — lives at app/src/
├── mobile/     # Expo / React Native mobile app
└── upload/     # Static marketing site (Cloudflare Pages — legacy, main landing lives in app/)
```

## Tech Stack

### Web App (`app/src/`)
- **Framework**: Next.js 15 App Router, React 19, TypeScript
- **Styling**: TailwindCSS
- **Database**: Supabase (PostgreSQL + RLS)
- **Storage**: Cloudflare R2 (clip video files via `lib/r2.ts`)
- **Auth**: Supabase Auth with Twitch OAuth
- **AI**: Anthropic Claude — `claude-sonnet-4-6` for all features (peak detection, coach reports, outreach drafting). Title Generator was removed.
- **Transcription**: Deepgram nova-3, utterance-based, with speaker diarization (`diarize: true`) — dominant-speaker filter strips game audio/music before AI analysis
- **Video**: FFmpeg for clip cutting (ffmpeg-static local, Linux binary downloaded to /tmp on Vercel)
- **Background Jobs**: Inngest. Live functions: `analyzeVod`, `generateClip`, `cleanupStuckVods`, `cleanupStuckClips`, `cleanupOrphanedR2Objects`, `computeBurnoutScores`, `computeContentReports`, `computeCollabSuggestions`, `compileWeeklyDigest`, `sendStreakNudge`, `sendActivationNudge`, `autoSyncTwitchVods` (12 total — list maintained in `lib/inngest/functions.ts` doc header)
- **Subscriptions**: Stripe for web (`lib/stripe.ts`, `/api/stripe/{checkout,portal,webhook}`) + RevenueCat for iOS IAP. PayPal was removed in 2026-04-29 — do not reintroduce it as a "fallback".
- **Social**: YouTube OAuth + upload (`lib/youtube.ts`); TikTok planned (`lib/tiktok.ts`)
- **Email — transactional**: Resend (`lib/email.ts`) for welcome, VOD-ready, clip-ready, new-VOD-detected, activation nudge, weekly digest
- **Email — outbound human (Send As)**: Gmail "Send As" for `Landon@LevlCast.com` configured over Resend SMTP (see `project_email_send_infra` memory). Use this for outreach, not for transactional.
- **Rate limiting**: in-memory limiter in `lib/rate-limit.ts` (Upstash migration planned when Pro users grow)
- **Push Notifications**: `lib/push.ts`

### Mobile App (`mobile/`)
- **Framework**: Expo 55, React Native 0.83, Expo Router (file-based routing)
- **Auth Storage**: Expo SecureStore (encrypted tokens)
- **Subscriptions**: RevenueCat (IAP)
- **Shares same Supabase backend as web app**

## Database Tables
`profiles`, `vods`, `clips`, `social_posts`, `social_connections`, `post_analytics`, `stream_analytics`, `subscriptions`, `usage_logs`, `jobs`, `follower_snapshots`, `trial_records` (bypass-proof free-trial counter, keyed by twitch_id), `feedback` (user-submitted bug reports / requests).
- All tables have Row Level Security — users only access their own data
- Never bypass RLS or use service role key on the client side
- Admin/Inngest functions use `createAdminClient()` from `lib/supabase/server.ts`

## Business Logic

### Subscription Tiers
Authoritative numbers live in `lib/limits.ts` — those override anything here.
- **Free trial (lifetime, bypass-proof)**: 3 VOD analyses + 5 clips ever. Counters live in `trial_records` keyed by `twitch_id` so deleting + recreating a Supabase account with the same Twitch login does NOT reset.
- **Pro**: 15 VOD analyses/month + 20 clips/month — $9.99/mo founding price ($14.99 next tier, $99/year annual via `STRIPE_PRO_ANNUAL_PRICE_ID`)
- **Founding members (grandfathered)**: 20/20 — `profiles.founding_member = true`. Anyone who subscribed before the Pro cap dropped from 20→15.
- Plan stored on `profiles.plan` + `profiles.subscription_expires_at` + `profiles.founding_member`
- Lapsed Pro subscriptions auto-downgrade to Free in `lib/limits.ts` `getUserUsage()`
- In-progress VODs (`status = transcribing | analyzing`) count toward quota to prevent race conditions
- Free trial increments via admin-only `incrementTrialAnalysis()` / `incrementTrialClip()` — never call from client code

### VOD Analysis Pipeline
1. Sync VODs from Twitch Helix API (`lib/twitch.ts`)
2. Stream audio directly from Twitch M3U8 → Deepgram (no disk writes)
3. Speaker diarization filters to dominant speaker only (strips game NPCs, music, co-streamers)
4. Detect clip moments with Claude Sonnet — max 6 per VOD, categories: hype/funny/educational/emotional
5. Generate coach report with Claude Sonnet — score 0-100, strengths, improvements, streamer_type, energy_trend
6. Status flow: `pending → transcribing → analyzing → ready` (atomic updates prevent race conditions)
7. Long VODs (>25 min) split into 20-minute chunks, re-ranked in a final pass

### Clip Generation
- Re-downloads VOD segments in parallel (concurrency 5, 1 retry per segment), cuts with FFmpeg, uploads to Cloudflare R2
- Clips 30-90 seconds, expanded ±3-5s from moment boundaries
- FFmpeg handles both local (ffmpeg-static) and Vercel (Linux binary to /tmp)
- Aborts with a clear error if >20% of Twitch segments fail to download
- Inngest function timeout: 15m. Stuck-clip cleanup cron marks anything processing >20m as failed

### Coach Report Fields
Authoritative shape lives in the `CoachReport` interface in `lib/analyze.ts`. Current fields (as of 2026-05-17):
- Core: `overall_score`, `streamer_type`, `energy_trend`, `viewer_retention_risk`, `strengths[]`, `improvements[]`, `recommendation`
- Structural: `stream_story`, `community_note`, `punch_line`, `best_moment`, `missed_clip`
- Sub-scores: `score_breakdown { energy, engagement, consistency, content }`
- Section quality: `cold_open { score, note }`, `closing { score, note }`
- Detected patterns: `anti_patterns[]` (with verbatim quote — only field where quoting is allowed), `momentum_crash`
- Dead air signal: `dead_zones[]` (worst 5 gaps only), `dead_air_seconds` (total), `dead_air_pct`
- Sharing/marketing: `shareable_win { stat, context }`
- Coaching loop: `rewatch_moments[]`, `trend_vs_history` (longitudinal, only when prior reports exist)
- Computed: `commentary_density` (WPM when actively speaking)
- Legacy/historical only: `next_stream_goals[]` — present on older reports, no longer generated. Don't add it to new code paths.
- Removed permanently: `stream_summary`, `content_mix`
- Tone defenses: see [[feedback_coach_psychology]] memory. The TONE section in the analyze.ts prompt is the canonical rule; reports must lead with strengths and frame fixes as opportunities. `stripEmDashes()` runs on every parsed report.

### Clip Data Note
- No `duration_seconds` insert on clips (it's a GENERATED column in the `clips` table)

## Web Routes

### Marketing (public, indexed)
- `/` — main landing page
- `/twitch-vod-analyzer` — SEO landing for VOD analyzer keyword
- `/twitch-clip-generator` — SEO landing for clip generator keyword
- `/twitch-stream-coach` — SEO landing for coaching keyword
- `/how-to-grow-on-twitch` — long-form SEO article
- `/changelog` — patch notes (data in `lib/changelog.ts`)
- `/share/[token]` — public coach-report share pages
- `/terms`, `/privacy` — legal
- `/auth/login` — Twitch OAuth entry

### Dashboard (auth-gated via middleware)
- `/dashboard` — home: stats overview, streamer-health card, collab matches, onboarding hero for empty state
- `/dashboard/vods` — VOD list, sync, analyze. Empty state has the "Start Here" spotlight
- `/dashboard/vods/[id]` — VOD overview + clips for that stream
- `/dashboard/vods/[id]/report` — full coach report card (heroes the score, recommendation, strengths/improvements, anti-patterns, etc.)
- `/dashboard/clips` — generated clips + ungenerated moments
- `/dashboard/clips/[id]/edit` — clip editor (trim, caption style, hook frame, 9:16 export, post-to-YouTube)
- `/dashboard/connections` — YouTube + TikTok OAuth
- `/dashboard/settings` — subscription, account, delete account

### Admin-only routes (gated by `email === "landonjoyce@hotmail.com"` check inside the route)
- `/dashboard/outreach` — Reddit outreach lead finder (uses `/api/outreach/leads` + `/api/outreach/message`)
- `/dashboard/admin/feedback` — inbound user feedback inbox

Previously removed and not coming back: `/dashboard/analytics`, `/dashboard/grow`, `/dashboard/planner`, the Title Generator and Stream Planner pages. Their insights consolidated into `/dashboard` home and the coach report.

## Key Files
- `app/src/lib/analyze.ts` — peak detection + coaching prompts (Claude Sonnet) + TONE section + `detectStreamStartOffset` BRB trim + `stripEmDashes` post-processor + `verifyAntiPatternQuotes`
- `app/src/lib/limits.ts` — Free/Pro/Founding quota enforcement, lapsed-subscription auto-downgrade
- `app/src/lib/twitch.ts` — Twitch Helix API + VOD audio/video streaming (parallel segment downloader), `mapVodToRow`, `parseTwitchDuration`, `refreshTwitchToken`
- `app/src/lib/deepgram.ts` — Transcription + speaker diarization, chunked transcription for long VODs
- `app/src/lib/ffmpeg.ts` — Clip cutting with PTS-reset filter + caption burning
- `app/src/lib/captions.ts` — Word-synced caption styles (7 styles)
- `app/src/lib/r2.ts` — Cloudflare R2 clip storage
- `app/src/lib/youtube.ts` — YouTube OAuth + upload
- `app/src/lib/tiktok.ts` — TikTok (planned)
- `app/src/lib/burnout.ts` — Burnout score detection
- `app/src/lib/monetization.ts` — Monetization/content report
- `app/src/lib/collab.ts` — Collab matching
- `app/src/lib/ad-optimizer.ts` — Pro feature: ad revenue vs viewer-loss analysis
- `app/src/lib/chat-pulse.ts` — Twitch chat correlation: bucket chat messages by timestamp + format for AI prompt
- `app/src/lib/game-keywords.ts` — Per-game keyterm boost for Deepgram + game detection from VOD title
- `app/src/lib/coaching-arc.ts` — Longitudinal "recurring improvements" tracking across reports
- `app/src/lib/report-delta.ts` — Score-delta math between this stream and prior streams
- `app/src/lib/score-utils.ts` — `scoreColorHex`, `rankFor`, etc. for UI rendering
- `app/src/lib/stripe.ts` — Stripe SDK init + helpers
- `app/src/lib/email.ts` — Resend transactional emails (welcome, VOD-ready, clip-ready, new-VOD, activation nudge, weekly digest)
- `app/src/lib/push.ts` — Mobile push (Expo)
- `app/src/lib/web-push.ts` — Browser web-push notifications
- `app/src/lib/rate-limit.ts` — In-memory rate limiter (migrate to Upstash later — see [[project_rate_limiter_techdebt]])
- `app/src/lib/retry.ts` — Retry wrapper for flaky external calls
- `app/src/lib/changelog.ts` — Patch notes data (rendered at `/changelog`)
- `app/src/lib/inngest/functions.ts` — Background job definitions (12 functions, see Tech Stack > Background Jobs)
- `app/src/middleware.ts` — Auth guard for /dashboard routes
- `app/src/components/Footer.tsx` — Shared marketing footer with cross-links to SEO pages
- `app/src/components/NavBar.tsx` — Top nav for landing + SEO pages
- `mobile/lib/supabase.ts` — Supabase client with SecureStore adapter
- `mobile/lib/revenuecat.ts` — IAP integration

## Product Decisions (DO NOT REVISIT WITHOUT USER DIRECTION)
- **No "peak" in user-facing copy** — use "clip moment", "moment", "clip" instead. "Peak" is internal only.
- **Display "funny" category as "Comedy"** — in all UI surfaces.
- **Sonnet for all Pro AI features** — coaching, peak detection all use `claude-sonnet-4-6`. Haiku only for cheap preprocessing.
- **No schedule recommendations** — we don't have viewer count or revenue data. Coaching score ≠ audience size. Don't pretend we know when to stream.
- **No chatbot UI anywhere** — inputs → generated output only. No back-and-forth interfaces.
- **Title Generator + Stream Planner both removed** — scheduling was dropped, title generation also got removed once the coach report was the focus. Don't re-add either.
- **Free users can try core features** — 3 analyses + 5 clips LIFETIME (not monthly). They hit the wall naturally, not before seeing value. Lifetime cap is bypass-proof per twitch_id (see Subscription Tiers).
- **Speaker diarization is always on** — `diarize: true` on all Deepgram calls. Dominant speaker filter runs before every Claude call.
- **Coach report is the core value** — clips are the marketing hook. Lead copy with coaching.
- **Never fabricate quotes in coach reports** — timestamps only. Wrong specifics destroy trust in the whole report.
- **Never build botting features** — Twitch botting market is rampant, we position as the honest-growth tool.
- **No stock icons in UI** — only nice custom ones, otherwise strip them.
- **Coach report tone is the conversion lever** — reports must make streamers feel supported, not judged. Lead with strengths, frame fixes as opportunities, never brand the streamer as the problem. See [[feedback_coach_psychology]] memory and the TONE section in `analyze.ts`. Banned framings: "you played it safe," "your stream is cooked," "safe doesn't get clipped," any character-blaming. Banned labels: "Playing It Safe," "Chat Wallpaper," "Audience Cold," "Flat Delivery," "Wasted Downtime."
- **Pre-stream BRB trim is active** — `detectStreamStartOffset()` in `analyze.ts` finds the first sustained-speech block and trims any earlier content from both peak detection and coach report. Streamers playing a clip reel during "Starting Soon" won't be scored on it. Don't break this when refactoring the analyze pipeline.
- **Landing CTA is paste-a-VOD-URL, not "Sign Up"** — hero on `/` is `UrlPasteHero`. After Twitch OAuth, the pasted URL is queued via `/api/twitch/vods/analyze-by-url` (counts toward 1/3 free quota, NOT a bypass route). Don't replace the URL paste with a generic signup button.
- **Share is the highest-leverage growth lever** — every report gets a Share button (`ShareReportButton`) and first-finished report gets `FirstScoreCelebration` modal with prominent Share to X. Tweet text is dynamic based on score tier + pulls the report's recommendation. Don't downgrade this to a static "Share" link.

## Conventions
- No emojis in AI-generated content (explicitly instructed in all Claude prompts)
- No emojis in UI unless user explicitly requests
- **No em dashes anywhere — ever.** Not in UI copy, not in AI-generated coach reports, not in clip titles or captions. The `stripEmDashes()` function in `lib/analyze.ts` enforces this at parse time on all AI output. Any new AI output pipeline must call it before storing or displaying results.
- Server-side Supabase uses service role only in API routes, never exposed to client
- Client-side uses anon key with RLS
- API routes in `app/src/app/api/` follow Next.js App Router conventions
- Always push after changes — every commit triggers Vercel deploy
- After editing a file, check dependent components/imports still compile
- Update `app/src/lib/changelog.ts` for significant feature commits (even though it's not linked in nav)
- Landing page file is `app/src/app/page.tsx` (Vercel), NOT `upload/index.html`

## Deployment
- **Web**: Vercel (auto-deploys on push to main)
- **Mobile**: EAS Build → iOS App Store (live at v1.0.3) + Google Play (planned)
- **Marketing**: main landing on Vercel; `upload/` legacy site on Cloudflare Pages
- **DB**: Supabase Cloud (project `ntquvgpzztyaikstblzc`)
- **Clip Storage**: Cloudflare R2 (bucket `levlcast-clips`)
- **DNS + email inbound**: Cloudflare. SPF locked 2026-04-15; updated 2026-05-17 to combine Google + Cloudflare SPF includes. Cloudflare Email Routing forwards `*@levlcast.com` → `mototoka14@gmail.com`.
- **Email outbound — transactional**: Resend (root domain DKIM signed)
- **Email outbound — human Send As**: Gmail "Send As" via Resend SMTP for `Landon@LevlCast.com`. DMARC is `p=reject` and works because Resend signs DKIM with `d=levlcast.com` (aligned). DO NOT switch this back to Gmail SMTP — that breaks DMARC alignment.

## App Store Status
- **iOS: LIVE** on the App Store at v1.0.3 (build 38) — approved 2026-05-12
- Originally approved at v1.0.2 on 2026-04-16
- Demo account for Apple review: `levlcast8@gmail.com` / `LevlCast123` / Twitch `levlcasttest` — must stay on Pro so all features are testable
- Android: not yet submitted
- Mobile login fix shipped 2026-05-16 (`/api/auth/mobile-link` stores Twitch tokens after `exchangeCodeForSession`) requires a new EAS build to roll out — existing iOS users won't call the endpoint until they update past v1.0.3
