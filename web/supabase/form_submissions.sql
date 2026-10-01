-- form_submissions — one row per accepted submission to a public form that
-- sends mail (/api/contact, /api/audit-enquiry).
-- This repo has no migration runner; apply this in the Supabase SQL editor.
--
-- Why this table exists:
--
-- Both routes send one email per POST, drawing on a Resend plan that allows
-- 100 a day across everything the product sends, scan and report mail
-- included. Without a limit, a loop drains that quota in minutes and real
-- enquiries then fail silently — a quota rejection looks exactly like nobody
-- getting in touch.
--
-- The first attempt at that limit kept counters in memory. On Vercel that does
-- almost nothing: each warm lambda holds its own counters, so four requests in
-- a row were served by four instances and none of them saw the other three.
-- Verified against production, four consecutive submissions, zero rejections.
-- A shared counter has to live somewhere both instances can see, which means
-- the database.
--
-- ip_hash, not ip: an address is personal data, and nothing here needs the
-- original. It is a salted SHA-256, which still groups requests from one
-- source for counting but is not a stored record of who visited.

create table if not exists public.form_submissions (
  id         uuid        primary key default gen_random_uuid(),
  form       text        not null,
  ip_hash    text        not null,
  created_at timestamptz not null default now()
);

-- The only read path: "how many from this hash since T".
create index if not exists form_submissions_ip_hash_idx
  on public.form_submissions (ip_hash, created_at desc);

-- And the global cap: "how many in total since T".
create index if not exists form_submissions_created_at_idx
  on public.form_submissions (created_at desc);

-- Nothing reads rows older than 24h. Without pruning this grows forever, and
-- the fastest way to make it grow is the flood it exists to stop.
-- Run periodically, or from the existing cron route:
--   delete from public.form_submissions where created_at < now() - interval '2 days';
