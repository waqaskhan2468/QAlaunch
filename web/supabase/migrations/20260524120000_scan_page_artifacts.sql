-- Page scan artifacts: object storage is source of truth; DB holds index only.
alter table scan_pages
  add column if not exists artifact_path text,
  add column if not exists artifact_status text
    check (artifact_status is null or artifact_status in ('ok', 'partial', 'failed'));

create index if not exists scan_pages_artifact_path_idx
  on scan_pages (artifact_path)
  where artifact_path is not null;
