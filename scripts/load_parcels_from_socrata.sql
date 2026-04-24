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
create or replace function public.parcels_load_step(p_limit int default 10000)
returns text
language plpgsql
as $$
declare
  v_lock     bigint := 7424242;   -- arbitrary advisory-lock key
  v_offset   int;
  v_done     boolean;
  v_url      text;
  v_body     jsonb;
  v_fetched  int;
  v_inserted int;
begin
  -- Skip if a prior invocation is still running.
  if not pg_try_advisory_lock(v_lock) then
    return 'skipped: prior run still holding lock';
  end if;

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

  select (http_get(v_url)).content::jsonb into v_body;
  v_fetched := coalesce(jsonb_array_length(v_body->'features'), 0);

  if v_fetched = 0 then
    update public.parcels_load_state
      set completed = true,
          last_result = 'done at offset=' || v_offset,
          updated_at = now()
      where id = 1;
    perform pg_advisory_unlock(v_lock);
    return 'complete';
  end if;

  with features as (
    select jsonb_array_elements(v_body->'features') as f
  ),
  ins as (
    insert into public.parcels (parcel_id, geom, centroid, metadata)
    select
      (f->'properties'->>'land_base_id'),
      st_multi(st_setsrid(st_geomfromgeojson(f->'geometry'), 4326))::geometry(MultiPolygon, 4326),
      st_pointonsurface(st_setsrid(st_geomfromgeojson(f->'geometry'), 4326)),
      jsonb_strip_nulls(jsonb_build_object(
        'land_base_type', f->'properties'->>'land_base_type',
        'block_id',       f->'properties'->>'block_id',
        'lot_id',         f->'properties'->>'lot_id'
      ))
    from features
    where f->'properties'->>'land_base_id' is not null
    on conflict (parcel_id) do nothing
    returning 1
  )
  select count(*)::int into v_inserted from ins;

  update public.parcels_load_state
    set next_offset = v_offset + p_limit,
        last_result = format('offset=%s fetched=%s inserted=%s', v_offset, v_fetched, v_inserted),
        updated_at = now()
    where id = 1;

  perform pg_advisory_unlock(v_lock);
  return format('offset=%s fetched=%s inserted=%s', v_offset, v_fetched, v_inserted);
end $$;

-- Schedule (or re-schedule) the job. Runs once a minute.
select cron.unschedule('parcels-load') where exists (
  select 1 from cron.job where jobname = 'parcels-load'
);

select cron.schedule(
  'parcels-load',
  '* * * * *',
  $cron$ select public.parcels_load_step(10000); $cron$
);

-- Immediate feedback.
select * from public.parcels_load_state;
