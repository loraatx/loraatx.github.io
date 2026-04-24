#!/usr/bin/env bash
#
# parcels_make_pmtiles.sh — export parcels from PostGIS, tile with tippecanoe,
# convert to PMTiles, and upload to Supabase Storage.
#
# Usage:
#   DATABASE_URL='postgresql://...' \
#   SUPABASE_URL='https://tqnklodtiithbsxxyycp.supabase.co' \
#   SUPABASE_SERVICE_KEY='eyJhbGciOi...' \
#     scripts/parcels_make_pmtiles.sh
#
# Requires: ogr2ogr (gdal), tippecanoe, pmtiles, curl.

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${SUPABASE_URL:?SUPABASE_URL must be set (e.g. https://tqnklodtiithbsxxyycp.supabase.co)}"
: "${SUPABASE_SERVICE_KEY:?SUPABASE_SERVICE_KEY must be set}"

BUCKET="${BUCKET:-tiles}"
OBJECT="${OBJECT:-austin-parcels.pmtiles}"

for bin in ogr2ogr tippecanoe pmtiles curl; do
  command -v "$bin" >/dev/null 2>&1 || { echo "missing required tool: $bin" >&2; exit 1; }
done

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

echo "[tiles] exporting parcels from PostGIS -> $WORK/parcels.geojsonl"
ogr2ogr \
  -f GeoJSONSeq parcels.geojsonl \
  "PG:$DATABASE_URL" \
  -sql "select parcel_id, geom from public.parcels"

test -s parcels.geojsonl || { echo "export produced no rows — aborting" >&2; exit 1; }

echo "[tiles] building mbtiles with tippecanoe"
tippecanoe \
  -o parcels.mbtiles \
  -l parcels \
  -zg \
  --minimum-zoom=12 \
  --maximum-zoom=16 \
  --drop-densest-as-needed \
  --extend-zooms-if-still-dropping \
  --coalesce-densest-as-needed \
  --no-tile-size-limit \
  --use-attribute-for-id=parcel_id \
  --read-parallel \
  --force \
  parcels.geojsonl

echo "[tiles] converting to pmtiles"
pmtiles convert parcels.mbtiles "$OBJECT"

echo "[tiles] pmtiles show:"
pmtiles show "$OBJECT" || true

echo "[tiles] uploading to Supabase Storage: $BUCKET/$OBJECT"
HTTP_STATUS=$(curl -sS -o /tmp/supabase-upload-resp -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/octet-stream" \
  -H "x-upsert: true" \
  --data-binary "@$OBJECT" \
  "$SUPABASE_URL/storage/v1/object/$BUCKET/$OBJECT")

if [[ "$HTTP_STATUS" != "200" && "$HTTP_STATUS" != "201" ]]; then
  echo "upload failed with HTTP $HTTP_STATUS" >&2
  cat /tmp/supabase-upload-resp >&2 || true
  exit 1
fi

PUBLIC_URL="$SUPABASE_URL/storage/v1/object/public/$BUCKET/$OBJECT"
echo "[tiles] uploaded. Public URL: $PUBLIC_URL"
echo "[tiles] verifying range-request support..."
curl -sI -H "Range: bytes=0-1023" "$PUBLIC_URL" | head -20 || true

echo "[tiles] done."
