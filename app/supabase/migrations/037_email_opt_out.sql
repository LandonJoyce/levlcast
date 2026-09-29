-- 037: Emails about your streams can be turned off.
--
-- Covers the report-ready, new-stream, clip-ready and day-after emails.
-- Receipts, payment problems, collab messages and replies from Landon
-- still go out. Before this there was no way to stop them: the
-- "Unsubscribe" link in the footer opened the account page, which had
-- nothing to switch off.
--
-- The streamer sets it themselves (Account, or the link in an email), so
-- it's not one of the server-owned columns guarded in 036. Until this
-- runs, the app treats everyone as opted in and the switch can't save.

alter table public.profiles
  add column if not exists email_opt_out boolean not null default false;
