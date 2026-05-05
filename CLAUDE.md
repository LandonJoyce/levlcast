# LevlCast — Claude Context

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
- **AI**: Anthropic Claude — `claude-sonnet-4-6` for all features (peak detection, coaching, title generator)
- **Transcription**: Deepgram nova-3, utterance-based, with speaker diarization (`diarize: true`) — dominant-speaker filter strips game audio/music before AI analysis
- **Video**: FFmpeg for clip cutting (ffmpeg-static local, Linux binary downloaded to /tmp on Vercel)
- **Background Jobs**: Inngest (`analyzeVod`, `generateClip`, `cleanupStuckVods`, `cleanupStuckClips`, `computeBurnoutScores`)
- **Subscriptions**: RevenueCat (primary) + PayPal webhooks (fallback)
- **Social**: YouTube OAuth + upload (`lib/youtube.ts`); TikTok planned (`lib/tiktok.ts`)
- **Email**: Resend (`lib/email.ts`) for transactional + weekly digest
- **Rate limiting**: in-memory limiter in `lib/rate-limit.ts` (Upstash migration planned when Pro users grow)
- **Push Notifications**: `lib/push.ts`

### Mobile App (`mobile/`)
- **Framework**: Expo 55, React Native 0.83, Expo Router (file-based routing)
- **Auth Storage**: Expo SecureStore (encrypted tokens)
- **Subscriptions**: RevenueCat (IAP)
- **Shares same Supabase backend as web app**

## Database Tables
`profiles`, `vods`, `clips`, `social_posts`, `social_connections`, `post_analytics`, `stream_analytics`, `subscriptions`, `usage_logs`, `jobs`, `follower_snapshots`
- All tables have Row Level Security — users only access their own data
- Never bypass RLS or use service role key on the client side
- Admin/Inngest functions use `createAdminClient()` from `lib/supabase/server.ts`

## Business Logic

### Subscription Tiers
- **Free**: 1 VOD analysis/month, 5 clips/month
- **Pro**: 20 VOD analyses/month, 20 clips/month — $9.99/mo founding price
- Plan stored on `profiles.plan` + `profiles.subscription_expires_at`
- Lapsed Pro subscriptions auto-downgrade to Free in `lib/limits.ts`
- Usage tracked in `usage_logs` (keyed by `user_id` + `month` e.g. `'2026-04'`)
- In-progress VODs count toward quota to prevent race conditions

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
`overall_score`, `streamer_type`, `energy_trend`, `viewer_retention_risk`, `strengths[]`, `improvements[]`, `best_moment`, `recommendation`, `next_stream_goals[]`
- No `stream_summary` or `content_mix` fields — these were removed
- No `duration_seconds` insert on clips (it's a GENERATED column)

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
- `/dashboard` — home, stats overview, streamer-health card, collab matches
- `/dashboard/vods` — VOD list, sync, analyze. Shows "Start Here" spotlight when no streams analyzed yet
- `/dashboard/vods/[id]` — individual coach report
- `/dashboard/clips` — generated clips + ungenerated moments
- `/dashboard/connections` — YouTube/TikTok OAuth
- `/dashboard/settings` — subscription, account

Previously removed and not coming back: `/dashboard/analytics`, `/dashboard/grow`, `/dashboard/planner`. Their insights have been consolidated into `/dashboard` home.

## Key Files
- `app/src/lib/analyze.ts` — peak detection + coaching prompts (Claude Sonnet)
- `app/src/lib/limits.ts` — Free/Pro quota enforcement
- `app/src/lib/twitch.ts` — Twitch Helix API + VOD audio/video streaming (parallel segment downloader)
- `app/src/lib/deepgram.ts` — Transcription + speaker diarization
- `app/src/lib/ffmpeg.ts` — Clip cutting with PTS-reset filter
- `app/src/lib/r2.ts` — Cloudflare R2 clip storage
- `app/src/lib/youtube.ts` — YouTube OAuth + upload
- `app/src/lib/tiktok.ts` — TikTok (planned)
- `app/src/lib/burnout.ts` — Burnout score detection
- `app/src/lib/monetization.ts` — Monetization/content report
- `app/src/lib/collab.ts` — Collab matching
- `app/src/lib/ad-optimizer.ts` — Pro feature: ad revenue vs viewer-loss analysis
- `app/src/lib/email.ts` — Resend transactional + weekly digest
- `app/src/lib/rate-limit.ts` — In-memory rate limiter (migrate to Upstash later)
- `app/src/lib/retry.ts` — Retry wrapper for flaky external calls
- `app/src/lib/changelog.ts` — Patch notes data
- `app/src/lib/inngest/functions.ts` — Background job definitions
- `app/src/middleware.ts` — Auth guard for /dashboard routes
- `app/src/components/Footer.tsx` — Shared marketing footer with cross-links to SEO pages
- `app/src/components/NavBar.tsx` — Top nav for landing + SEO pages
- `mobile/lib/supabase.ts` — Supabase client with SecureStore adapter
- `mobile/lib/revenuecat.ts` — IAP integration

## Product Decisions (DO NOT REVISIT WITHOUT USER DIRECTION)
- **No "peak" in user-facing copy** — use "clip moment", "moment", "clip" instead. "Peak" is internal only.
- **Display "funny" category as "Comedy"** — in all UI surfaces.
- **Sonnet for all Pro AI features** — Title Generator, coaching, peak detection all use `claude-sonnet-4-6`. Haiku only for cheap preprocessing.
- **No schedule recommendations** — we don't have viewer count or revenue data. Coaching score ≠ audience size. Don't pretend we know when to stream.
- **No chatbot UI anywhere** — inputs → generated output only. No back-and-forth interfaces.
- **Title Generator replaced "Stream Planner"** — scheduling was dropped, title generation is the value.
- **Free users can try core features** — 1 analysis/month, 5 clips. They hit the wall naturally, not before seeing value.
- **Speaker diarization is always on** — `diarize: true` on all Deepgram calls. Dominant speaker filter runs before every Claude call.
- **Coach report is the core value** — clips are the marketing hook. Lead copy with coaching.
- **Never fabricate quotes in coach reports** — timestamps only. Wrong specifics destroy trust in the whole report.
- **Never build botting features** — Twitch botting market is rampant, we position as the honest-growth tool.
- **No stock icons in UI** — only nice custom ones, otherwise strip them.

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
- **Mobile**: EAS Build → iOS App Store (live) + Google Play (planned)
- **Marketing**: main landing on Vercel; `upload/` legacy site on Cloudflare Pages
- **DB**: Supabase Cloud
- **Clip Storage**: Cloudflare R2
- **DNS**: Cloudflare (SPF/DMARC locked down 2026-04-15)

## App Store Status
- **iOS: LIVE** on the App Store at v1.0.2 — originally approved 2026-04-16
- Pending mobile 1.0.3 update with subscribe-screen feature list fix and clip-regenerate cleanup (already in main, waiting on next EAS build)
- Demo account for Apple review: `levlcast8@gmail.com` / `LevlCast123` / Twitch `levlcasttest` — must stay on Pro so all features are testable
- Android: not yet submitted
