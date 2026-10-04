-- Result email for free scans — opt-in only.
-- This repo has no migration runner; apply this in the Supabase SQL editor.
--
-- A free scan takes about two minutes. People paste a URL, switch tabs, and
-- never come back, so the result nobody sees cannot sell anything. Paid Reddit
-- traffic made that concrete: a free scan costs about $2.37 to buy, and every
-- visitor who scanned and left took that with them.
--
-- Two optional prompts on the result page now offer to email the results. The
-- scan is never gated on it: "no signup" is promised in the site metadata, in
-- llms.txt, and on the ad creatives currently running, and all three stay true.
--
-- marketing_consent is separate from having an address. Someone who asks for
-- their own report has asked for exactly that and nothing else. Only an
-- explicitly ticked box means they also agreed to hear from us again, which is
-- what Canada's CASL and the UK's rules require and what makes the resulting
-- list safe to actually use.
--
-- result_email_sent_at makes the send idempotent. Inngest retries steps, and
-- the address can be submitted twice (once while scanning, once after results
-- render). Nobody should receive the same report twice.

alter table public.scans
  add column if not exists marketing_consent     boolean,
  add column if not exists result_email_sent_at  timestamptz;

-- The send path asks "free scans, finished, has an address, not yet emailed".
create index if not exists scans_result_email_pending_idx
  on public.scans (status, result_email_sent_at)
  where user_email is not null;

-- Pulling the opted-in list for follow-up, which is the point of collecting it.
create index if not exists scans_marketing_consent_idx
  on public.scans (marketing_consent, created_at desc)
  where marketing_consent is true;
