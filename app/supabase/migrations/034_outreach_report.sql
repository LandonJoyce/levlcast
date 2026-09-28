-- 034: an outreach DM can carry the person's own free report.
--
-- When a lead's post links their Twitch channel, the harvest runs a free
-- report on their latest stream first and holds the DM (status
-- 'waiting_report') until it's done, then writes the message around what
-- the report found, with a link to it. This is the stream it's waiting on.

alter table public.outreach_contacts add column if not exists report_vod_id text;

create index if not exists outreach_contacts_report_idx
  on public.outreach_contacts (report_vod_id)
  where report_vod_id is not null;
