-- Tracks the manual follow-up email sent from /admin for a free scan.
--
-- Purpose: after someone runs a free scan we know their site and often their
-- email, so the operator can send one personalised follow-up offering the paid
-- report or a manual QA review. These columns record that it happened, so the
-- admin UI can hide already-contacted scans and never email the same person
-- twice by accident.
--
-- followup_email is stored separately from scans.user_email because the
-- operator may supply an address found on the site when the visitor did not
-- give one during the scan.
--
-- REQUIRED BEFORE DEPLOY: /api/admin/followup writes these columns.
-- Idempotent: safe to run more than once.

alter table public.scans
	add column if not exists followup_sent_at timestamptz;

alter table public.scans
	add column if not exists followup_email text;

create index if not exists scans_followup_pending_idx
	on public.scans (package, created_at desc)
	where followup_sent_at is null;
