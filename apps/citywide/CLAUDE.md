# Citywide Template — Deployment Instructions

## What to do
1. Copy `apps/citywide/` to `apps/<folder_name>/`
2. In the new folder, edit **only** `config.js`, `index.html` `<title>`, and `data.geojson`
3. **Do NOT modify** `app.js` or `style.css`

## Step 1: Copy
```
cp -r apps/citywide/ apps/<folder_name>/
```

## Step 2: config.js
Map every spec field to its config key. Coordinates are always `[lng, lat]`.

| Spec field | config.js key | Format |
|---|---|---|
| title | `title` | string |
| eyebrow | `eyebrow` | string |
| subtitle | `subtitle` | string |
| info_panel_text | `infoPanelText` | string |
| center_lng, center_lat | `center: [lng, lat]` | **lng first** |
| zoom | `zoom` | number |
| pitch | `pitch` | number |
| bearing | `bearing` | number |
| marker_color | `markerColor` | hex string |
| bounds_sw/ne | `maxBounds: [[sw_lng, sw_lat],[ne_lng, ne_lat]]` | **lng first** each pair |
| name_field | `nameField` | string |
| reddit_city | `redditCity` | string |
| google_maps_api_key | `googleMapsApiKey` | string |
| filter_N | `filters: [{ property, label }]` | skip blanks |
| column_N | `columns: [{ property, header }]` | skip blanks |
| popup_N | `popupFields: [{ property, label }]` | skip blanks |
| overlay_N | `overlays: [{ label, file, colorProperty }]` | skip blanks |
| UI flags (Yes/No) | `features: { drawTools, measure, exportPNG, exportCSV, reportPDF, streetView, satellite, topo, darkMode, geolocation }` | true/false |
| social links | `socialLinks: [{ platform, url }]` | empty string hides icon |

## Step 3: index.html
Change only `<title>` to match the spec title.

## Step 4: data.geojson
Replace with provided GeoJSON. Must be `FeatureCollection` with `Point` features, coords `[lng, lat]`.

## Step 5: Verify
- Config values match spec; no placeholders left
- Property names in filters/columns/popups match GeoJSON keys
- Bounds are `[lng, lat]` not `[lat, lng]`
- `app.js` and `style.css` unchanged

## Step 6: Commit & Push
```
git add apps/<folder_name>/
git commit -m "Deploy <title> map app"
git push -u origin <branch>
```

Live at `anatomy.city/apps/<folder_name>/`

## Data notes
- Instagram handles: store without `@` (app auto-links)
- URLs: store full `https://...` (app auto-links)
- Empty `googleMapsApiKey`: Street View tab shows fallback link
