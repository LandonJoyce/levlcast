-- 023_feedback.sql
-- User-submitted feedback that's only visible to the admin.
--
-- Security model:
--   * RLS is on.
--   * Authenticated users can INSERT a row whose user_id matches auth.uid().
--     This is the ONLY operation regular users can perform.
--   * NO policy permits SELECT/UPDATE/DELETE for regular users, so even a
--     compromised anon-key client cannot read other users' feedback or read
--     their own back. The admin reads via the service role (RLS-bypassing
--     admin client) in /api/admin/feedback.
--   * Server-side validation enforces message length, category whitelist,
--     and rate limits — RLS is the second line of defence.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  category text not null default 'general' check (category in ('failure', 'general', 'feature_request', 'bug')),
  message text not null check (char_length(message) between 1 and 2000),
  context jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_read_idx on public.feedback (read) where read = false;

alter table public.feedback enable row level security;

-- Drop any pre-existing policies so re-running this migration is safe.
drop policy if exists "feedback_insert_self" on public.feedback;

-- Users can only insert feedback attributed to themselves.
create policy "feedback_insert_self"
  on public.feedback
  for insert
  to authenticated
  with check (user_id = auth.uid());
