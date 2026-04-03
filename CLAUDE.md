# LevlCast — Claude Context

## What This Project Is
AI-powered Twitch stream analysis platform. Automatically finds peak moments in VODs, generates short-form clips, and provides coaching feedback to help streamers grow. Also handles multi-platform posting (YouTube live, TikTok/Instagram planned).

## Monorepo Structure
```
levlcast/
├── src/        # Next.js 15 web app source (main product)
├── mobile/     # Expo / React Native mobile app
└── upload/     # Static marketing site (Cloudflare Pages)
```

## Tech Stack

### Web App (`src/`)
- **Framework**: Next.js 15 App Router, React 19, TypeScript
- **Styling**: TailwindCSS, Framer Motion
- **Database**: Supabase (PostgreSQL + RLS + Storage)
- **Auth**: Supabase Auth with Twitch OAuth
- **AI**: Anthropic Claude (haiku-4.5) for peak detection + coaching reports
- **Transcription**: Deepgram (nova-3, utterance-based)
- **Video**: FFmpeg for clip cutting (ffmpeg-static local, remote binary on Vercel)
- **Background Jobs**: Inngest
- **Subscriptions**: RevenueCat (primary) + PayPal webhooks (fallback)
- **Social**: YouTube OAuth + upload; TikTok/Instagram planned

### Mobile App (`mobile/`)
- **Framework**: Expo 55, React Native 0.83, Expo Router (file-based routing)
- **Auth Storage**: Expo SecureStore (encrypted tokens)
- **Subscriptions**: RevenueCat (IAP)
- **Shares same Supabase backend as web app**

## Database Tables
`profiles`, `vods`, `clips`, `posts`, `post_analytics`, `stream_analytics`, `subscriptions`, `usage_logs`, `jobs`, `follower_snapshots`
- All tables have Row Level Security — users only access their own data
- Never bypass RLS or use service role key on the client side

## Business Logic

### Subscription Tiers
- **Free**: 1 VOD analysis/month, 5 clips lifetime
- **Pro**: Unlimited analyses and clips
- Usage tracked in `usage_logs` table (keyed by `user_id` + `month` e.g. `'2026-03'`)
- Analysis quota checked via `analyzed_at` timestamp on VODs (not usage_logs)
- Clip quota checked via total rows in clips table for that user

### VOD Analysis Pipeline
1. Sync VODs from Twitch Helix API
2. Download audio (M3U8 → .ts segments → concatenate)
3. Transcribe with Deepgram
4. Detect peaks with Claude (max 5 peaks, categories: hype/funny/educational/emotional)
5. Generate coach report with Claude (score 0-100, strengths, improvements, recommendations)
6. Status flow: `pending → transcribing → analyzing → ready` (atomic updates to prevent race conditions)

### Clip Generation
- Re-downloads VOD audio, cuts with FFmpeg, uploads to Supabase Storage (public bucket)
- Clips are 30-90 seconds, peaks expanded ±3-5s for context
- FFmpeg handles both local (ffmpeg-static) and Vercel (Linux binary download)

## Key Files
- `src/lib/analyze.ts` — Claude peak detection + coaching prompts
- `src/lib/limits.ts` — Free/Pro quota enforcement
- `src/lib/twitch.ts` — Twitch Helix API + VOD download
- `src/lib/deepgram.ts` — Transcription
- `src/lib/ffmpeg.ts` — Clip cutting
- `src/lib/youtube.ts` — YouTube OAuth + upload
- `src/middleware.ts` — Auth guard for /dashboard routes
- `mobile/lib/supabase.ts` — Supabase client with SecureStore adapter
- `mobile/lib/revenuecat.ts` — IAP integration

## Conventions
- No emojis in AI-generated content (explicitly instructed in Claude prompts)
- Server-side Supabase uses service role only in API routes, never exposed to client
- Client-side uses anon key with RLS
- API routes in `src/app/api/` follow Next.js App Router conventions

## Deployment
- **Web**: Vercel
- **Mobile**: EAS Build → iOS App Store + Google Play
- **Marketing**: Cloudflare Pages (`upload/`)
- **DB/Storage**: Supabase Cloud

## App Store Status (as of 2026-03-29)
- iOS app submitted to Apple App Store, awaiting review
- Previously rejected once (reason TBD)
- Apple reviewers need a way to log in — Twitch OAuth may be a friction point during review
