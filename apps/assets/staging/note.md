---
# ─── Required ─────────────────────────────────────────────────────
slug: austin-chambers
title: Austin-Area Chambers of Commerce
subtitle: Regional and affinity chambers across Greater Austin

# ─── Optional metadata (sensible defaults if omitted) ─────────────
eyebrow: Austin Metro
produce: [app, storymap, report]   # any subset of these three
marker_color: "#6f4e37"             # coffee brown — fits chambers/coffee/civic theme
marker_icon: pin                    # golf | drop | pin
name_field: name                    # CSV/GeoJSON property used as the title in popups + table
filters: [focus_type]               # leave empty [] to let Claude pick
storymap_seed_scenes: 6             # Claude will target this many scenes
report:
  cover_image: ""                   # PNG/JPG name in this folder, or "" for none
  strip_footnotes: true             # collect [^n] refs into endnotes for readability
---

# Notes for Claude

This is the **system prompt** that drives `apps/skills/staging-intake`. The full
pipeline doc lives at `apps/skills/staging-intake/SKILL.md` — only put per-drop
overrides and freeform guidance here.

For this drop:

- Group storymap scenes by `focus_type` (Regional → Affinity → Geographic), not in CSV order.
- Hide the `sources` column in the app — it's noisy.
- The CSV currently has lat/lng for only 5 of 12 rows. Use only the geocoded rows
  for app markers; list the missing ones in `apps/citywide/austin-chambers/NOTES.md`
  so I can fill them in and re-run.
- Closing storymap scene CTA: "Read the full report →" → `report.html`.
