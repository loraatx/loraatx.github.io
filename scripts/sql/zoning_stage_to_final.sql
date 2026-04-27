-- scripts/sql/zoning_stage_to_final.sql
--
-- Promote rows from the ogr2ogr-loaded staging table `zoning_polygons_stage`
-- into the durable `zoning_polygons` table. Used by the load-zoning workflow
-- after the ArcGIS REST GeoJSON has been bulk-loaded into staging.
--
-- Source schema (PLANNINGCADASTRE_zoning_large_map_scale layer, after ogr2ogr
-- LAUNDER=YES lower-cases column names): zoning_id, zoning_ztype (full code
-- with overlays), zoning_base (broad family), shape__area, shape__length.
-- Field-name detection still happens via to_jsonb(row) ->> 'key' so this
-- file remains robust to any future source swap.

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
--
-- The Austin ArcGIS layer publishes ZONING_ZTYPE = full code ("SF-3-NP",
-- "CS-V-CO-NP") and ZONING_BASE = broad family ("SF", "CS"). Our
-- austin_zoning_rules table is keyed on specific base codes ("SF-3",
-- "MF-2", "CS"), so we derive `base_zoning` by longest-prefix match of
-- the full code against the rules table. The overlay string is whatever
-- remains after stripping that prefix and a single hyphen.
with src as (
  select
    s.geom,
    to_jsonb(s) - 'geom' - 'ogc_fid' as props
  from public.zoning_polygons_stage s
  where s.geom is not null
),
mapped as (
  select
    src.geom,
    src.props,
    coalesce(
      nullif(src.props ->> 'zoning_ztype', ''),  -- PLANNINGCADASTRE
      nullif(src.props ->> 'zoning_zty',   ''),
      nullif(src.props ->> 'zoning',       ''),
      nullif(src.props ->> 'zoning_base',  ''),
      nullif(src.props ->> 'base_zone',    '')
    ) as full_z,
    coalesce(
      nullif(src.props ->> 'zoning_id', ''),     -- PLANNINGCADASTRE
      nullif(src.props ->> 'objectid',  ''),
      nullif(src.props ->> 'object_id', ''),
      nullif(src.props ->> 'id',        ''),
      md5(st_asbinary(src.geom)::text)
    ) as zid
  from src
),
matched as (
  select
    m.*,
    (
      select r.base_zoning
      from public.austin_zoning_rules r
      where m.full_z is not null
        and m.full_z like r.base_zoning || '%'
        and (
          length(m.full_z) = length(r.base_zoning)
          or substring(m.full_z from length(r.base_zoning) + 1 for 1) = '-'
        )
      order by length(r.base_zoning) desc
      limit 1
    ) as derived_base
  from mapped m
)
insert into public.zoning_polygons (zoning_id, base_zoning, overlay, full_zoning, geom, metadata)
select
  zid as zoning_id,
  -- Prefer the rules-matched code; fall back to whatever raw "base"-ish
  -- field the source published, so unmatched rows still carry something.
  coalesce(
    derived_base,
    nullif(props ->> 'zoning_base', ''),
    nullif(props ->> 'base_zone',   '')
  ) as base_zoning,
  case
    when derived_base is not null
     and length(full_z) > length(derived_base)
     and substring(full_z from length(derived_base) + 1 for 1) = '-'
    then nullif(substring(full_z from length(derived_base) + 2), '')
    else nullif(coalesce(
      props ->> 'zoning_overlay',
      props ->> 'overlay',
      props ->> 'overlay_code'
    ), '')
  end as overlay,
  full_z as full_zoning,
  st_multi(st_makevalid(geom))::geometry(MultiPolygon, 4326) as geom,
  jsonb_strip_nulls(props) as metadata
from matched
where zid is not null
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
       count(*) filter (where base_zoning is not null) as with_base_zone,
       count(*) filter (where base_zoning in (select base_zoning from public.austin_zoning_rules)) as rules_matched
  from public.zoning_polygons;

-- Top base codes after promotion, so the workflow log lets us spot anything
-- that didn't get a rules-table match (e.g. PUD, MF-7, NCCD codes).
select base_zoning, count(*) as c
  from public.zoning_polygons
 group by 1
 order by c desc
 limit 20;
