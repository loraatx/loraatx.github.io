-- scripts/load_parcels_from_socrata.sql
--
-- One-shot loader: streams the Austin "Lot Line" dataset (Socrata resource
-- r8wq-g5d8, ~410K multipolygons) directly into public.parcels using the
-- pgsql-http extension. No local tooling required.
--
-- How to run:
--   1. Open the Supabase SQL Editor:
--      https://supabase.com/dashboard/project/tqnklodtiithbsxxyycp/sql/new
--   2. Paste this entire file.
--   3. Click Run.
--   4. Expect ~8–15 minutes for the full 410K rows.
--
-- Safe to re-run. Already-loaded parcels are skipped via ON CONFLICT DO NOTHING.
-- Source fields kept:
--   parcel_id  <- land_base_id
--   geom       <- feature geometry (MultiPolygon, EPSG:4326)
--   centroid   <- ST_PointOnSurface(geom)
--   metadata   <- { land_base_type, block_id, lot_id }
--
-- Zoning is intentionally left NULL in v1; a spatial join against the City of
-- Austin zoning layer (3qge-iuk7) will populate it in v1.1.

-- This batch is long-running; disable the 2-minute default.
set statement_timeout = 0;

-- Extension: sync HTTP client inside Postgres.
create extension if not exists http;

-- Chunk loader. Deterministic pagination via :id (Socrata system key).
create or replace function public.load_parcels_chunk(p_offset int, p_limit int)
returns table(fetched int, inserted int)
language plpgsql
as $$
declare
  v_url      text;
  v_body     jsonb;
  v_fetched  int;
  v_inserted int;
begin
  v_url := 'https://data.austintexas.gov/resource/r8wq-g5d8.geojson?'
        || '$order=:id'
        || '&$limit='  || p_limit
        || '&$offset=' || p_offset;

  select (http_get(v_url)).content::jsonb into v_body;

  v_fetched := coalesce(jsonb_array_length(v_body->'features'), 0);

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

  return query select v_fetched, v_inserted;
end $$;

-- Driver: paginate until the source returns an empty page.
do $$
declare
  v_offset int := 0;
  v_limit  int := 2000;
  v_row    record;
  v_total  int := 0;
begin
  loop
    select * into v_row from public.load_parcels_chunk(v_offset, v_limit);
    v_total := v_total + coalesce(v_row.inserted, 0);
    raise notice 'offset=% fetched=% inserted=% running_total=%',
      v_offset, v_row.fetched, v_row.inserted, v_total;
    exit when coalesce(v_row.fetched, 0) = 0;
    v_offset := v_offset + v_limit;
  end loop;
end $$;

analyze public.parcels;

-- Diagnostics returned to the SQL Editor results pane.
select
  count(*)                                                      as loaded,
  count(*) filter (where not st_isvalid(geom))                  as invalid_geoms,
  pg_size_pretty(pg_total_relation_size('public.parcels'))      as table_size,
  st_extent(geom)::text                                         as bbox
from public.parcels;
