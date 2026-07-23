-- Adds the optional per-issue evidence bounding box to public.issues.
--
-- Claude already emits a bounding_box per visual issue ({target: desktop|mobile,
-- x, y, width, height} in the screenshot's pixel space) — it was previously kept
-- only inside scan_pages.ai_analysis JSON. It is now persisted per issue row and
-- rendered on the results page as a highlight overlay on the screenshot, so the
-- free preview can show visual proof of each finding.
--
-- The shape is validated app-side (Zod claudeBoundingBoxSchema); the column is
-- plain jsonb with no constraint. Historical rows stay NULL.
--
-- REQUIRED BEFORE DEPLOY: the issue-persist step writes this column on every
-- scan — run this file against the database BEFORE deploying the code change,
-- or issue inserts will fail and scans will error.
--
-- Idempotent: safe to run more than once.

alter table public.issues
	add column if not exists bounding_box jsonb;
