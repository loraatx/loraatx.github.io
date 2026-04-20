# Tour Maps Template

A geofence-triggered walking-tour experience. Copy this folder to create a new tour.

## What this is

- A full-screen MapLibre map bounded to a single neighborhood.
- A list of **stops**, each with a circular **geofence** (center + radius).
- When the user's browser geolocation crosses into a stop's radius, the stop's
  popup fires automatically (once per stop).
- Works on desktop too via **simulate mode**: click any stop in the side panel,
  or add `?simulate=1` to the URL to drag a SIM marker around the map.

## File layout

```
/my-tour/
├── index.html          # Scaffolding + MapLibre init. Rarely needs edits.
├── engine.js           # TourEngine — geofence driver. Don't edit unless extending.
├── ui.js               # UI controller (permission modal, progress chip, stops panel).
├── style.css           # Visual styling. Safe to tweak per tour.
├── tour.json           # ALL content + geofence config. This is what you edit.
└── data/
    └── stops.geojson   # Optional. Unused by default — stops layer is built from tour.json.
```

## Authoring a new tour

1. Copy this `template/` folder to `/tourmaps/<your-tour-id>/`.
2. Edit `tour.json`:
   - `title` / `subtitle` — shown in the top-right brand card.
   - `initialCamera` — where the map starts. Use zoom 14–16 for neighborhood scale.
   - `maxBounds` — `[[westLng, southLat], [eastLng, northLat]]` bounding box.
     The camera can't pan outside this.
   - `geofence.defaultRadiusMeters` — fallback radius for stops that don't specify one.
   - `stops[]` — each stop has:
     - `id` (unique string)
     - `geofence.center` (`[lng, lat]`) and optional `geofence.radiusMeters`
     - `popup` — same rich schema as storymaps: `title`, `subtitle`, `body` (HTML),
       `image`, `youtube`, `stats`, `link`.
3. Register the tour in `/tourmaps/index.json` and `/tourmaps/reports.json`.

## Visual conventions

- **Orange** (`#b4531a`) = unvisited stop + geofence ring.
- **Green** = visited stop.
- **Blue pulsing dot** = live GPS position.
- **Orange SIM marker** = simulate-mode draggable pointer.

## Verification

1. `python3 -m http.server 8000` at repo root.
2. `http://localhost:8000/tourmaps/<your-tour-id>/`
3. Click **Preview without GPS** or append `?simulate=1` to the URL.
4. Drag the SIM marker into a stop's ring → popup should fire, progress chip
   should tick up, and the stop should turn green in the side panel.

## Extending

- **YouTube videos** in popups: add `youtube: { videoId, startAt, stopAt, mute }`.
- **Extra map layers** (e.g. the walking route as a line): add entries to
  `tour.json.layers`. Use `"source": "tour-stops"` to reuse the built-in stops
  source, or provide a URL/GeoJSON to add a new source.
- **Non-circular geofences**: would require editing `engine.js` to swap the
  haversine check for a polygon point-in-polygon test (e.g. Turf.js).
