# Plan: `assets/staging/` → App + Storymap + HTML Report pipeline

## Context

You want a **phone-only workflow** for `loraatx/loraatx.github.io` using Claude Code on the web:

1. You run a **Perplexity deep-research query** on your phone and export the results (markdown report + a pre-geocoded CSV/GeoJSON).
2. You drop those files into `assets/staging/` on a working branch, along with a small `note.md` "system prompt."
3. From the phone, you tell Claude "process staging."
4. Claude reads the staging folder, follows the rules in `note.md` and in a new skill under `apps/skills/staging-intake/`, and produces three outputs:
   - A **citywide app** at `apps/citywide/<slug>/` (map + filters + popups).
   - A **storymap** at `storymaps/<slug>/` (cinematic flyover tied to the report's structure).
   - A **styled `report.html`** at `storymaps/<slug>/report.html` that you can open on the phone and "Save as PDF" from the browser.
5. Claude wires the new content into the site (`apps.html`, `storymaps/index.json`) and pushes to `claude/review-staging-workflow-xfpEx` so you can merge on GitHub.

Staging contents at the time of this plan:
- `assets/staging/98ea3731.md` — Perplexity report on Austin-area Chambers of Commerce (H2 sections, table, footnotes).
- `assets/staging/ff7a681f.csv` — original 12-row CSV (no coords).
- `assets/staging/cd19bead (1).csv` — same 12 rows with `latitude`/`longitude` columns. **Only 5 of 12 rows have coords filled in** — the other 7 are blank. The pipeline will skip rows without coords and surface this clearly in the build report so you can fill in and re-run.
- `assets/staging/note.md` — currently just `#instructions`; will be replaced with a real template.

---

## What already exists (do not rebuild)

Citywide app deployment (fully documented):
- `apps/templates/citywide/CLAUDE.md` — profile `data.geojson`, pick `nameField` / ≤3 filters / ≤5 columns / ≤9 popup rows, edit only `config.js` + `<title>`.
- `apps/templates/citywide/` — frozen `app.js`, `style.css`, `index.html`, favicons.

Storymap deployment (fully documented):
- `storymaps/template/PLAN.md` — `story.json` schema, scene transitions, layer opacity rules.
- `storymaps/template/` — frozen `engine.js`, `ui.js`, `style.css`, `index.html`.
- `storymaps/index.json` — registry read by the homepage selector (`index.html` lines 66–80).

Site navigation:
- `apps.html` — hand-maintained sidebar of `<button class="nav-link">` entries.
- `index.html` — homepage with storymap iframe driven by `storymaps/index.json`.

What is **missing** and will be added by this plan:
- An orchestrator skill that drives the staging → three-output pipeline.
- A `report.html` renderer (markdown → styled standalone HTML).
- A canonical `note.md` template.

No geocoder and no PDF binary are needed — confirmed.

---

## Design decisions (from your answers)

| Decision        | Choice                                                                                      |
|-----------------|---------------------------------------------------------------------------------------------|
| Geocoding       | **Require pre-geocoded CSV/GeoJSON in staging.** Pipeline skips rows without coords.       |
| Report format   | **Styled `report.html` only.** No PDF toolchain. You "Save as PDF" from the phone browser. |
| Report location | `storymaps/<slug>/report.html`. Linked from the storymap's closing-scene CTA only.         |
| Commit/push     | Auto commit + push to `claude/review-staging-workflow-xfpEx`.                               |

---

## Design

### A. The staging contract

`assets/staging/` holds exactly one staging drop at a time. Files classified by role:

| File               | Role                                                                                    |
|--------------------|-----------------------------------------------------------------------------------------|
| `note.md`          | **System prompt** (front-matter + prose — see §B).                                      |
| `*.md` (the other) | **Report body** — rendered to `report.html` and mined for storymap scene copy.          |
| `*.csv`            | Structured data with `latitude`/`longitude` columns. Converted to GeoJSON.              |
| `*.geojson`        | Pre-built FeatureCollection (alternative to CSV). Used directly if present.             |
| `*.png` / `*.jpg`  | Optional images for storymap popups / report cover.                                     |

Picking the "right" file when multiple are present:
- The MD whose filename is **not** `note.md` and has the largest byte size is the report body.
- If both CSV and GeoJSON are present, GeoJSON wins.
- If multiple CSVs are present (current case: `ff7a681f.csv` + `cd19bead (1).csv`), the one with `latitude`/`longitude` columns wins; ties broken by most recent mtime.

### B. `note.md` — the system prompt (replaces the current stub)

```markdown
---
slug: austin-chambers              # required; becomes apps/citywide/<slug>/ and storymaps/<slug>/
title: Austin-Area Chambers of Commerce
subtitle: Regional and affinity chambers across Greater Austin
eyebrow: Austin Metro
produce: [app, storymap, report]   # subset; default = all three
marker_color: "#6f4e37"
marker_icon: pin                   # golf | drop | pin
name_field: name                   # CSV/GeoJSON property used as the title
filters: [focus_type]              # optional override; Claude picks if omitted
storymap_seed_scenes: 6            # target scene count
report:
  cover_image: ""                  # optional PNG in staging
  strip_footnotes: true            # move [^n] refs to endnotes
---

Freeform notes to Claude go here. Examples:
- Group storymap scenes by focus_type (Regional → Affinity → Geographic).
- Hide the `sources` column in the app.
```

An empty or `#instructions`-only `note.md` is still valid — Claude infers everything from the data + report.

### C. Orchestrator: `apps/skills/staging-intake/SKILL.md`

Lives in `apps/skills/staging-intake/`. The `apps/skills/readme.md` already says "hold skills I want claude to implement," so this is the right home. The skill auto-loads when you say "process staging."

**Pipeline steps:**

1. **Triage** `assets/staging/`:
   - Parse `note.md` front matter.
   - Identify the report MD, the CSV (or GeoJSON), images.
   - Resolve `slug` from front matter, else kebab-case the report's H1.

2. **Build the app** at `apps/citywide/<slug>/`:
   - Copy `apps/templates/citywide/` → `apps/citywide/<slug>/`.
   - Convert the CSV (filtering out rows missing `latitude`/`longitude`) into `apps/citywide/<slug>/data.geojson`.
   - Follow `apps/templates/citywide/CLAUDE.md`: profile properties, compute centroid, pick fields (respecting `note.md` overrides), rewrite `config.js`, change `<title>` in `index.html`.
   - Write a small `NOTES.md` recording Claude's picks and any rows skipped for missing coords.

3. **Build the storymap** at `storymaps/<slug>/`:
   - Copy `storymaps/template/{index.html, engine.js, ui.js, style.css}` (frozen).
   - Copy `data.geojson` to `storymaps/<slug>/data/<slug>.geojson`.
   - Generate `story.json` per `storymaps/template/PLAN.md`:
     - Scene 1: citywide overview + Executive Summary excerpt + CTA to the app.
     - Scenes 2..N-1: one per major section (matched to features by name).
     - Closing scene: link to `report.html`.
   - Append `{ "id": "<slug>", "label": "<title>" }` to `storymaps/index.json`.

4. **Render `report.html`** at `storymaps/<slug>/report.html`:
   - Run `scripts/build-report.py --slug <slug>` (pure Python; uses `markdown` if installed, falls back to a vendored mini-renderer).
   - Self-contained, print-friendly CSS (serif, max-width 780px, page breaks before H2, footnotes as endnotes).

5. **Wire up the site**:
   - `apps.html`: append a real linked entry for the new app.
   - `storymaps/index.json`: updated in step 3.

6. **Commit and push** to `claude/review-staging-workflow-xfpEx`.

7. **Report back** with the three URLs.

### D. Files this plan creates / modifies

**Create:**
- `apps/skills/staging-intake/SKILL.md` — orchestrator skill.
- `scripts/build-report.py` — MD → standalone styled `report.html`.
- `scripts/staging_intake.py` — helper that does the deterministic CSV→GeoJSON conversion and prints a triage report (Claude can call it with `--dry-run` to see what would happen).
- `assets/staging/note.md` — replaced with the template above.

**Modify per staging run:**
- `apps.html` — one new entry per deployment.
- `storymaps/index.json` — one new entry per deployment.
- New folders under `apps/citywide/<slug>/` and `storymaps/<slug>/`.

**Never touch:**
- `apps/templates/*`, `storymaps/template/*`, `apps/shared/*`, `page.js`, `style.css`, `apps/*/app.js`, `storymaps/*/engine.js`, `storymaps/*/ui.js`.

### E. This run (austin-chambers)

- 5 of 12 rows have coords (Austin Chamber, Austin LGBT, West Austin, Pflugerville, Round Rock). Those become app markers.
- The other 7 (Greater Austin Asian/Hispanic/Black, Lake Travis, Westlake, Austin Young, Buda) are listed in `apps/citywide/austin-chambers/NOTES.md` as "missing coords — fill in the staging CSV and re-run."
- The storymap and `report.html` cover all 12 chambers (text/scenes don't depend on coords for everything; missing-coord scenes use the city centroid).

### F. Verification

1. `python -m http.server` from repo root.
2. `http://localhost:8000/apps/citywide/austin-chambers/` — 5 markers, filter on `focus_type` works, popups render.
3. `http://localhost:8000/storymaps/austin-chambers/` — scenes play, closing CTA opens the report.
4. `http://localhost:8000/storymaps/austin-chambers/report.html` — readable layout, footnotes at end, prints cleanly.
5. `http://localhost:8000/apps.html` — new entry visible.
6. `http://localhost:8000/` — homepage selector shows the new storymap.
7. After the user fills in the missing 7 lat/lngs and re-runs, the orchestrator updates the same folders (idempotent).

---

## Summary of what will be built

- **One skill** (`apps/skills/staging-intake/SKILL.md`).
- **Two scripts** (`scripts/build-report.py`, `scripts/staging_intake.py`).
- **Updated `note.md`** template.
- A first deployment of the chambers content to prove the pipeline.
