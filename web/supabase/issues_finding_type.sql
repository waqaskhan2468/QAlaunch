-- Adds a finding_type tier to public.issues so we can distinguish:
--   verified_pattern — deterministic Playwright checks + the specific AI-vision
--                       checklist (known high-confidence patterns). Prioritised
--                       for the free-tier preview.
--   suggestion        — soft, lower-confidence advice (e.g. "page feels plain").
--                       A separate tier; excluded from the health score and from
--                       critical/high issue totals.
--   general           — open-ended AI-judgment findings (the default).
--
-- Idempotent: safe to run more than once. Existing rows default to 'general'.

alter table public.issues
	add column if not exists finding_type text not null default 'general';

alter table public.issues
	drop constraint if exists issues_finding_type_check;

alter table public.issues
	add constraint issues_finding_type_check
	check (finding_type in ('verified_pattern', 'suggestion', 'general'));

create index if not exists issues_finding_type_idx
	on public.issues (scan_id, finding_type);
