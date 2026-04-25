-- scripts/sql/load_zoning_from_socrata.sql
--
-- Background loader for Austin's "Zoning" districts polygon dataset.
-- Same chunked pg_cron + pgsql-http pattern as load_parcels_from_socrata.sql.
-- The browser doesn't need to stay connected; the cron job runs one chunk
-- per minute server-side.
--
-- ======================================================================
-- DATASET: q3y3-ungd  ("Zoning Ordinance" — City of Austin polygon boundaries)
-- ======================================================================
-- URL: https://data.austintexas.gov/Locations-and-Maps/Zoning-Ordinance/q3y3-ungd
-- Field shape (verified via metadata; API rows may need inspection on first
-- successful chunk):
--   - 'the_geom' or 'geometry'                 — multipolygon
--   - 'base_zone' or 'zoning_zty' or 'zoning'  — base zoning code
--   - 'zoning_zone_class' or 'full_zoning'     — full string with overlays
--   - 'zoning_overlay' or 'overlay'            — overlay code
-- The function below uses coalesce() across these candidates so the loader
-- works regardless of the actual key names; check parcels_load_state.last_result
-- after the first chunk and adjust if 'skipped' is dominating 'inserted'.
--
-- Sibling: nbzi-qabm ("Zoning By Address") is address-indexed only and is
-- NOT suitable for spatial joins — do not use that one here.
--
-- If the SODA endpoint returns empty 'properties' objects for this dataset
-- (some Socrata "Map" views suppress row export), fall back to:
--   1. Download GeoJSON from the dataset's "Export" button (Map view).
--   2. ogr2ogr -f PostgreSQL "PG:$DATABASE_URL" zoning.geojson
--        -nln public.zoning_polygons_stage -overwrite
--        -lco GEOMETRY_NAME=geom -nlt PROMOTE_TO_MULTI
--   3. INSERT INTO public.zoning_polygons (...) SELECT ... FROM stage.
-- ======================================================================
--
-- How to run:
--   1. Set v_socrata_id constant in parcels_zoning_load_step() below.
--   2. Open https://supabase.com/dashboard/project/tqnklodtiithbsxxyycp/sql/new
--   3. Paste this entire file, click Run. Schedules the cron job.
--   4. Close the tab. Come back after ~10–20 minutes (zoning has fewer
--      polygons than parcels — usually < 25k features).
--
-- Progress check at any time:
--   select * from public.zoning_load_state;
--   select count(*) from public.zoning_polygons;
--
-- When `completed = true`, stop the job:
--   select cron.unschedule('zoning-load');
--
-- Idempotent: re-running this file is safe.

set statement_timeout = 0;

-- Extensions (already installed via parcels load, but idempotent):
create extension if not exists http;
create extension if not exists pg_cron;

-- Target table: zoning districts as polygons.
create table if not exists public.zoning_polygons (
  zoning_id     text primary key,                      -- Socrata row id
  base_zoning   text,                                  -- e.g. 'SF-3', 'CS', 'MF-2'
  overlay       text,                                  -- combined overlay codes if present
  full_zoning   text,                                  -- full string as published (may include suffixes)
  geom          geometry(MultiPolygon, 4326) not null,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists zoning_polygons_geom_idx on public.zoning_polygons using gist (geom);
create index if not exists zoning_polygons_base_idx on public.zoning_polygons (base_zoning);

alter table public.zoning_polygons enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'zoning_polygons'
      and policyname = 'zoning_polygons_anon_read'
  ) then
    create policy zoning_polygons_anon_read on public.zoning_polygons
      for select to anon using (true);
  end if;
end $$;

-- State tracking (one row, upsert-only — same pattern as parcels loader).
create table if not exists public.zoning_load_state (
  id           int primary key default 1 check (id = 1),
  next_offset  int not null default 0,
  completed    boolean not null default false,
  last_result  text,
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
insert into public.zoning_load_state (id) values (1) on conflict (id) do nothing;

-- Worker.
create or replace function public.zoning_load_step(p_limit int default 5000)
returns text
language plpgsql
as $$
declare
  v_lock        bigint := 7424243;            -- distinct from parcels lock
  v_socrata_id  text   := 'q3y3-ungd';   -- "Zoning Ordinance" polygons
  v_offset      int;
  v_done        boolean;
  v_url         text;
  v_status      int;
  v_body        jsonb;
  v_features    jsonb;
  v_feature     jsonb;
  v_props       jsonb;
  v_g           geometry;
  v_fetched     int;
  v_inserted    int := 0;
  v_skipped     int := 0;
  v_zoning_id   text;
  v_base        text;
  v_overlay     text;
  v_full        text;
begin
  if not pg_try_advisory_lock(v_lock) then
    return 'skipped: prior run still holding lock';
  end if;

  perform http_set_curlopt('CURLOPT_TIMEOUT',        '60');
  perform http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  select next_offset, completed into v_offset, v_done
    from public.zoning_load_state where id = 1;

  if v_done then
    perform pg_advisory_unlock(v_lock);
    return 'already complete';
  end if;

  v_url := 'https://data.austintexas.gov/resource/' || v_socrata_id || '.geojson?'
        || '$order=:id'
        || '&$limit='  || p_limit
        || '&$offset=' || v_offset;

  select status, content::jsonb into v_status, v_body
    from http_get(v_url);

  if v_status <> 200 then
    perform pg_advisory_unlock(v_lock);
    raise exception 'socrata http %: %', v_status, left(v_body::text, 300);
  end if;

  v_features := v_body -> 'features';

  if v_features is null or jsonb_typeof(v_features) <> 'array' then
    perform pg_advisory_unlock(v_lock);
    raise exception 'socrata response missing features array: %', left(v_body::text, 300);
  end if;

  v_fetched := jsonb_array_length(v_features);

  if v_fetched = 0 then
    update public.zoning_load_state
      set completed   = true,
          last_result = 'done at offset=' || v_offset,
          updated_at  = now()
      where id = 1;
    perform pg_advisory_unlock(v_lock);
    return 'complete';
  end if;

  for v_feature in select jsonb_array_elements(v_features) loop
    begin
      v_props := v_feature -> 'properties';
      if v_props is null or v_feature -> 'geometry' is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      -- Field names vary across Austin datasets; fall back through the most
      -- common ones. The user can tweak this block if the dataset uses
      -- different keys (verify via http_get(...).content::jsonb -> 'features' -> 0).
      v_zoning_id := coalesce(
        v_props ->> ':id',
        v_props ->> 'objectid',
        v_props ->> 'object_id',
        v_props ->> 'id'
      );
      v_base := coalesce(
        v_props ->> 'base_zoning',
        v_props ->> 'zoning_zty',
        v_props ->> 'zoning_zone_class',
        v_props ->> 'zoning'
      );
      v_overlay := coalesce(
        v_props ->> 'zoning_overlay',
        v_props ->> 'overlay',
        v_props ->> 'overlay_code'
      );
      v_full := coalesce(
        v_props ->> 'zoning_zone_class',
        v_props ->> 'zoning',
        v_props ->> 'full_zoning',
        v_base
      );

      if v_zoning_id is null then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_g := st_setsrid(st_geomfromgeojson(v_feature -> 'geometry'), 4326);
      v_g := st_multi(st_makevalid(v_g));
      if v_g is null or st_geometrytype(v_g) <> 'ST_MultiPolygon' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      insert into public.zoning_polygons (zoning_id, base_zoning, overlay, full_zoning, geom, metadata)
      values (
        v_zoning_id,
        v_base,
        v_overlay,
        v_full,
        v_g::geometry(MultiPolygon, 4326),
        jsonb_strip_nulls(v_props - 'geometry')
      )
      on conflict (zoning_id) do update set
        base_zoning = excluded.base_zoning,
        overlay     = excluded.overlay,
        full_zoning = excluded.full_zoning,
        geom        = excluded.geom,
        metadata    = excluded.metadata,
        updated_at  = now();

      v_inserted := v_inserted + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  update public.zoning_load_state
    set next_offset = v_offset + p_limit,
        last_result = format('offset=%s fetched=%s inserted=%s skipped=%s',
                              v_offset, v_fetched, v_inserted, v_skipped),
        updated_at  = now()
    where id = 1;

  perform pg_advisory_unlock(v_lock);
  return format('offset=%s fetched=%s inserted=%s skipped=%s',
                 v_offset, v_fetched, v_inserted, v_skipped);
end $$;

-- (Re)schedule the job. Runs once a minute.
select cron.unschedule('zoning-load') where exists (
  select 1 from cron.job where jobname = 'zoning-load'
);

select cron.schedule(
  'zoning-load',
  '* * * * *',
  $cron$ select public.zoning_load_step(5000); $cron$
);

-- Immediate feedback.
select * from public.zoning_load_state;
