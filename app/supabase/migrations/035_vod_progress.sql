-- 035: how far along a running analysis is, for the progress bars.
--
-- analyzeVod transcribes a stream in 12-minute parts, four at a time, and
-- after each round of four it records how many parts are done:
--   { "parts_done": 8, "parts_total": 16, "at": "<when that round finished>" }
-- The stream page, the dashboard and the Streams list turn that into a bar
-- (lib/analysis-progress.ts). Until this column exists the pipeline's
-- writes fail quietly and the bars fall back to timing each step.

alter table public.vods add column if not exists progress jsonb;
