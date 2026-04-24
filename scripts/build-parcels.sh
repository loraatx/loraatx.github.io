#!/usr/bin/env bash
#
# build-parcels.sh — load a user-prepared parcels GeoJSON into Supabase PostGIS.
#
# Usage:
#   DATABASE_URL='postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres' \
#     scripts/build-parcels.sh path/to/parcels.geojson
#
# Assumptions (enforced by the plan):
#   - Input is EPSG:4326 GeoJSON/Shapefile with Polygon or MultiPolygon features.
#   - Fields present: parcel_id (unique, non-null), zoning.
#   - Schema already applied via scripts/parcels_schema.sql.
#
# Optional env vars to remap source column names if the user's export uses
# different names (e.g. PROP_ID, ZONING_CLS):
#   PARCEL_ID_COL (default: parcel_id)
#   ZONING_COL    (default: zoning)

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <parcels.geojson>" >&2
  exit 2
fi

INPUT="$1"
if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 2
fi

PARCEL_ID_COL="${PARCEL_ID_COL:-parcel_id}"
ZONING_COL="${ZONING_COL:-zoning}"

echo "[build-parcels] validating $INPUT"
ogrinfo -so -al "$INPUT" | head -40 || true

echo "[build-parcels] loading -> public.parcels_stage"
ogr2ogr \
  -f PostgreSQL "PG:$DATABASE_URL" \
  "$INPUT" \
  -nln public.parcels_stage \
  -overwrite \
  -lco GEOMETRY_NAME=geom \
  -lco LAUNDER=YES \
  -lco FID=ogc_fid \
  -nlt PROMOTE_TO_MULTI \
  --config PG_USE_COPY YES \
  -progress

echo "[build-parcels] upserting into public.parcels"
psql "$DATABASE_URL" \
  --set ON_ERROR_STOP=1 \
  --set "parcel_id_col=$PARCEL_ID_COL" \
  --set "zoning_col=$ZONING_COL" \
  <<'SQL'
begin;

-- Verify required columns exist on staging, using the user-supplied names.
do $$
declare
  missing text;
begin
  select string_agg(c, ', ')
    into missing
  from unnest(array[:'parcel_id_col', :'zoning_col']) c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'parcels_stage'
      and column_name  = c
  );
  if missing is not null then
    raise exception 'parcels_stage missing columns: %', missing;
  end if;
end $$;

insert into public.parcels (parcel_id, zoning, geom, centroid, metadata)
select
  (s.:"parcel_id_col")::text,
  s.:"zoning_col",
  st_multi(st_makevalid(s.geom))::geometry(MultiPolygon, 4326),
  st_pointonsurface(st_makevalid(s.geom)),
  '{}'::jsonb
from public.parcels_stage s
where s.:"parcel_id_col" is not null
on conflict (parcel_id) do update set
  zoning     = excluded.zoning,
  geom       = excluded.geom,
  centroid   = excluded.centroid,
  updated_at = now();

drop table public.parcels_stage;
analyze public.parcels;

commit;

select count(*) as parcels_loaded from public.parcels;
select count(*) as invalid_geoms  from public.parcels where not st_isvalid(geom);
select st_extent(geom) as bbox   from public.parcels;
SQL

echo "[build-parcels] done."
