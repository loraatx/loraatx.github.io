-- scripts/sql/search_parcels.sql
--
-- RPC called by the parcel filter panel on /parcels/index.html.
-- Returns parcel_ids matching zoning/FAR/height criteria within a
-- map-viewport bounding box.
--
-- PERFORMANCE: the viewport bbox is applied as a direct, mandatory
-- predicate (`p.geom && st_makeenvelope(...)`) so the planner can use
-- the GiST index parcels_geom_gix. It must NOT be wrapped in an
-- `OR p_west IS NULL` guard — that defeats the index and makes the
-- query scan every parcel in the city, which times out.
--
-- The zoning filters (category/FAR/height) keep the optional
-- `param IS NULL OR ...` pattern: they hit austin_zoning_rules, a tiny
-- lookup table, so no index is needed there.
--
-- Parameters:
--   p_categories  text[]   — austin_zoning_rules.category values to include
--   p_far_min     numeric  — minimum floor-area ratio
--   p_far_max     numeric  — maximum floor-area ratio
--   p_height_min  numeric  — minimum max_height_ft
--   p_height_max  numeric  — maximum max_height_ft
--   p_west/south/east/north numeric — viewport bbox in WGS-84 lon/lat
--                                     (REQUIRED; a null bbox yields no rows)
--
-- Tables used: public.parcels, public.austin_zoning_rules (both exist).
-- Creates no tables, stores no rows. Idempotent — safe to re-run.
--
-- NOTE: permit-activity filtering is intentionally NOT included here. The
-- public.permits table is future work and does not yet exist in the live
-- database; referencing it would make this CREATE FUNCTION fail. When that
-- table is populated, add a p_permit_after date parameter and an
-- `exists (select 1 from public.permits ...)` clause, then re-run this file.
--
-- How to run: paste into the Supabase SQL editor and click Run.

set statement_timeout = 0;

create or replace function public.search_parcels(
  p_categories text[]  default null,
  p_far_min    numeric default null,
  p_far_max    numeric default null,
  p_height_min numeric default null,
  p_height_max numeric default null,
  p_west       numeric default null,
  p_south      numeric default null,
  p_east       numeric default null,
  p_north      numeric default null
)
returns table(parcel_id text)
language sql
stable
security invoker
set statement_timeout to '20s'
as $$
  select p.parcel_id
  from   public.parcels p
  left join public.austin_zoning_rules r on r.base_zoning = p.zoning
  where
    -- viewport bbox FIRST and mandatory — uses the GiST index on parcels.geom
    p.geom && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    -- zoning category (austin_zoning_rules — tiny lookup, no index needed)
    and (p_categories is null or r.category = any(p_categories))
    -- FAR range
    and (p_far_min is null or r.far >= p_far_min)
    and (p_far_max is null or r.far <= p_far_max)
    -- height range
    and (p_height_min is null or r.max_height_ft >= p_height_min)
    and (p_height_max is null or r.max_height_ft <= p_height_max)
  limit 20000;
$$;

revoke all on function public.search_parcels(
  text[], numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) from public;

grant execute on function public.search_parcels(
  text[], numeric, numeric, numeric, numeric,
  numeric, numeric, numeric, numeric
) to anon, authenticated;

-- Quick smoke test (run after installing) — small bbox, should return fast:
--   select count(*) from public.search_parcels(
--     array['commercial'], 1.0, null, null, null,
--     -97.76, 30.25, -97.72, 30.29);
