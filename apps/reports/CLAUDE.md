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
  staging/          ← drop files here to trigger a new report build (see staging/PROMPT.md)
  template/         ← canonical source files (never edit directly)
    storymap/       ← canonical storymap source files
      report-template.html  ← HTML shell with {{TOKEN}} placeholders; filled in at build time
```

**To create a new report:** copy any existing `{slug}/` folder, rename it, then edit only `config.js`, `data.geojson`, and `storymap/story.json`. Everything else is drop-in identical.

## Files that differ per app

Everything else is copied unchanged from `template/`. Only these two files are customized:

| File | Purpose |
|------|--------|
| `config.js` | Title, theme, map center, filters, columns, popup fields |
| `data.geojson` | Location data for the topic |

For each storymap, only `story.json` is customized (slide content and map stops).

---

## Storymap standard — 3 scenes, always

Every storymap follows the same 3-scene structure. Only the camera coordinates and popup content change between reports.

### Scene 1 — Opening overview (promo video)
- `duration`: 11000, `loop`: true, `speed`: 0.55
- Camera: city-wide overview (zoom ~10.5, pitch 30, bearing -10)
- Popup: **local video only** — exactly this shape, nothing else:
  ```json
  "popup": {
    "lngLat": [LNG, LAT],
    "anchor": "bottom",
    "video": { "src": "promo.mp4" }
  }
  ```
  Do NOT add `title`, `subtitle`, `body`, `stats`, `youtube`, or `link` to scene 1 — the engine only plays one popup type per scene and extra keys cause a black-box error.

### Scene 2 — Location highlight
- Camera: fly close to a featured location (zoom 14–16, pitch 50–55)
- Popup: title, subtitle (address), **`image`: always `{ "src": "image2.png", "alt": "<location name>", "caption": "<one-line description>" }`**, `body` (3 sentences of context), `stats` table, `link` back to report
- `image2.png` is always the photo of `featured_location_1` (scene 2 subject) — copy it from staging alongside the other images

### Scene 3 — Closing CTA
- Camera: fly back to city-wide overview (same coords as scene 1)
- Popup `image`: use `../../template/siteimage.png` as a placeholder until a custom preview image is ready
- Popup `links`: report + map links

### story.json popup field reference

| Field | Renders as |
|-------|----------|
| `video` | `{ src }` — plays local mp4 fullscreen in popup; **scene 1 only, no other fields** |
| `body` | Up to 3 bullet points (split by sentence-ending punctuation) |
| `image` | `{ src, alt, caption }` — full-width image above body |
| `stats` | `[{ label, value }]` — two-column table |
| `link` | `{ href, text }` — single CTA button at the bottom |
| `links` | `[{ href, text }]` — multiple CTA buttons (closing scene) |

---

## Staging workflow — creating a new Product Report

See `staging/PROMPT.md` for the Perplexity prompt to generate standardized input.

Place these files in `apps/reports/staging/` before triggering a build:

| File | Contents |
|------|----------|
| `report.md` | Perplexity output — front-matter block + Markdown body + `---CSV---` + CSV rows |
| `data.csv` | CSV rows extracted from `report.md` (same data, separate file for easy import) |
| `image1.png` | Topic/category hero photo |
| `image2.png` | Photo of `featured_location_1` |
| `image3.png` | Photo of `featured_location_2` |

Then tell Claude: *"Build the new Product Report from staging."*

### What Claude does — zero rewrite, mechanical conversion

1. **Parse** `report.md` — split on `---CSV---`; extract front-matter (`title`, `subtitle`, `category`, `accent`, `slug`, `featured_location_1`, `featured_location_2`, `stats`)
2. **Convert** Markdown body → HTML mechanically (h2→`<h2>`, `[n]`→`<sup>`, tables→`<table>`, etc.) — **no rewording**
3. **Insert images** into converted HTML: `image1.png` goes in hero; `image2.png` / `image3.png` are inserted as floated figures inside the `<h3>` sections matching `featured_location_1` / `featured_location_2`
4. **Build scoreboard HTML** from the `stats:` front-matter list
5. **Fill** `template/storymap/report-template.html` — substitute `{{TITLE}}`, `{{SUBTITLE}}`, `{{ACCENT}}`, `{{SLUG}}`, `{{SCOREBOARD_HTML}}`, `{{BODY_HTML}}`, `{{REFS_HTML}}`
6. **Copy images** `image1.png`, `image2.png`, `image3.png` → `apps/reports/{slug}/storymap/`
7. **Write** `apps/reports/{slug}/storymap/report.html`
8. **Convert** CSV → GeoJSON (lat/lng → Point geometry; all other columns → properties)
9. **Copy** `template/` → `apps/reports/{slug}/`; write `data.geojson`
10. **Write** `config.js` using the GeoJSON property profile rubric (see rules below)
11. **Write** `story.json` (3-scene standard: intro video → location highlight → closing CTA)
12. **Add** entry to `reports.json`
13. **Clear** staging — delete `report.md`, `data.csv`, `image1.png`, `image2.png`, `image3.png`
14. **Commit and push** to main

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
