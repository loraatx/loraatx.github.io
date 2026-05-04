# apps/productreports

This folder powers the **Product Intelligence Reports** — interactive map apps, story maps, and written reports. Each topic lives at its own URL slug and is built from the same modular template.

## Folder structure

```
apps/productreports/
  {slug}/           ← one map app per topic (e.g. austin-bike-shops/)
  storymaps/
    {slug}/         ← one story map per topic
    reports.json    ← registry that drives homepage cards
  staging/          ← drop CSV + MD here to trigger a new report build
  template/         ← canonical source files (never edit directly)
```

## Files that differ per app

Everything else is copied unchanged from `template/`. Only these two files are customized:

| File | Purpose |
|------|---------|
| `config.js` | Title, theme, map center, filters, columns, popup fields |
| `data.geojson` | Location data for the topic |

For each storymap, only `story.json` is customized (slide content and map stops).

---

## Staging workflow — creating a new Product Report

Place two files in `apps/productreports/staging/`:

1. **`data.csv`** — location rows exported from your research (must include lat/lon columns or an address column)
2. **`report.md`** — the full Perplexity research report in Markdown

Then tell Claude: *"Build the new Product Report from staging."*

Claude will:

1. **Convert** `data.csv` → `data.geojson` (geocoding addresses if needed)
2. **Create the map app** at `apps/productreports/{slug}/` by copying `template/` and configuring `config.js` to match the CSV columns
3. **Create the story map** at `apps/productreports/storymaps/{slug}/` by copying `storymaps/template/` and populating `story.json` from the report content
4. **Generate the HTML report** at `apps/productreports/storymaps/{slug}/report.html` by converting `report.md` to match the existing report style (Georgia serif, footnotes, nav bar linking back to the map app)
5. **Register the report** by adding an entry to `apps/productreports/storymaps/reports.json` so the card appears on the homepage
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
  "href": "/apps/productreports/storymaps/{slug}/report.html",
  "accent": "#hexcolor"
}
```
