-- 033: where people drop off between a link and a signup.
--
-- A small first-party record of each step a visitor takes: landing on the
-- free analyzer, starting a preview, the preview finishing (or being
-- refused), pressing "Get my full report", pressing "Continue with
-- Twitch", and the signup itself. `ref` says where they came from; an
-- outreach DM's link carries a short code for the Reddit account it went
-- to, so a reply can be matched to what that person actually did.
--
-- No third-party tracker, no fingerprinting: a random visitor id in a
-- first-party cookie is the whole of it. Written and read only by the
-- server (service role), so RLS is on with no policies.

create table if not exists public.funnel_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor     text not null,
  ref         text,
  event       text not null,
  detail      text
);

create index if not exists funnel_events_created_idx on public.funnel_events (created_at desc);
create index if not exists funnel_events_ref_idx on public.funnel_events (ref) where ref is not null;

alter table public.funnel_events enable row level security;
