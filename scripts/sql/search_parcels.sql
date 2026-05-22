-- scripts/sql/search_parcels.sql
--
-- RPC the browser calls (via PostgREST `rpc/search_parcels`) to power the
-- parcel search/filter panel on /parcels/index.html.
--
-- This is the multi-parcel counterpart to get_parcel_constraints: where that
-- function returns the zoning rules for one clicked parcel, this one returns
-- the parcel_ids of every parcel matching a set of filter criteria within a
-- map viewport. The viewport bbox keeps result sets bounded and fast — the
-- query rides the GiST index on parcels.centroid.
--
-- IMPORTANT: this is a read-only function. It creates NO tables and stores
-- NO rows; a function definition is a few KB of code in pg_proc and does not
-- count against the database size quota. Running it does not grow the DB.
--
-- Inputs (all optional; null = "don't filter on this"):
--   p_categories  text[]  -- austin_zoning_rules.category values to include
--   p_far_min     numeric -- min floor-area ratio
--   p_far_max     numeric -- max floor-area ratio
--   p_height_min  numeric -- min max_height_ft
--   p_height_max  numeric -- max max_height_ft
--   p_permit_after date   -- only parcels with a permit issued on/after this
--   p_west/p_south/p_east/p_north numeric -- viewport bbox in lon/lat (4326)
--
-- Output: setof rows { parcel_id text } — capped at 20000.
--
-- Anon-callable; security invoker so RLS on the underlying tables still
-- applies. Idempotent — replaces the function on re-run.
--
-- How to run: paste this whole file into the Supabase SQL editor and Run.

set statement_timeout = 0;

create or replace function public.search_parcels(
  p_categories  text[]  default null,
  p_far_min     numeric default null,
  p_far_max     numeric default null,
  p_height_min  numeric default null,
  p_height_max  numeric default null,
  p_permit_after date   default null,
  p_west        numeric default null,
  p_south       numeric default null,
  p_east        numeric default null,
  p_north       numeric default null
)
returns table (parcel_id text)
language sql
stable
security invoker
as $$
  select p.parcel_id
  from public.parcels p
  left join public.austin_zoning_rules r on r.base_zoning = p.zoning
  where (p_categories is null or r.category = any (p_categories))
    and (p_far_min    is null or r.far >= p_far_min)
    and (p_far_max    is null or r.far <= p_far_max)
    and (p_height_min is null or r.max_height_ft >= p_height_min)
    and (p_height_max is null or r.max_height_ft <= p_height_max)
    and (
      p_west is null or p_south is null or p_east is null or p_north is null
      or p.centroid && st_makeenvelope(p_west, p_south, p_east, p_north, 4326)
    )
    and (
      p_permit_after is null
      or exists (
        select 1 from public.permits pm
        where pm.parcel_id = p.parcel_id
          and pm.issued_date >= p_permit_after
      )
    )
  limit 20000;
$$;

-- Anon callable.
revoke all on function public.search_parcels(
  text[], numeric, numeric, numeric, numeric, date,
  numeric, numeric, numeric, numeric
) from public;
grant execute on function public.search_parcels(
  text[], numeric, numeric, numeric, numeric, date,
  numeric, numeric, numeric, numeric
) to anon, authenticated;

-- Smoke test the user can run after install (Austin-wide bbox):
--   select count(*) from public.search_parcels(
--     array['commercial'], 1.0, null, null, null, null,
--     -98.20, 30.00, -97.40, 30.65);
