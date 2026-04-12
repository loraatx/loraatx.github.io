# Citywide Deployment Spec

> **Template:** `apps/templates/citywide/` — Metro-scale map (zoom 9–12, city/region bounds)
> **Deploys to:** `apps/citywide/<folder_name>/`
> **To deploy:** Fill in every section below, place `data.geojson` in the folder, and hand this file to Claude.

---

## Deploy
```
folder_name:
template: citywide
```

---

## Identity
```
title:             # page title shown in the header bar
eyebrow:           # small caps label above the title (e.g. Austin Metro)
subtitle:          # one-line description shown below the filters
info_panel_text:   # paragraph shown in the ⓘ flyout (can be left blank)
```

---

## Map View
```
center_lat: 30.267    # starting latitude
center_lng: -97.743   # starting longitude
zoom: 10              # 9=city  10=metro  11=district  12=neighborhood
pitch: 45             # tilt: 0=flat  45=angled  60=steep
bearing: -15          # rotation in degrees (0 = north up)
marker_color: #2d7a1a # pin/icon fill color (hex)
marker_icon: golf     # icon shape: golf | drop (water/pool) | pin (simple dot)
```

## Map Bounds  *(locks scroll/zoom to this box — defaults cover Greater Austin metro)*
```
bounds_sw_lat: 29.97
bounds_sw_lng: -98.04
bounds_ne_lat: 30.62
bounds_ne_lng: -97.47
```

---

## Data
```
name_field:               # GeoJSON property used as the feature name (e.g. Pool Name)
reddit_city: Austin
google_maps_api_key:      # leave blank — Street View shows a fallback link
```

---

## Filters  *(format: `GeoJSON property name | Dropdown label`)*
*Use categorical fields with ≤12 unique values. Skip URL/phone/name/mostly-null fields.*
```
filter_1:
filter_2:
filter_3:
filter_4:
filter_5:
```
**Examples:** `Status | Status`   `Pool Type | Size`   `District | Council District`

---

## Table Columns  *(format: `GeoJSON property name | Column header`)*
*4–6 columns work best. First column is usually the name field.*
```
column_1:
column_2:
column_3:
column_4:
column_5:
column_6:
column_7:
column_8:
```

---

## Popup Fields  *(format: `GeoJSON property name | Row label`)*
*Include everything a user might want — phone, website, hours, address, etc.*
```
popup_1:
popup_2:
popup_3:
popup_4:
popup_5:
popup_6:
popup_7:
popup_8:
```

---

## Overlay Layers  *(shared polygon layers — edit or leave defaults)*
```
overlay_1_label: Zip Codes
overlay_1_file: ../../shared/SecondData.geojson
overlay_1_color_property: zipcode

overlay_2_label: Flood Zone
overlay_2_file: ../../shared/floodzone.geojson
overlay_2_color_property: flood_zone

overlay_3_label: City Council
overlay_3_file: ../../shared/Council_Districts.geojson
overlay_3_color_property: district_name

overlay_4_label:
overlay_4_file:
overlay_4_color_property:

overlay_5_label:
overlay_5_file:
overlay_5_color_property:
```

---

## Theme  *(leave blank to keep the default green — Google Font names only)*
```
header_bg:           # header bar color      default: #1a4d0e (dark green)
page_bg:             # page background color  default: #e4ede0 (light green-gray)
font_heading: Oswald # display/title font     any Google Font name
font_body: Barlow    # body/data font         any Google Font name
```
*Changing a font: just write the Google Font name (e.g. `Montserrat`, `Roboto Condensed`).
The font will be loaded from Google Fonts automatically at runtime.*

---

## UI Elements  *(Yes / No)*

### Header
- Header Title Bar: Yes
- Info Panel (i button): Yes
- 2D/3D View Toggle: Yes
- Dark Mode Toggle: Yes

### Map Controls
- Satellite Imagery Toggle: Yes
- Topo Overlay Toggle (contour lines + terrain bump): Yes
- Buildings Toggle: Yes
- Geolocation Button: Yes
- Layers Panel (polygon overlays): Yes

### Toolbar
- Draw Tool (freehand line): Yes
- Clear Drawing Button: Yes
- Measure Tool (distance in miles): Yes
- Export Map PNG Button: Yes
- Report PDF Button: Yes

### Table & Data
- Filter Dropdowns: Yes
- Data Table: Yes
- Export CSV Button: Yes
- Result Count: Yes

### Popups
- Info Tab (field detail rows): Yes
- Second Tab (placeholder): Yes
- Google Maps Nav Button: Yes
- Apple Maps Nav Button: Yes
- Waze Nav Button: Yes
- Reddit Search Button: Yes
- Street View Embed: Yes

### Footer
- Social Links Bar: Yes

---

## Social Links  *(leave blank to hide icon)*
```
youtube:
x:
facebook:
instagram:
reddit:
patreon:
discord:
```

---

## Field Handling Reference

Property names in `filters`, `columns`, and `popups` must match GeoJSON keys **exactly** — spaces and capitalization count (`Pool Name` not `pool_name`).

**Filters** — categorical fields with ≤12 unique values only.
Good: status, type, zone, district, year, category.
Skip: names (unique per row), URLs, phone numbers, long text, mostly-null fields, raw coordinates.

**Columns** — short values that fit a table cell. Usually name + 3–4 categorical fields. Skip long URLs or long text descriptions.

**Popups** — include everything a user might want when clicking a pin: phone, website, hours, address. Don't repeat the name field (it's in the popup header). Skip latitude/longitude (already shown on the map).

**Null handling** — fields that are mostly null are fine in popups but bad as filters (the dropdown becomes useless).

**Worked example (Austin Pool Openings — 13 raw properties → 3 filters / 5 columns / 9 popup rows):**
See `apps/citywide/PoolOpenings/config.js`

---

## Notes
