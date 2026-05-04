-- scripts/sql/load_permits_from_socrata.sql
--
-- Background loader for Austin's "Issued Construction Permits" dataset
-- (Socrata 3syk-w9eu). Same chunked pg_cron + pgsql-http pattern as
-- load_parcels_from_socrata.sql and load_zoning_from_socrata.sql.
--
-- Permits are point features (latitude / longitude), so we fetch JSON not
-- GeoJSON and assemble the Point geometry in SQL. We use an incremental
-- watermark instead of a full backfill: each run pulls all permits where
-- issued_date is within the last 5 years, ordered by :id, paginated. This
-- keeps the first-load bounded and weekly refreshes fast.
--
-- How to run (one-time setup):
--   1. Open https://supabase.com/dashboard/project/tqnklodtiithbsxxyycp/sql/new
--   2. Paste this entire file, click Run.
--   3. Close the tab. Come back after ~30–60 minutes for the initial backfill
--      (~150k–250k rows over the last 5 years).
--
-- Progress check at any time:
--   select * from public.permits_load_state;
--   select count(*) from public.permits;
--
-- Steady-state: the weekly GitHub workflow truncates the load-state and
-- re-runs the cron to pick up new permits.
--
-- Idempotent: re-running this file is safe.

set statement_timeout = 0;

create extension if not exists http;
create extension if not exists pg_cron;

-- State tracking, distinct lock from parcels/zoning loaders.
create table if not exists public.permits_load_state (
  id           int primary key default 1 check (id = 1),
  next_offset  int not null default 0,
  completed    boolean not null default false,
  last_result  text,
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
insert into public.permits_load_state (id) values (1) on conflict (id) do nothing;

-- Worker.
create or replace function public.permits_load_step(p_limit int default 5000)
returns text
language plpgsql
as $$
declare
  v_lock      bigint := 7424244;        -- distinct from parcels/zoning locks
  v_offset    int;
  v_done      boolean;
  v_url       text;
  v_status    int;
  v_body      jsonb;
  v_rows      jsonb;
  v_row       jsonb;
  v_lat       double precision;
  v_lng       double precision;
  v_g         geometry;
  v_fetched   int;
  v_inserted  int := 0;
  v_skipped   int := 0;
  v_window    text := (now() - interval '5 years')::date::text;
begin
  if not pg_try_advisory_lock(v_lock) then
    return 'skipped: prior run still holding lock';
  end if;

  perform http_set_curlopt('CURLOPT_TIMEOUT',        '60');
  perform http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  select next_offset, completed into v_offset, v_done
    from public.permits_load_state where id = 1;

  if v_done then
    perform pg_advisory_unlock(v_lock);
    return 'already complete';
  end if;

  -- $where filters on issued_date >= 5y ago. $order=:id is required for
  -- stable pagination across pages.
  v_url := 'https://data.austintexas.gov/resource/3syk-w9eu.json?'
        || '$order=:id'
        || '&$where=' || replace('issued_date >= ''' || v_window || 'T00:00:00.000''', ' ', '%20')
        || '&$limit='  || p_limit
        || '&$offset=' || v_offset;

  select status, content::jsonb into v_status, v_body
    from http_get(v_url);

  if v_status <> 200 then
    perform pg_advisory_unlock(v_lock);
    raise exception 'socrata http %: %', v_status, left(v_body::text, 300);
  end if;

  if jsonb_typeof(v_body) <> 'array' then
    perform pg_advisory_unlock(v_lock);
    raise exception 'socrata response not an array: %', left(v_body::text, 300);
  end if;

  v_rows    := v_body;
  v_fetched := jsonb_array_length(v_rows);

  if v_fetched = 0 then
    update public.permits_load_state
      set completed   = true,
          last_result = 'done at offset=' || v_offset,
          updated_at  = now()
      where id = 1;
    perform pg_advisory_unlock(v_lock);
    return 'complete';
  end if;

  for v_row in select jsonb_array_elements(v_rows) loop
    begin
      if v_row ->> 'permit_number' is null and v_row ->> ':id' is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_lat := nullif(v_row ->> 'latitude',  '')::double precision;
      v_lng := nullif(v_row ->> 'longitude', '')::double precision;

      v_g := case
               when v_lat is not null and v_lng is not null
                 then st_setsrid(st_makepoint(v_lng, v_lat), 4326)
               else null
             end;

      insert into public.permits (
        permit_id, permit_type, work_class, permit_class, status_current,
        issued_date, applied_date,
        total_job_valuation, total_existing_sqft, total_new_add_sqft,
        original_address, original_zip, original_city, council_district,
        contractor_company, applicant_full_name,
        geom, metadata
      )
      values (
        coalesce(v_row ->> 'permit_number', v_row ->> ':id'),
        v_row ->> 'permit_type',
        v_row ->> 'work_class',
        v_row ->> 'permit_class',
        v_row ->> 'status_current',
        nullif(v_row ->> 'issued_date',  '')::date,
        nullif(v_row ->> 'applied_date', '')::date,
        nullif(v_row ->> 'total_job_valuation',     '')::numeric,
        nullif(v_row ->> 'total_existing_bldg_sqft','')::numeric,
        nullif(v_row ->> 'total_new_add_bldg_sqft', '')::numeric,
        v_row ->> 'original_address1',
        v_row ->> 'original_zip',
        v_row ->> 'original_city',
        v_row ->> 'council_district',
        v_row ->> 'contractor_company_name',
        v_row ->> 'applicant_full_name',
        v_g,
        jsonb_strip_nulls(v_row)
      )
      on conflict (permit_id) do update set
        status_current      = excluded.status_current,
        issued_date         = excluded.issued_date,
        total_job_valuation = excluded.total_job_valuation,
        geom                = coalesce(excluded.geom, public.permits.geom),
        metadata            = excluded.metadata,
        updated_at          = now();

      v_inserted := v_inserted + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  update public.permits_load_state
    set next_offset = v_offset + p_limit,
        last_result = format('offset=%s fetched=%s inserted=%s skipped=%s',
                              v_offset, v_fetched, v_inserted, v_skipped),
        updated_at  = now()
    where id = 1;

  perform pg_advisory_unlock(v_lock);
  return format('offset=%s fetched=%s inserted=%s skipped=%s',
                 v_offset, v_fetched, v_inserted, v_skipped);
end $$;

-- Spatially backfill parcel_id for any permit row that has geom but no
-- parcel_id yet. Cheap incremental update — runs alongside the cron worker.
create or replace function public.permits_attach_parcel_ids(p_limit int default 10000)
returns int
language plpgsql
as $$
declare v_n int;
begin
  with todo as (
    select permit_id, geom from public.permits
     where parcel_id is null and geom is not null
     limit p_limit
  ),
  matched as (
    select t.permit_id, p.parcel_id
      from todo t
      join public.parcels p on st_contains(p.geom, t.geom)
  )
  update public.permits pe
     set parcel_id = m.parcel_id
    from matched m
   where pe.permit_id = m.permit_id;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- (Re)schedule the loader. Runs once a minute; the function exits early
-- when the dataset is exhausted.
select cron.unschedule('permits-load') where exists (
  select 1 from cron.job where jobname = 'permits-load'
);

select cron.schedule(
  'permits-load',
  '* * * * *',
  $cron$ select public.permits_load_step(5000); $cron$
);

-- Parcel-id attachment runs every 5 minutes so newly-loaded permits get
-- joined to parcels without a separate manual pass.
select cron.unschedule('permits-attach-parcel-ids') where exists (
  select 1 from cron.job where jobname = 'permits-attach-parcel-ids'
);

select cron.schedule(
  'permits-attach-parcel-ids',
  '*/5 * * * *',
  $cron$ select public.permits_attach_parcel_ids(20000); $cron$
);

-- Immediate feedback.
select * from public.permits_load_state;
