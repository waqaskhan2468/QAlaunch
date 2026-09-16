-- Tracks the abandoned-checkout recovery email.
--
-- Purpose: a scan row with a paid package and payment_status <> 'paid' is
-- someone who entered their email, chose a package, and never completed
-- payment. That is the highest-intent unconverted visitor the product has, and
-- until now nothing was ever sent to them.
--
-- These columns record that one recovery email went out, so the sender can
-- never email the same abandoned checkout twice — the only failure mode that
-- actually damages the sending domain.
--
-- recovery_email is stored separately from scans.user_email so the address the
-- message actually went to is auditable even if user_email is later corrected.
--
-- REQUIRED BEFORE DEPLOY: /api/cron/recovery writes these columns.
-- Idempotent: safe to run more than once.

alter table public.scans
	add column if not exists recovery_sent_at timestamptz;

alter table public.scans
	add column if not exists recovery_email text;

-- Supports the cron's "abandoned, not yet contacted" lookup. Partial index
-- keeps it small: once a row is contacted it leaves the index permanently.
create index if not exists scans_recovery_pending_idx
	on public.scans (payment_status, created_at desc)
	where recovery_sent_at is null;
