-- funnel_events — one row per tracked step in the free-scan → payment funnel.
-- This repo has no migration runner; apply this in the Supabase SQL editor.
--
-- Events (event_type):
--   scan_started       — free scan accepted, before the Inngest pipeline is queued
--   scan_completed     — free scan pipeline reached mark-done
--   results_viewed     — results page rendered for the user (client)
--   paywall_viewed     — locked-issues / upgrade section scrolled into view (client)
--   checkout_started   — Paddle checkout opened on the checkout page (client)
--   payment_completed  — Paddle transaction.paid/completed webhook fired
--
-- Free and paid submissions are separate `scans` rows, so a single user's path is
-- not joinable by scan_id across the free→paid boundary. `email` and `url` are
-- recorded where available so the funnel can also be stitched by visitor.

create table if not exists public.funnel_events (
  id         uuid        primary key default gen_random_uuid(),
  scan_id    uuid        not null references public.scans (id) on delete cascade,
  event_type text        not null,
  email      text,
  url        text        not null,
  created_at timestamptz not null default now()
);

-- Common query paths: per-event-type counts, and per-scan timelines.
create index if not exists funnel_events_event_type_idx on public.funnel_events (event_type, created_at);
create index if not exists funnel_events_scan_id_idx     on public.funnel_events (scan_id);
create index if not exists funnel_events_email_idx       on public.funnel_events (email);
