-- 024_feedback_replies.sql
-- Add admin reply fields to feedback so the admin can respond to a user
-- and the user can see the reply on their dashboard.
--
-- Security:
--   * No SELECT/UPDATE/DELETE RLS policy is added. All user reads/writes
--     go through API routes that use the service-role admin client and
--     verify ownership (user_id = auth.uid()) in code. This is stricter
--     than RLS column gates and lets us control exactly which fields are
--     exposed to the user.

alter table public.feedback
  add column if not exists admin_reply text check (admin_reply is null or char_length(admin_reply) between 1 and 4000),
  add column if not exists admin_reply_at timestamptz,
  add column if not exists user_seen_reply boolean not null default false;

create index if not exists feedback_user_unseen_reply_idx
  on public.feedback (user_id)
  where admin_reply is not null and user_seen_reply = false;
