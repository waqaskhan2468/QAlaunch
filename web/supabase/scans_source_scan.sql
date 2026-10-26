-- Links a paid scan to the free scan it was bought from.
--
-- Until now a purchase created an unrelated scans row, so (a) the paid report
-- could not inherit the findings the buyer had just seen locked, and (b) the
-- admin dashboard could not tell which free scan produced a sale — "free to
-- paid" was two unrelated counts divided.
--
-- The code tolerates this column being absent (the insert retries without it
-- and the dashboard skips the join), but run it before deploying so the link
-- is recorded from the first sale onwards. Idempotent.

alter table public.scans
	add column if not exists source_scan_id uuid references public.scans (id) on delete set null;

create index if not exists scans_source_scan_id_idx on public.scans (source_scan_id);
