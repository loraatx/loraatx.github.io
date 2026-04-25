#!/usr/bin/env bash
#
# parcels_make_pmtiles.sh — export parcels from PostGIS, tile with tippecanoe,
# convert to PMTiles, and upload to Supabase Storage.
#
# Two ways to pass DB credentials. The script prefers libpq env vars when
# present, which sidesteps any URI-parsing quirks with the password.
#
#   (1) Discrete fields (recommended; libpq env vars):
#       PGHOST=aws-1-us-west-1.pooler.supabase.com
#       PGPORT=5432
#       PGUSER=postgres.tqnklodtiithbsxxyycp
#       PGPASSWORD=<db password, raw — no URL encoding>
#       PGDATABASE=postgres
#
#   (2) URI form (legacy):
#       DATABASE_URL='postgresql://postgres.<ref>:<pw>@<pooler-host>:5432/postgres'
#
# Plus, always:
#   SUPABASE_URL='https://<ref>.supabase.co'
#   SUPABASE_SERVICE_KEY='<service-role key>'
#
# Requires on PATH: ogr2ogr (gdal), tippecanoe, pmtiles, curl.

set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL must be set (e.g. https://tqnklodtiithbsxxyycp.supabase.co)}"
: "${SUPABASE_SERVICE_KEY:?SUPABASE_SERVICE_KEY must be set}"

# Resolve which DB-connection style to use. PG* env vars win.
if [[ -n "${PGHOST:-}" && -n "${PGUSER:-}" && -n "${PGPASSWORD:-}" ]]; then
  PG_DSN=""    # ogr2ogr will fall back to libpq env vars
  echo "[tiles] using libpq env vars (host=$PGHOST user=$PGUSER db=${PGDATABASE:-postgres})"
elif [[ -n "${DATABASE_URL:-}" ]]; then
  PG_DSN="$DATABASE_URL"
  echo "[tiles] using DATABASE_URL"
else
  echo "Set either PGHOST/PGUSER/PGPASSWORD or DATABASE_URL." >&2
  exit 2
fi

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
  "PG:$PG_DSN" \
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
