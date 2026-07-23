-- Adds Claude's per-issue confidence (0–1) to public.issues.
--
-- Previously confidence lived only inside scan_pages.ai_analysis JSON and was
-- dropped when issues were persisted. It now gates persistence (issues below
-- 0.5 are discarded) and free-preview eligibility (preview slots require
-- >= 0.7), and is stored per issue row for ranking and analytics.
-- Deterministic verified-pattern checks are written with confidence 1.
-- Historical rows stay NULL.
--
-- REQUIRED BEFORE DEPLOY: the issue-persist step writes this column on every
-- scan — run this file against the database BEFORE deploying the code change,
-- or issue inserts will fail and scans will error.
--
-- Idempotent: safe to run more than once.

alter table public.issues
	add column if not exists confidence numeric;

alter table public.issues
	drop constraint if exists issues_confidence_range_check;

alter table public.issues
	add constraint issues_confidence_range_check
	check (confidence is null or (confidence >= 0 and confidence <= 1));
