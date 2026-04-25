-- scripts/sql/get_parcel_constraints.sql
--
-- RPC the browser calls (via PostgREST `rpc/get_parcel_constraints`) to
-- populate the "Constraints" tab of the side drawer.
--
-- Inputs:  p_parcel_id text
-- Output:  jsonb shaped as:
--   {
--     "parcel_id":     "...",
--     "zoning":        "SF-3",
--     "zoning_overlay":"NCCD-... | null",
--     "lot_area_sqft": 6203,
--     "lot_area_acres": 0.142,
--     "rules": {
--       "display_name": "Family Residence",
--       "category":     "residential",
--       "far":          0.40,
--       "max_height_ft": 35,
--       "impervious_pct": 45,
--       "building_pct":   40,
--       "min_lot_sqft":   5750,
--       "front_setback_ft": 25,
--       "side_setback_ft":   5,
--       "rear_setback_ft":  10,
--       "max_units_per_acre": 7,
--       "notes": null,
--       "source_citation": "§25-2-492 Table"
--     },
--     "computed": {
--       "max_floor_area_sqft":  2481,
--       "max_impervious_sqft":  2791,
--       "max_building_sqft":    2481,
--       "max_height_ft":          35,
--       "max_units":               1
--     },
--     "warnings": [ "..." ]
--   }
--
-- Failure modes (each surfaces as a `warnings` entry, not an error):
--   - parcel not found        -> { error: "parcel_not_found" } only
--   - parcel.zoning is null   -> rules omitted, warning emitted
--   - zoning code has no rules-table match -> rules omitted, warning emitted
--
-- Anon-callable; security_invoker = on so RLS still applies to the underlying
-- tables.
--
-- Idempotent. Replaces the function on re-run.

set statement_timeout = 0;

create or replace function public.get_parcel_constraints(p_parcel_id text)
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_parcel       public.parcels%rowtype;
  v_rules        public.austin_zoning_rules%rowtype;
  v_lot_sqft     numeric;
  v_lot_acres    numeric;
  v_warnings     jsonb := '[]'::jsonb;
  v_rules_jsonb  jsonb := null;
  v_computed     jsonb := '{}'::jsonb;
begin
  select * into v_parcel from public.parcels where parcel_id = p_parcel_id;
  if not found then
    return jsonb_build_object('error', 'parcel_not_found', 'parcel_id', p_parcel_id);
  end if;

  -- Lot area in sqft from geographic area (handles latitude correctly).
  v_lot_sqft  := round((st_area(v_parcel.geom::geography) * 10.7639)::numeric, 1);
  v_lot_acres := round((v_lot_sqft / 43560.0)::numeric, 4);

  if v_parcel.zoning is null then
    v_warnings := v_warnings || jsonb_build_array('zoning_unknown');
  else
    select * into v_rules from public.austin_zoning_rules
      where base_zoning = v_parcel.zoning;
    if not found then
      v_warnings := v_warnings || jsonb_build_array(
        format('no_rules_for_zoning:%s', v_parcel.zoning)
      );
    else
      v_rules_jsonb := jsonb_build_object(
        'display_name',      v_rules.display_name,
        'category',          v_rules.category,
        'far',               v_rules.far,
        'max_height_ft',     v_rules.max_height_ft,
        'impervious_pct',    v_rules.impervious_pct,
        'building_pct',      v_rules.building_pct,
        'min_lot_sqft',      v_rules.min_lot_sqft,
        'min_lot_width_ft',  v_rules.min_lot_width_ft,
        'front_setback_ft',  v_rules.front_setback_ft,
        'side_setback_ft',   v_rules.side_setback_ft,
        'rear_setback_ft',   v_rules.rear_setback_ft,
        'max_units_per_acre',v_rules.max_units_per_acre,
        'notes',             v_rules.notes,
        'source_citation',   v_rules.source_citation
      );

      v_computed := jsonb_strip_nulls(jsonb_build_object(
        'max_floor_area_sqft',
          case when v_rules.far is not null
               then round(v_lot_sqft * v_rules.far) end,
        'max_impervious_sqft',
          case when v_rules.impervious_pct is not null
               then round(v_lot_sqft * v_rules.impervious_pct / 100.0) end,
        'max_building_sqft',
          case when v_rules.building_pct is not null
               then round(v_lot_sqft * v_rules.building_pct / 100.0) end,
        'max_height_ft',     v_rules.max_height_ft,
        'max_units',
          case when v_rules.max_units_per_acre is not null
               then floor(v_lot_acres * v_rules.max_units_per_acre)::int end,
        'min_lot_satisfied',
          case when v_rules.min_lot_sqft is not null
               then v_lot_sqft >= v_rules.min_lot_sqft end
      ));

      if v_rules.min_lot_sqft is not null and v_lot_sqft < v_rules.min_lot_sqft then
        v_warnings := v_warnings || jsonb_build_array('lot_below_minimum');
      end if;
    end if;
  end if;

  if v_parcel.zoning_overlay is not null and v_parcel.zoning_overlay <> '' then
    v_warnings := v_warnings || jsonb_build_array(
      format('overlay_present:%s', v_parcel.zoning_overlay)
    );
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'parcel_id',      v_parcel.parcel_id,
    'zoning',         v_parcel.zoning,
    'zoning_overlay', v_parcel.zoning_overlay,
    'zoning_source',  v_parcel.zoning_source,
    'lot_area_sqft',  v_lot_sqft,
    'lot_area_acres', v_lot_acres,
    'rules',          v_rules_jsonb,
    'computed',       case when v_computed = '{}'::jsonb then null else v_computed end,
    'warnings',       case when jsonb_array_length(v_warnings) = 0 then null else v_warnings end
  ));
end $$;

-- Anon callable.
revoke all on function public.get_parcel_constraints(text) from public;
grant execute on function public.get_parcel_constraints(text) to anon, authenticated;

-- Smoke test the user can run after install:
--   select public.get_parcel_constraints(parcel_id)
--     from public.parcels
--    where zoning = 'SF-3'
--    limit 1;
