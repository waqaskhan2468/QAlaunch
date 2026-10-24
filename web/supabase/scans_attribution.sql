-- Where each scan came from.
-- This repo has no migration runner; apply this in the Supabase SQL editor.
--
-- Why this exists:
--
-- Two sales have been made and nobody can say which channel produced either
-- one. The scans table recorded url, package and payment status but nothing
-- about origin, so every marketing experiment to date has been unmeasurable:
-- $42 on Reddit Ads, a Facebook post that drove 176 scans, organic search and
-- a set of programmatic pages all arrive as the same anonymous row.
--
-- That is the actual thing blocking growth. A channel you cannot identify is a
-- channel you cannot double down on, and spending more on any of them is
-- guessing with extra steps.
--
-- First-touch, not last-touch. The UTM and referrer are captured when someone
-- first lands and held for the session, so a visitor who arrives from a search
-- result, reads two pages and then scans is still credited to search rather
-- than to an internal link. For a funnel this short that is the honest model.
--
-- All five columns are nullable by design. Direct traffic genuinely has no
-- referrer, and a null is the truthful record of that — not a gap to be filled
-- in with a guess.

alter table public.scans
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  -- Referring host only (e.g. "google.com"), never the full URL: the path can
  -- carry someone's search terms or private page, and nothing here needs it.
  add column if not exists referrer_host text,
  -- The page they first arrived on, so a programmatic page that produces a
  -- sale can be identified individually rather than lumped into "organic".
  add column if not exists landing_path text;

-- The query this exists to answer: revenue grouped by source.
create index if not exists scans_attribution_idx
  on public.scans (utm_source, created_at desc);

-- And: which landing pages produce paying customers.
create index if not exists scans_landing_paid_idx
  on public.scans (landing_path, payment_status)
  where landing_path is not null;
