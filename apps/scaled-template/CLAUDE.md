# DEPLOYMENT INSTRUCTIONS (for Claude Sonnet)

## What You're Doing
Deploying a new map app from a filled-out SPEC file.
You will: copy the template folder, fill in `config.js`, drop in `data.geojson`, commit, and push.

**FROZEN FILES — DO NOT MODIFY:**
- `app.js`
- `style.css`

**FILES YOU EDIT:**
- `config.js` — fill in all values from the SPEC
- `index.html` — update only the `<title>` tag text
- `data.geojson` — replace with the deployment's data

---

## Step 1: Create the App Folder

Copy the entire `apps/coffee-shops/` directory to `apps/<folder_name>/`:
```
cp -r apps/coffee-shops/ apps/<folder_name>/
```
(`folder_name` comes from SPEC field `folder_name:`)

---

## Step 2: Update `config.js`

Use the field-mapping table below. Every SPEC field maps to exactly one CONFIG key.

### Field Mapping Table

| SPEC field               | `config.js` key         | Notes |
|--------------------------|-------------------------|-------|
| `title`                  | `title`                 | |
| `eyebrow`                | `eyebrow`               | |
| `subtitle`               | `subtitle`              | |
| `info_panel_text`        | `infoPanelText`         | |
| `center_lat` + `center_lng` | `center: [lng, lat]` | **lng FIRST, then lat** |
| `zoom`                   | `zoom`                  | number |
| `pitch`                  | `pitch`                 | number |
| `bearing`                | `bearing`               | number |
| `marker_color`           | `markerColor`           | hex string, e.g. `"#1a73e8"` |
| `bounds_enabled: true`   | `maxBounds: [[sw_lng, sw_lat], [ne_lng, ne_lat]]` | lng before lat in each pair |
| `bounds_enabled: false`  | `maxBounds: null`       | |
| `reddit_city`            | `redditCity`            | string |
| `google_maps_api_key`    | `googleMapsApiKey`      | string |
| `name_field`             | `nameField`             | |
| `filter_N_property` + `filter_N_label` | entry in `filters: []` array | skip if property is blank |
| `column_N` (format: `prop \| Header`) | entry in `columns: []` array | skip if blank |
| `popup_N` (format: `prop \| Label`) | entry in `popupFields: []` array | skip if blank |
| `overlay_N_label` + `overlay_N_file` + `overlay_N_color_property` | entry in `overlays: []` array | skip if label is blank |
| `draw_tools: false`      | `features.drawTools: false` | |
| `measure: false`         | `features.measure: false` | |
| `export_png: false`      | `features.exportPNG: false` | |
| `export_csv: false`      | `features.exportCSV: false` | |
| `report_pdf: false`      | `features.reportPDF: false` | |
| `street_view: false`     | `features.streetView: false` | |
| `satellite: false`       | `features.satellite: false` | |
| `topo: false`            | `features.topo: false` | |
| `dark_mode: false`       | `features.darkMode: false` | |
| `geolocation: false`     | `features.geolocation: false` | |
| `youtube` url            | `socialLinks[0].url`    | leave `""` if blank |
| `x` url                  | `socialLinks[1].url`    | leave `""` if blank |
| `facebook` url           | `socialLinks[2].url`    | leave `""` if blank |
| `instagram` url          | `socialLinks[3].url`    | leave `""` if blank |
| `reddit` url             | `socialLinks[4].url`    | leave `""` if blank |
| `patreon` url            | `socialLinks[5].url`    | leave `""` if blank |
| `discord` url            | `socialLinks[6].url`    | leave `""` if blank |

### Bounds Conversion Example
SPEC input:
```
bounds_sw_lat: 30.250   bounds_sw_lng: -97.745
bounds_ne_lat: 30.265   bounds_ne_lng: -97.732
```
Becomes in `config.js`:
```js
maxBounds: [[-97.745, 30.250], [-97.732, 30.265]]
//           ^^lng first^^      ^^lng first^^
```

### `overlays` Array Example
SPEC:
```
overlay_1_label:           Zip Codes
overlay_1_file:            ../shared/SecondData.geojson
overlay_1_color_property:  zipcode
```
Becomes:
```js
overlays: [
  { label: "Zip Codes", file: "../shared/SecondData.geojson", colorProperty: "zipcode" },
],
```

---

## Step 3: Update `index.html`

Only change the `<title>` tag:
```html
<title>My Map Title</title>
```

---

## Step 4: Replace `data.geojson`

- If SPEC has `data_file:` → copy that file to `apps/<folder_name>/data.geojson`
- If SPEC has `data_geojson:` → write the pasted JSON to `apps/<folder_name>/data.geojson`

Ensure the GeoJSON structure is:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [lng, lat] },
      "properties": { "name": "...", ... }
    }
  ]
}
```
Coordinates are `[longitude, latitude]` — longitude first.

---

## Step 5: Verify

Before committing, check:
- [ ] `config.js` — all SPEC values filled in; no leftover placeholder text
- [ ] `data.geojson` — valid JSON; features have `geometry.type: "Point"`
- [ ] Property names in `filters`, `columns`, `popupFields` match actual GeoJSON property keys
- [ ] `maxBounds` coordinates are `[lng, lat]` pairs (not `[lat, lng]`)
- [ ] `app.js` and `style.css` are unchanged (run `git diff apps/<folder_name>/app.js` — should be empty)

---

## Step 6: Commit and Push

```bash
git checkout -b deploy/<folder_name>
git add apps/<folder_name>/
git commit -m "Deploy <title> map app"
git push -u origin deploy/<folder_name>
```

---

## Step 7: Done

The app goes live at `anatomy.city/apps/<folder_name>/` after GitHub Pages deploys (usually ~1 minute).

---

## Notes for Common Data Patterns

**Instagram handles** — store as plain string without `@` (e.g. `"epochcoffee"`). The app auto-generates `@epochcoffee` links.

**Website URLs** — store as full URL (e.g. `"https://example.com"`). The app auto-links any string starting with `http`.

**Health inspection scores** — use property name `inspection_score` with a numeric value. The app renders it as a colored badge (green ≥90, yellow ≥70, red <70).

**No Street View key** — leave `googleMapsApiKey: ""`. The Street View tab will show a fallback "Open in Google Maps" link instead.
