-- scripts/load_parcels_from_socrata.sql
--
-- Background loader for the Austin "Lot Line" dataset (Socrata r8wq-g5d8).
-- Because the Supabase SQL Editor drops long-running requests at the browser,
-- this script schedules a background pg_cron job that runs one chunk per minute
-- server-side. No local tooling required, and the browser doesn't need to stay
-- connected.
--
-- How to run:
--   1. Open https://supabase.com/dashboard/project/tqnklodtiithbsxxyycp/sql/new
--   2. Paste this entire file, click Run. Completes in < 5 seconds — it just
--      installs extensions, functions, and a cron schedule.
--   3. Close the tab. Come back after ~30–45 minutes.
--
-- Progress check at any time:
--   select * from public.parcels_load_state;
--   select count(*) from public.parcels;
--
-- When `completed = true`, stop the job:
--   select cron.unschedule('parcels-load');
--
-- Idempotent: re-running this file is safe. parcels_load_step uses an advisory
-- lock so overlapping minute invocations skip cleanly.

set statement_timeout = 0;

-- Extensions
create extension if not exists http;
create extension if not exists pg_cron;

-- State tracking: one row, upsert-only.
create table if not exists public.parcels_load_state (
  id          int primary key default 1 check (id = 1),
  next_offset int not null default 0,
  completed   boolean not null default false,
  last_result text,
  started_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

insert into public.parcels_load_state (id) values (1)
on conflict (id) do nothing;

-- Worker: loads one chunk from Socrata into public.parcels.
create or replace function public.parcels_load_step(p_limit int default 5000)
returns text
language plpgsql
as $$
declare
  v_lock     bigint := 7424242;   -- arbitrary advisory-lock key
  v_offset   int;
  v_done     boolean;
  v_url      text;
  v_resp     record;
  v_body     jsonb;
  v_features jsonb;
  v_feature  jsonb;
  v_g        geometry;
  v_fetched  int;
  v_inserted int := 0;
  v_skipped  int := 0;
begin
  -- Skip if a prior invocation is still running.
  if not pg_try_advisory_lock(v_lock) then
    return 'skipped: prior run still holding lock';
  end if;

  -- pgsql-http defaults to a 5s total timeout, which is too short for the
  -- ~30 MB Socrata responses. Bump per-session. Use the seconds variants
  -- because Supabase's pgsql-http build doesn't expose CURLOPT_TIMEOUT_MSEC.
  perform http_set_curlopt('CURLOPT_TIMEOUT',        '60');
  perform http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  select next_offset, completed into v_offset, v_done
    from public.parcels_load_state where id = 1;

  if v_done then
    perform pg_advisory_unlock(v_lock);
    return 'already complete';
  end if;

  v_url := 'https://data.austintexas.gov/resource/r8wq-g5d8.geojson?'
        || '$order=:id'
        || '&$limit='  || p_limit
        || '&$offset=' || v_offset;

  -- Distinguish a real empty-page sentinel from a transient error: check
  -- HTTP status, then check that 'features' is actually a JSON array.
  select status, content::jsonb as body into v_resp from http_get(v_url);

  if v_resp.status <> 200 then
    perform pg_advisory_unlock(v_lock);
    raise exception 'socrata http %: %', v_resp.status, left(v_resp.body::text, 300);
  end if;

  v_body     := v_resp.body;
  v_features := v_body -> 'features';

  if v_features is null or jsonb_typeof(v_features) <> 'array' then
    perform pg_advisory_unlock(v_lock);
    raise exception 'socrata response missing features array: %', left(v_body::text, 300);
  end if;

  v_fetched := jsonb_array_length(v_features);

  if v_fetched = 0 then
    update public.parcels_load_state
      set completed = true,
          last_result = 'done at offset=' || v_offset,
          updated_at = now()
      where id = 1;
    perform pg_advisory_unlock(v_lock);
    return 'complete';
  end if;

  -- Per-row exception handling: skip features whose geometry can't be parsed
  -- or repaired (null geom, malformed coords, unsupported types) instead of
  -- failing the entire batch.
  for v_feature in select jsonb_array_elements(v_features) loop
    begin
      if v_feature->'properties'->>'land_base_id' is null
         or v_feature->'geometry' is null
         or jsonb_typeof(v_feature->'geometry') <> 'object' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_g := st_setsrid(st_geomfromgeojson(v_feature->'geometry'), 4326);
      v_g := st_multi(st_makevalid(v_g));
      if v_g is null or st_geometrytype(v_g) <> 'ST_MultiPolygon' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.parcels (parcel_id, geom, centroid, metadata)
      values (
        v_feature->'properties'->>'land_base_id',
        v_g::geometry(MultiPolygon, 4326),
        st_pointonsurface(v_g),
        jsonb_strip_nulls(jsonb_build_object(
          'land_base_type', v_feature->'properties'->>'land_base_type',
          'block_id',       v_feature->'properties'->>'block_id',
          'lot_id',         v_feature->'properties'->>'lot_id'
        ))
      )
      on conflict (parcel_id) do nothing;

      v_inserted := v_inserted + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  update public.parcels_load_state
    set next_offset = v_offset + p_limit,
        last_result = format('offset=%s fetched=%s inserted=%s skipped=%s',
                              v_offset, v_fetched, v_inserted, v_skipped),
        updated_at = now()
    where id = 1;

  perform pg_advisory_unlock(v_lock);
  return format('offset=%s fetched=%s inserted=%s skipped=%s',
                 v_offset, v_fetched, v_inserted, v_skipped);
end $$;

-- Schedule (or re-schedule) the job. Runs once a minute.
select cron.unschedule('parcels-load') where exists (
  select 1 from cron.job where jobname = 'parcels-load'
);

select cron.schedule(
  'parcels-load',
  '* * * * *',
  $cron$ select public.parcels_load_step(5000); $cron$
);

-- Immediate feedback.
select * from public.parcels_load_state;
