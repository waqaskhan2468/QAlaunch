-- artifact_path and artifact_status are no longer written or read.
-- All scan data is now stored in playwright_data (JSONB).
-- axe_violations and raw_html columns are kept:
--   axe_violations → populated from result.axe by ScanWriter.finalize()
--   raw_html       → kept null (reserved for future use)

drop index if exists scan_pages_artifact_path_idx;

alter table scan_pages
  drop column if exists artifact_path,
  drop column if exists artifact_status;
