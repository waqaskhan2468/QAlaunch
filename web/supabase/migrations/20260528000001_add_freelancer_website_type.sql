-- Add 'freelancer' to the scans.website_type check constraint.
-- The detect.ts code and websiteTypeSchema already include 'freelancer' but
-- the DB constraint was never updated, causing every scan of a personal/
-- freelancer site to fail at persist-metadata with error code 23514.

alter table scans drop constraint if exists scans_website_type_check;

alter table scans
  add constraint scans_website_type_check
  check (
    website_type is null
    or website_type in (
      'ecommerce',
      'business',
      'saas',
      'blog',
      'portfolio',
      'webapp',
      'landing',
      'freelancer',
      'agency',
      'restaurant',
      'nonprofit',
      'event',
      'directory',
      'unknown'
    )
  );
