# LevlCast — Claude Context

## What This Project Is
AI-powered Twitch stream analysis platform. Transcribes VODs, finds the best clip moments, generates short-form clips, and provides personalized coaching reports. Also handles multi-platform posting (YouTube live, TikTok planned) and growth tools.

## Monorepo Structure
```
levlcast/
├── app/        # Next.js 15 web app (main product) — lives at app/src/
├── mobile/     # Expo / React Native mobile app
└── upload/     # Static marketing site (Cloudflare Pages)
```

## Tech Stack

### Web App (`app/src/`)
- **Framework**: Next.js 15 App Router, React 19, TypeScript
- **Styling**: TailwindCSS
- **Database**: Supabase (PostgreSQL + RLS)
- **Storage**: Cloudflare R2 (clip video files via `lib/r2.ts`)
- **Auth**: Supabase Auth with Twitch OAuth
- **AI**: Anthropic Claude — `claude-sonnet-4-6` for all features (peak detection, coaching, title generator, planner)
- **Transcription**: Deepgram nova-3, utterance-based, with speaker diarization (`diarize: true`) — dominant speaker filtering strips game audio/music before AI analysis
- **Video**: FFmpeg for clip cutting (ffmpeg-static local, Linux binary on Vercel)
- **Background Jobs**: Inngest (analyzeVod, generateClip, cleanupStuckVods, cleanupStuckClips, computeBurnoutScores)
- **Subscriptions**: RevenueCat (primary) + PayPal webhooks (fallback)
- **Social**: YouTube OAuth + upload (`lib/youtube.ts`); TikTok planned (`lib/tiktok.ts`)
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
- **Pro**: 20 VOD analyses/month, 20 clips/month
- Plan stored on `profiles.plan` + `profiles.subscription_expires_at`
- Lapsed Pro subscriptions auto-downgrade to Free in `lib/limits.ts`
- Usage tracked in `usage_logs` table (keyed by `user_id` + `month` e.g. `'2026-03'`)
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
- Re-downloads VOD segment, cuts with FFmpeg, uploads to Cloudflare R2
- Clips 30-90 seconds, expanded ±3-5s from moment boundaries
- FFmpeg handles both local (ffmpeg-static) and Vercel (Linux binary download)

### Coach Report Fields
`overall_score`, `streamer_type`, `energy_trend`, `viewer_retention_risk`, `strengths[]`, `improvements[]`, `best_moment`, `recommendation`, `next_stream_goals[]`
- No `stream_summary` or `content_mix` fields — these were removed

## Dashboard Pages
- `/dashboard` — home, stats overview
- `/dashboard/vods` — VOD list, sync, analyze. Shows "Start Here" spotlight when no streams analyzed yet
- `/dashboard/vods/[id]` — individual coach report
- `/dashboard/clips` — generated clips + ungenerated moments
- `/dashboard/analytics` — score trend, stream insights (best stream, hottest moment, content comparison, sweet spot length), follower trend
- `/dashboard/grow` — archetype card (streamer type × dominant category = 20 archetypes), tactics carousel, consistency grid
- `/dashboard/planner` — Title Generator (Pro only): Claude Haiku derives content categories from VOD titles, Claude Sonnet generates 3 title options per selection
- `/dashboard/connections` — YouTube/TikTok OAuth
- `/dashboard/settings` — subscription, account

## Key Files
- `app/src/lib/analyze.ts` — peak detection + coaching prompts (Claude Sonnet)
- `app/src/lib/limits.ts` — Free/Pro quota enforcement
- `app/src/lib/twitch.ts` — Twitch Helix API + VOD audio streaming
- `app/src/lib/deepgram.ts` — Transcription + speaker diarization
- `app/src/lib/ffmpeg.ts` — Clip cutting
- `app/src/lib/r2.ts` — Cloudflare R2 clip storage
- `app/src/lib/youtube.ts` — YouTube OAuth + upload
- `app/src/lib/tiktok.ts` — TikTok (planned)
- `app/src/lib/burnout.ts` — Burnout score detection
- `app/src/lib/monetization.ts` — Monetization/content report
- `app/src/lib/collab.ts` — Collab matching
- `app/src/lib/changelog.ts` — Patch notes data (built, not linked in nav yet)
- `app/src/middleware.ts` — Auth guard for /dashboard routes
- `mobile/lib/supabase.ts` — Supabase client with SecureStore adapter
- `mobile/lib/revenuecat.ts` — IAP integration

## Product Decisions (DO NOT REVISIT WITHOUT USER DIRECTION)
- **No "peak" in user-facing copy** — use "clip moment", "moment", "clip" instead. "Peak" is internal only.
- **Sonnet for all Pro AI features** — Title Generator, coaching, peak detection all use `claude-sonnet-4-6`. Haiku only for cheap preprocessing (content option grouping).
- **No schedule recommendations** — we don't have viewer count or revenue data. Coaching score ≠ audience size. Don't pretend we know when to stream.
- **No patch notes / changelog in nav** — data file exists (`lib/changelog.ts`) but was pulled from UI as premature for current user base.
- **No chatbot UI anywhere** — inputs → generated output only. No back-and-forth interfaces.
- **Title Generator replaced "Stream Planner"** — scheduling was dropped, title generation is the value.
- **Free users can try core features** — 1 analysis/month, 5 clips. They hit the wall naturally, not before seeing value.
- **Speaker diarization is always on** — `diarize: true` on all Deepgram calls. Dominant speaker filter runs before every Claude call.

## Conventions
- No emojis in AI-generated content (explicitly instructed in all Claude prompts)
- No emojis in UI unless user explicitly requests
- Server-side Supabase uses service role only in API routes, never exposed to client
- Client-side uses anon key with RLS
- API routes in `app/src/app/api/` follow Next.js App Router conventions
- Always push after changes — every commit triggers Vercel deploy
- After editing a file, check dependent components/imports still compile
- Update `app/src/lib/changelog.ts` for significant feature commits (even if not linked in UI)

## Deployment
- **Web**: Vercel (auto-deploys on push to main)
- **Mobile**: EAS Build → iOS App Store + Google Play
- **Marketing**: Cloudflare Pages (`upload/`)
- **DB**: Supabase Cloud
- **Clip Storage**: Cloudflare R2

## App Store Status (as of 2026-04-12)
- iOS app submitted, previously rejected once
- Apple reviewers need Twitch OAuth to work — potential friction point during review
- Status: awaiting review or in review
