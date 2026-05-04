# Deploy notes — Austin Golf Courses

**Slug**: austin-golf-courses
**Source**: assets/staging/Golf/data.geojson (20 features)

## Field picks

| Field | nameField | filter | column | popup |
|---|---|---|---|---|
| Course | ✓ (nameField) | — | ✓ | — |
| Area | — | — | ✓ | ✓ |
| Type | — | ✓ | ✓ | ✓ |
| Holes | — | ✓ | ✓ | — |
| Approx. price tier | — | — | ✓ | ✓ |
| Designer / notes | — | — | — | ✓ |
| SourceSheet | — | ✓ (label: Category) | — | — |
| coord_status | — | — | — | — |

**Centroid**: [-97.733, 30.327] (mean of 17 real-coord features)
**markerColor**: #2d7a1a (golf green)
**markerIconStyle**: golf

## Skipped / flagged features

3 features have `coord_status: "fake_placeholder"` and incorrect coordinates.
They appear on the map but in wrong locations. Fill in real coords and re-run to fix:

| Course | Correct area |
|---|---|
| Omni Barton Creek Resort & Spa | West Austin Hills (approx. -97.859, 30.321) |
| Hyatt Regency Lost Pines – Wolfdancer Golf Club | Bastrop area (approx. -97.174, 30.104) |
| Horseshoe Bay Resort | Horseshoe Bay, Lake LBJ (approx. -98.357, 30.543) |
