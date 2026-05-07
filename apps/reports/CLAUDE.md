# apps/reports

This folder powers the **Product Intelligence Reports** — interactive map apps, story maps, and written reports. Each topic lives at its own URL slug and is built from the same modular template.

## Folder structure

```
apps/reports/
  {slug}/           ← one self-contained report folder per topic
    index.html      ← interactive map app (copied from template/)
    config.js       ← only file that changes per topic (map config)
    data.geojson    ← only file that changes per topic (location data)
    app.js, style.css, favicon.*, siteimage.png  ← copied unchanged
    storymap/       ← narrative story map for this topic
      index.html, engine.js, ui.js, style.css  ← copied unchanged
      story.json    ← only file that changes (scenes, camera, popups)
      report.html   ← written HTML report
      data/         ← GeoJSON files for the storymap layers
  reports.json      ← registry that drives homepage cards
  staging/          ← drop CSV + MD here to trigger a new report build
  template/         ← canonical source files (never edit directly)
    storymap/       ← canonical storymap source files
```

**To create a new report:** copy any existing `{slug}/` folder, rename it, then edit only `config.js`, `data.geojson`, and `storymap/story.json`. Everything else is drop-in identical.

## Files that differ per app

Everything else is copied unchanged from `template/`. Only these two files are customized:

| File | Purpose |
|------|---------|
| `config.js` | Title, theme, map center, filters, columns, popup fields |
| `data.geojson` | Location data for the topic |

For each storymap, only `story.json` is customized (slide content and map stops).

---

## Storymap standard — 3 scenes, always

Every storymap follows the same 3-scene structure. Only the camera coordinates and popup content change between reports.

### Scene 1 — Opening overview
- Camera: city-wide overview (zoom ~10, pitch 30)
- Popup: promo video (`promo.mp4`) — no text popup

### Scene 2 — Location highlight
- Camera: fly close to a featured location (zoom 14–16, pitch 50–55)
- Popup: title, subtitle (address), `body` (3 sentences of context), `stats` table, `link` back to map app

### Scene 3 — Closing CTA
- Camera: fly back to city-wide overview (same as scene 1)
- Popup `image`: use `../../template/siteimage.png` as a placeholder until a custom preview image is ready
- Popup `links`: purchase/report links (href can be empty until URLs are set)

### story.json popup field reference

| Field | Renders as |
|-------|-----------|
| `body` | Up to 3 bullet points (split by sentence-ending punctuation) |
| `image` | `{ src, alt, caption }` — full-width image above body |
| `stats` | `[{ label, value }]` — two-column table |
| `link` | `{ href, text }` — CTA button at the bottom |

---

## Staging workflow — creating a new Product Report

Place two files in `apps/reports/staging/`:

1. **`data.csv`** — location rows exported from your research (must include lat/lon columns or an address column)
2. **`report.md`** — the full Perplexity research report in Markdown

Then tell Claude: *"Build the new Product Report from staging."*

Claude will:

1. **Convert** `data.csv` → `data.geojson` (geocoding addresses if needed)
2. **Create the map app** at `apps/reports/{slug}/` by copying `template/` and configuring `config.js` to match the CSV columns
3. **Create the story map** at `apps/reports/{slug}/storymap/` by copying `template/storymap/` and writing `story.json` using the 4-scene standard defined above (overview → location 1 → location 2 → closing CTA with siteimage placeholder)
4. **Generate the HTML report** at `apps/reports/{slug}/storymap/report.html` by converting `report.md` to match the existing report style (Georgia serif, footnotes, nav bar linking back to the map app)
5. **Register the report** by adding an entry to `apps/reports/reports.json` so the card appears on the homepage
6. **Clear staging** — remove the CSV and MD files

### Slug convention

Use lowercase kebab-case matching the topic, e.g. `austin-coffee-shops`, `austin-food-trucks`.

### reports.json entry shape

```json
{
  "id": "{slug}",
  "category": "Shopping | Recreation | City Government",
  "title": "Full report title",
  "eyebrow": "Austin Metro · Report",
  "blurb": "One-sentence description for the homepage card.",
  "href": "/apps/reports/{slug}/storymap/report.html",
  "accent": "#hexcolor"
}
```
