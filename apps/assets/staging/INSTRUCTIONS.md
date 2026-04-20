# Staging Build Instructions

Drop this file into any new staging folder alongside the `.md` report and `.csv` data file.
Tell Claude: **"build the 3 products and update the homepage"** — it will follow this document.

---

## Inputs (in this folder)

| File       | Role                                                          |
|------------|---------------------------------------------------------------|
| `*.md`     | Largest .md that isn't this file → report body               |
| `*.csv`    | Data rows; must have `latitude` and `longitude` columns       |

---

## Slug

Derive from the staging **folder name**: lowercase, spaces → hyphens.
Example: `AustinVintageGuitar` → `austin-vintage-guitar`

---

## Step 1 — Build GeoJSON

Convert the CSV to GeoJSON. Each row with valid lat/lng becomes a Point feature.
- `geometry.coordinates` = `[longitude, latitude]`
- All other columns become `properties`
- If no categorical column exists, derive one (e.g. `shop_type`, `venue_type`) from the description column; aim for 3–7 distinct values

Write the same file to two locations:
- `apps/citywide/<slug>/data.geojson`
- `storymaps/<slug>/data/<slug>.geojson`

---

## Step 2 — Citywide App

**Copy these frozen files** from `apps/citywide/austin-bike-shops/` into `apps/citywide/<slug>/`:
`app.js`, `style.css`, `index.html`, `favicon.png`, `favicon.svg`, `CLAUDE.md`

**Edit `index.html`**: change only the `<title>` tag to the report title.

**Write `config.js`** — only these fields change per deployment:

```
title, eyebrow, subtitle, infoPanelText
center          ← mean of all [lng, lat] coordinates, rounded to 3 decimals
markerColor     ← pick a color that fits the subject
markerIconStyle ← "pin" (default)
nameField       ← the one property that is unique per row and looks like a name
filters         ← max 3; only categorical properties with 2–12 distinct values
columns         ← max 5; name + address + up to 3 other useful fields
popupFields     ← max 9; anything worth displaying (incl. phone, notes, description)
```

Keep all other fields (maxBounds, overlays, features, socialLinks, redditCity, zoom, pitch, bearing) exactly as in the source `config.js`.

---

## Step 3 — Storymap

**Copy these frozen files** from `storymaps/austin-bike-shops/` into `storymaps/<slug>/`:
`engine.js`, `ui.js`, `style.css`, `index.html`

The copied `index.html` already loads `story.json` by relative path — no edits needed.

**Write `story.json`** with 7 scenes:

1. **overview** — wide city view; popup summarises the dataset (count, highlights); link → the citywide app
2–6. **one scene per notable feature** — fly to each location; popup title = shop/venue name, subtitle = address, body = 2–3 sentence description from the report, stats = 3 key facts; link → citywide app "Filter the map →"
7. **closing** — fly back to city overview; popup names any remaining features not spotlighted; link → `report.html`

Layer config: `circle-opacity: 0`, `transitionOpacity: 0.95`, color matches `markerColor` from config.js.

---

## Step 4 — Report

Run from the repo root:

```bash
python3 scripts/build-report.py \
  --markdown assets/staging/<FolderName>/<file>.md \
  --out storymaps/<slug>/report.html \
  --title "<Full Report Title>" \
  --subtitle "<One-line subtitle>" \
  --slug <slug>
```

The `--slug` flag auto-generates the nav links to the app and storymap.

---

## Step 5 — Update Homepage

Append one entry to `storymaps/reports.json`:

```json
{
  "id": "<slug>",
  "category": "Shopping",
  "title": "<Full Report Title>",
  "eyebrow": "Austin Shopping · Report",
  "blurb": "<One sentence, ~15 words>",
  "href": "/storymaps/<slug>/report.html",
  "accent": "<same hex as markerColor>"
}
```

Set `"category"` to whichever fits: `"Shopping"`, `"Recreation"`, or `"City Government"`.

---

## Step 6 — Commit & Push

```bash
git add apps/citywide/<slug>/ storymaps/<slug>/ storymaps/reports.json
git commit -m "Deploy <slug>: app, storymap, and report"
git push -u origin <current-branch>
```

Then merge the branch into `main` and push `main`.

---

## Quick-reference: file sources

| Output file                              | Source                                    |
|------------------------------------------|-------------------------------------------|
| `apps/citywide/<slug>/app.js`            | copy from `apps/citywide/austin-bike-shops/` |
| `apps/citywide/<slug>/style.css`         | copy from `apps/citywide/austin-bike-shops/` |
| `apps/citywide/<slug>/index.html`        | copy + change `<title>` only              |
| `apps/citywide/<slug>/config.js`         | write fresh per Step 2                    |
| `apps/citywide/<slug>/data.geojson`      | generated in Step 1                       |
| `storymaps/<slug>/engine.js`             | copy from `storymaps/austin-bike-shops/`  |
| `storymaps/<slug>/ui.js`                 | copy from `storymaps/austin-bike-shops/`  |
| `storymaps/<slug>/style.css`             | copy from `storymaps/austin-bike-shops/`  |
| `storymaps/<slug>/index.html`            | copy (no edits needed)                    |
| `storymaps/<slug>/story.json`            | write fresh per Step 3                    |
| `storymaps/<slug>/data/<slug>.geojson`   | generated in Step 1                       |
| `storymaps/<slug>/report.html`           | generated in Step 4 via build-report.py   |
