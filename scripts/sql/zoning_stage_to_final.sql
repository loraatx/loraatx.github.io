-- scripts/sql/zoning_stage_to_final.sql
--
-- Promote rows from the ogr2ogr-loaded staging table `zoning_polygons_stage`
-- into the durable `zoning_polygons` table. Used by the load-zoning workflow
-- after the GeoJSON export has been bulk-loaded.
--
-- Field-name detection happens via to_jsonb(row) ->> 'key' so this works
-- regardless of which property keys the Socrata export decided to ship
-- (different Map views land on slightly different conventions).

set statement_timeout = 0;

-- Make sure the target table exists in case the workflow is run on a fresh
-- project. Mirrors the DDL in load_zoning_from_socrata.sql.
create extension if not exists postgis;

create table if not exists public.zoning_polygons (
  zoning_id     text primary key,
  base_zoning   text,
  overlay       text,
  full_zoning   text,
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

-- Sanity check: staging table must be present and non-empty.
do $$
declare v_n bigint;
begin
  select count(*) into v_n from public.zoning_polygons_stage;
  if v_n = 0 then
    raise exception 'zoning_polygons_stage is empty — ogr2ogr load did not produce rows';
  end if;
  raise notice 'staging row count: %', v_n;
end $$;

-- Promote.
with src as (
  select
    s.geom,
    to_jsonb(s) - 'geom' - 'ogc_fid' as props
  from public.zoning_polygons_stage s
  where s.geom is not null
)
insert into public.zoning_polygons (zoning_id, base_zoning, overlay, full_zoning, geom, metadata)
select
  coalesce(
    nullif(props ->> 'objectid',  ''),
    nullif(props ->> 'object_id', ''),
    nullif(props ->> 'id',        ''),
    md5(st_asbinary(geom)::text)
  ) as zoning_id,
  coalesce(
    props ->> 'base_zone',
    props ->> 'zoning_zty',
    props ->> 'zoning'
  ) as base_zoning,
  coalesce(
    props ->> 'zoning_overlay',
    props ->> 'overlay',
    props ->> 'overlay_code'
  ) as overlay,
  coalesce(
    props ->> 'zoning_zone_class',
    props ->> 'full_zoning',
    props ->> 'zoning_zty',
    props ->> 'zoning'
  ) as full_zoning,
  st_multi(st_makevalid(geom))::geometry(MultiPolygon, 4326) as geom,
  jsonb_strip_nulls(props) as metadata
from src
on conflict (zoning_id) do update set
  base_zoning = excluded.base_zoning,
  overlay     = excluded.overlay,
  full_zoning = excluded.full_zoning,
  geom        = excluded.geom,
  metadata    = excluded.metadata,
  updated_at  = now();

drop table public.zoning_polygons_stage;
analyze public.zoning_polygons;

-- Visibility for the workflow log.
select count(*) as zoning_polygons_total,
       count(*) filter (where base_zoning is not null) as with_base_zone
  from public.zoning_polygons;
