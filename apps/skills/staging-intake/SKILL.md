---
name: staging-intake
description: |
  Use this skill when the user asks Claude to "process staging," "deploy from
  staging," or otherwise turn the contents of `assets/staging/` into published
  site content. The skill orchestrates a Perplexity-style deep-research drop
  (markdown report + a CSV/GeoJSON of features + an optional `note.md`
  system prompt) into THREE outputs: a citywide app, a storymap, and a
  print-friendly `report.html` — and wires them into the site navigation.
---

# Staging-intake skill

## When this fires

The user has dropped files into `assets/staging/` and wants you to publish them.
Phrases that should trigger this skill:

- "process staging"
- "deploy staging"
- "build the staging stuff"
- "do the staging workflow"

## What's in the box

`assets/staging/` always contains:

| File              | Role                                                                            |
|-------------------|---------------------------------------------------------------------------------|
| `note.md`         | **System prompt** — front-matter (slug, title, marker color, etc.) + freeform notes. |
| One large `*.md`  | The deep-research **report body** (rendered to `report.html`, mined for scenes).   |
| One `*.csv`       | Pre-geocoded structured data (`latitude`/`longitude` columns required).             |
| One `*.geojson`   | Pre-built FeatureCollection (alternative to CSV; preferred if both present).        |
| Optional images   | Embedded in storymap popups / used as report cover.                                 |
| `staging plan.md` | The plan that produced this skill — informational only, ignore as input.            |

## Pipeline (in order)

### 1 — Triage

Run `python scripts/staging_intake.py triage`. The JSON output gives you:

- `front_matter` (parsed `note.md` YAML head)
- `slug`, `report_md`, `data_file`, `data_kind`, `images`, `produce`

If `slug` is null or there's no `report_md` or `data_file`, **stop and ask the
user**.

### 2 — Build the app  (skip if `app` not in `produce`)

The deployment rubric is in `apps/templates/citywide/CLAUDE.md`. Follow it
exactly. Concretely:

1. Copy the template:
   ```
   cp -r apps/templates/citywide  apps/citywide/<slug>
   ```
   (Don't run `scripts/new-app.py` — it points at a stale path. Just `cp -r`.)
2. Generate `data.geojson`:
   - If `data_kind` is `csv`:
     ```
     python scripts/staging_intake.py csv-to-geojson \
         --csv "<data_file>" --out apps/citywide/<slug>/data.geojson
     ```
     Capture the JSON summary; if `rows_skipped > 0`, list `skipped_names` in
     the per-app `NOTES.md` so the user can fill those in and re-run.
   - If `data_kind` is `geojson`: just `cp` the file to `data.geojson`.
3. **Read the new `data.geojson`** and follow the citywide rubric:
   - Profile every property (unique-value count, null rate).
   - Compute centroid (mean of all `geometry.coordinates`, rounded to 3 dp).
   - Pick `nameField` (overridden by front-matter `name_field` if set).
   - Pick filters (≤3), columns (≤5), popup rows (≤9) using the rubric in
     `apps/templates/citywide/CLAUDE.md`. Honor any explicit lists in
     front-matter.
   - **Rewrite `apps/citywide/<slug>/config.js`** with title/eyebrow/subtitle,
     `infoPanelText` (one-sentence summary derived from the report), `center`,
     `markerColor`, `markerIconStyle`, `nameField`, `filters`, `columns`,
     `popupFields`. Leave `maxBounds`, `overlays`, `features`, `socialLinks`,
     `redditCity`, `googleMapsApiKey` untouched.
   - **Edit `apps/citywide/<slug>/index.html`**: only the `<title>` tag.
4. Write `apps/citywide/<slug>/NOTES.md` recording your picks (so re-runs are
   stable and the user can see what you decided). Include any skipped rows.

### 3 — Build the storymap  (skip if `storymap` not in `produce`)

1. Create the folder by copying frozen template files:
   ```
   mkdir -p storymaps/<slug>/data
   cp storymaps/template/index.html  storymaps/<slug>/
   cp storymaps/template/engine.js   storymaps/<slug>/
   cp storymaps/template/ui.js       storymaps/<slug>/
   cp storymaps/template/style.css   storymaps/<slug>/
   cp apps/citywide/<slug>/data.geojson  storymaps/<slug>/data/<slug>.geojson
   ```
2. Author `storymaps/<slug>/story.json` per `storymaps/template/PLAN.md`. A
   solid default for a "browse this dataset" story:
   - `initialCamera`: centered on the dataset centroid, zoom 10.
   - One **layer**: the dataset GeoJSON, type `circle`, colored from
     `marker_color` in front-matter.
   - **Scene 1 (overview)**: fly to centroid (zoom 10.5), popup with the
     report's Executive Summary (first 2–3 sentences), CTA → `/apps/citywide/<slug>/`.
   - **Scenes 2..N-1** (target `storymap_seed_scenes`, default 6): walk the
     report's H2 sections that name a feature in the data. For each, fly to that
     feature's coords (zoom ~14, pitch 50, bearing varied), popup with title
     (the H2), 2–3 sentences from the section body, and a CTA → the app.
   - **Closing scene**: fly to centroid (zoom 10), popup with link to
     `report.html` ("Read the full report →").
3. Append `{ "id": "<slug>", "label": "<title>" }` to `storymaps/index.json`
   if the id isn't already there.

### 4 — Render the report  (skip if `report` not in `produce`)

```
python scripts/build-report.py \
  --markdown "<report_md>" \
  --out      storymaps/<slug>/report.html \
  --title    "<title>" \
  --subtitle "<subtitle>" \
  --eyebrow  "<eyebrow>" \
  [--cover-image "<first image in staging>"]
```

The script handles footnotes-as-endnotes and is print-friendly so the user
can open it on their phone and "Save as PDF" via the browser.

### 5 — Wire up navigation

`apps.html` currently uses `<button class="nav-link">` placeholders that don't
link anywhere. To register the new app as a real entry, add an `<li>` to the
"Concepts in progress" `<ul>` whose entry is an `<a class="nav-link">`
pointing to `/apps/citywide/<slug>/`, e.g.:

```html
<li>
  <a class="nav-link" href="/apps/citywide/<slug>/"
     data-description="<one-sentence summary>"
     data-tag="<eyebrow>"
     data-map-label="<title>"
     data-color="<marker_color>">
    <title>
  </a>
</li>
```

(`page.js` listens for `.nav-link` clicks; `<a>` and `<button>` both work.)

### 6 — Commit and push

Single commit on the working branch (`claude/review-staging-workflow-xfpEx`
unless told otherwise):

```
git add apps/citywide/<slug>/ storymaps/<slug>/ storymaps/index.json apps.html
git commit -m "Deploy <title> from staging (app + storymap + report)"
git push -u origin claude/review-staging-workflow-xfpEx
```

If `git push` fails for transient network reasons, retry up to 4 times with
exponential backoff (2 s, 4 s, 8 s, 16 s). Do NOT use `--force` or
`--no-verify`.

**Leave the staging files in place.** The user clears them manually after
merging.

### 7 — Report URLs

After push, tell the user the three URLs:

- `https://anatomy.city/apps/citywide/<slug>/`
- `https://anatomy.city/storymaps/<slug>/`
- `https://anatomy.city/storymaps/<slug>/report.html`

## Hard rules

- **Never** modify files inside `apps/templates/`, `storymaps/template/`,
  `apps/shared/`, `page.js`, top-level `style.css`, any deployed `app.js`, or
  storymap `engine.js` / `ui.js`. The whole architecture relies on those
  staying frozen.
- **Never** geocode addresses yourself. If the CSV is missing coords, list the
  affected rows in the per-app `NOTES.md` and proceed with the rest.
- **Never** delete files in `assets/staging/`. The user owns that folder.
- Honor the front-matter `produce:` list — if it omits `app`, don't build one.
- All paths in generated `config.js`/`story.json` must be relative
  (`../../shared/...`, `data/...`).
