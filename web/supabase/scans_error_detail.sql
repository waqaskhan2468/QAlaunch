-- Adds the technical failure reason to public.scans.
--
-- scans.error_message holds the sanitised, user-facing sentence shown on the
-- results page ("This page took too long to analyze"). That is right for
-- visitors but useless for debugging, and one common path overwrote it with a
-- flat "All pages failed to scan." — so the real cause only ever existed in
-- the Vercel logs and was impossible to review after the fact.
--
-- error_detail keeps the raw message (plus its error causes), so the admin
-- console can show why a scan actually failed. Never rendered to visitors.
--
-- REQUIRED BEFORE DEPLOY: the scan pipeline writes this column on failure.
-- Idempotent: safe to run more than once.

alter table public.scans
	add column if not exists error_detail text;
