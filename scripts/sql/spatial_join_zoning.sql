-- scripts/sql/spatial_join_zoning.sql
--
-- Populate parcels.zoning (and zoning_overlay/zoning_source) by spatial-joining
-- parcels.centroid against zoning_polygons. Centroid-based join is the
-- conventional choice for split parcels and runs in seconds against the
-- existing centroid GiST index.
--
-- Run AFTER the zoning loader has finished
-- (select * from public.zoning_load_state where completed = true).
--
-- Idempotent. Re-running overwrites stale assignments.

set statement_timeout = 0;

-- Add columns the v1 schema doesn't have yet. Safe on re-run.
alter table public.parcels add column if not exists zoning_overlay text;
alter table public.parcels add column if not exists zoning_source  text;

-- Materialise the join in one statement. The DISTINCT ON gives a deterministic
-- pick when a centroid happens to sit on a polygon boundary (rare; happens at
-- ROW edges).
with hits as (
  select distinct on (p.parcel_id)
    p.parcel_id,
    z.base_zoning,
    z.overlay,
    z.full_zoning
  from public.parcels p
  join public.zoning_polygons z
    on st_contains(z.geom, p.centroid)
  order by p.parcel_id, z.base_zoning nulls last
)
update public.parcels p
   set zoning         = h.base_zoning,
       zoning_overlay = h.overlay,
       zoning_source  = 'austin_socrata',
       updated_at     = now()
  from hits h
 where h.parcel_id = p.parcel_id
   and (
        p.zoning is distinct from h.base_zoning
     or p.zoning_overlay is distinct from h.overlay
     or p.zoning_source  is distinct from 'austin_socrata'
   );

analyze public.parcels;

-- Sanity checks the user can run after the join:
--   select count(*) filter (where zoning is not null)        as with_zoning,
--          count(*) filter (where zoning is null)            as without_zoning,
--          count(*)                                          as total
--     from public.parcels;
--
--   -- Top base zones by parcel count:
--   select zoning, count(*) c
--     from public.parcels
--    where zoning is not null
--    group by 1
--    order by c desc
--    limit 20;
--
--   -- Parcels whose zoning code has no rules-table match (UI will show
--   -- "rules unavailable" for these):
--   select p.zoning, count(*) c
--     from public.parcels p
--     left join public.austin_zoning_rules r on r.base_zoning = p.zoning
--    where p.zoning is not null
--      and r.base_zoning is null
--    group by 1
--    order by c desc
--    limit 20;
