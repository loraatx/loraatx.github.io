# Map App Template — Claude Instructions

## What This Folder Is

This is a config-driven MapLibre GL map application. It displays GeoJSON point data on a 3D map with extruded buildings, dropdown filters, a data table, and popups with Google Maps / Apple Maps / Waze navigation links.

**Live URL:** https://anatomy.city/apps/examplepage1/

## Architecture

| File | Role | Changes per deployment? |
|------|------|------------------------|
| `config.js` | CONFIG object — all deployment-specific values | **Yes — edit this** |
| `data.geojson` | GeoJSON FeatureCollection of points | **Yes — replace entirely** |
| `index.html` | Generic shell with empty containers | **Never** |
| `style.css` | All visual styling | **Never** |
| `app.js` | All app logic (map, filters, table, popups, export) | **Never** |

## How to Deploy New Data

There are two workflows. Both end with: replace `data.geojson`, update `config.js`, commit, push to `main`.

### Workflow 1: Query OpenStreetMap

When asked to find places (e.g., "all breweries in East Austin"):

1. **Build an Overpass query** using the correct OSM tags. Common tags:
   - Restaurants: `["amenity"="restaurant"]`
   - Cafes: `["amenity"="cafe"]`
   - Bars/Pubs: `["amenity"="bar"]` or `["amenity"="pub"]`
   - Breweries: `["craft"="brewery"]` or `["microbrewery"="yes"]`
   - Hotels: `["tourism"="hotel"]`
   - Shops: `["shop"="*"]`
   - Use `(around:METERS,LAT,LNG)` for radius queries
   - Use `(south,west,north,east)` for bounding box queries

2. **Run via curl:**
   ```bash
   curl -s -X POST -d '[out:json][timeout:30];(node["amenity"="restaurant"](30.25,-97.76,30.29,-97.73);way["amenity"="restaurant"](30.25,-97.76,30.29,-97.73););out center;' \
     https://overpass-api.de/api/interpreter > /tmp/osm_raw.json
   ```

3. **Convert to GeoJSON with Python** (inline, no packages needed). Normalize OSM tags:
   - `tags.name` -> `name` (REQUIRED — skip features with no name)
   - `tags.cuisine` -> `cuisine`
   - `tags.addr:street` + `tags.addr:housenumber` -> `address`
   - `tags.phone` -> `phone`
   - `tags.website` or `tags.contact:website` -> `website`
   - `tags.opening_hours` -> `hours`
   - For ways, use `center.lat` / `center.lon` (from `out center`)

4. **Write to `data.geojson`** in this folder.

5. **Verify against Austin Food Inspections API** (Austin-area maps only — see Verification section below).

6. **Update `config.js`** (see CONFIG Reference below).

7. **Commit and push to `main`.** The site updates via GitHub Pages within ~2 minutes.

### Workflow 2: User Provides GeoJSON

When the user gives a GeoJSON file (pasted, uploaded, or via URL):

1. **Inspect the feature properties** to determine filters, columns, popup fields, center, and zoom.
2. **Write to `data.geojson`** (clean up if needed — ensure valid GeoJSON, consistent properties).
3. **Update `config.js`**.
4. **Commit and push to `main`.**

## CONFIG Reference

The `config.js` file is the ONLY code file that changes between deployments (along with `data.geojson`). Here's what each field does:

```js
const CONFIG = {
  // Page text — shown in the header
  title: "Restaurant Map",           // <h1> and browser tab title
  eyebrow: "EAST AUSTIN",            // Small uppercase label above title
  subtitle: "Local dining options.",  // Gray text below title

  // Map defaults — where the camera starts
  center: [-97.7431, 30.2672],       // [longitude, latitude]
  zoom: 13,                          // 10=city, 13=neighborhood, 16=block
  pitch: 45,                         // 0=flat, 60=steep 3D
  bearing: -15,                      // Camera rotation in degrees
  markerColor: "#e63946",            // Hex color for map pins

  // Which GeoJSON property is the display name
  nameField: "name",

  // Filters — each creates a dropdown. Only include properties with
  // useful variation (2-8 unique values). Don't filter on free-text fields.
  filters: [
    { property: "cuisine",  label: "Cuisine" },
    { property: "price",    label: "Price Range" }
  ],

  // Table columns — what shows in the data table below the map
  columns: [
    { property: "name",     header: "Name" },
    { property: "cuisine",  header: "Cuisine" },
    { property: "address",  header: "Address" },
    { property: "phone",    header: "Phone" }
  ],

  // Popup fields — detail rows shown when clicking a pin (name is always the title)
  popupFields: [
    { property: "cuisine",  label: "Cuisine" },
    { property: "address",  label: "Address" },
    { property: "phone",    label: "Phone" },
    { property: "hours",    label: "Hours" }
  ]
};
```

**Rules for CONFIG:**
- Every `property` value MUST exist in the GeoJSON feature properties
- `nameField` should point to the best human-readable name
- Only use properties with 2-8 unique values as filters (not free-text like address)
- Popups automatically include Google Maps / Apple Maps / Waze nav buttons — no config needed
- `center` should be the geographic center of the data points
- Set `zoom` based on data spread: tight cluster = 15, whole city = 12, metro area = 10

## Business Verification — Austin Food Inspections

After generating GeoJSON from OSM, cross-reference each place against the City of Austin's Food Establishment Inspection Scores dataset. This is free, has an API, and is the most reliable open signal that a food business is currently operating in Austin.

**API endpoint:** `https://data.austintexas.gov/resource/ecmv-9xxi.json`

**Fields returned:** `restaurant_name`, `address`, `zip_code`, `score`, `inspection_date`, `facility_id`, `process_description`

**How to search by name (use urlencode, not manual % encoding):**
```python
import urllib.request, urllib.parse, json

def soda_query(where_clause, limit=10):
    params = {'$where': where_clause, '$limit': limit, '$order': 'inspection_date DESC'}
    url = 'https://data.austintexas.gov/resource/ecmv-9xxi.json?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

# Example
results = soda_query("restaurant_name like '%Juan%Million%'")
# Returns: restaurant_name, address, score, inspection_date, etc.
```

**Search strategies (try in order):**
1. Two-keyword name search: `restaurant_name like '%Word1%' and restaurant_name like '%Word2%'`
2. Single keyword from name: `restaurant_name like '%UniqueWord%'`
3. Address: `address like '%StreetNumber%StreetName%'`

**What to do with results:**

| Situation | Action |
|-----------|--------|
| Good name+address match, recent score (< 18 months) | Add `inspection_score` and `inspection_date` to GeoJSON properties |
| Match found but score is old (> 18 months) | Add score but note it's old; flag for manual review |
| No match found | Set `inspection_score: null` — possible reasons: closed, recently opened, different legal name, or data gap |
| User confirms a place is closed | Remove from GeoJSON entirely |

**Add these to GeoJSON properties and CONFIG popupFields:**
```js
// In GeoJSON feature properties:
"inspection_score": 85,           // integer or null
"inspection_date": "2025-07-10"   // YYYY-MM-DD string or null

// In CONFIG popupFields — the showPopup() function skips null values automatically:
{ property: "inspection_score", label: "Health Score" },
{ property: "inspection_date",  label: "Inspected" }
```

**Popup rendering:** The `showPopup()` function already filters out null/empty values, so places without scores simply won't show those rows. Scores are displayed as `85/100`.

**Important caveats:**
- No match ≠ definitely closed. Some legitimate open restaurants are missing from the dataset (out-of-date, different legal name, etc.)
- Chain locations (Taco Bell, Chipotle) may not match if inspected under a franchise ID
- Zip codes in the dataset include 4-digit extensions (e.g., `78702-1234`) — don't filter by zip, search by name instead
- Rate limit: keep ~0.3s between API calls

**For non-Austin maps:** Use Google Places API (`business_status` field) or Yelp Fusion API (`is_closed` field) instead.

## GeoJSON Format

`data.geojson` must be a valid GeoJSON FeatureCollection with Point geometry:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Example Place",
        "cuisine": "Mexican",
        "address": "123 Main St",
        "phone": "(512) 555-0100"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-97.7431, 30.2672]
      }
    }
  ]
}
```

**Important:** Coordinates are `[longitude, latitude]` (NOT lat, lng).

## Creating a New Customer Folder

To create a map for a new customer:
1. Copy this entire folder to `apps/new-folder-name/`
2. Replace `data.geojson` with the new data
3. Update `config.js` with new titles, center, filters, columns, popupFields
4. `index.html`, `style.css`, and `app.js` stay unchanged

## Git Workflow

- Always push to `main` branch directly (GitHub Pages deploys from `main`)
- Do NOT create feature branches — changes should go live immediately
- Commit message format: `Update [folder] with [description of data]`

## Common Issues

- **Buildings not showing:** Zoom must be >= 13 for 3D extrusions to appear
- **Empty filters:** The property name in CONFIG doesn't match the GeoJSON properties (case-sensitive)
- **Markers not visible:** Check that GeoJSON coordinates are `[lng, lat]` not `[lat, lng]`
- **Overpass returns empty:** Check OSM tag spelling at https://taginfo.openstreetmap.org/
