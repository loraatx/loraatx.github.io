# Geofenced Tour Maps — `/tourmaps/`

## Context

The site already has a `/storymaps/` directory with a clean, data-driven cinematic story-map engine (`engine.js` + `story.json`) used for autoplay narrative experiences (PoolOpenings, austin-neighborhoods, etc.). The user wants a **parallel** `/tourmaps/` directory that looks and feels the same but swaps the driver: instead of a timer-driven autoplay sequence, popups fire when the user's browser geolocation crosses into a preset geofence around a point of interest. The first demo is a neighborhood-scale historical walk (Tejano Trail, East Austin, as the target use case; any ~10–15-stop neighborhood walk is in scope).

Key differences from storymaps:
- **Non-linear** — stops fire in whatever order the walker encounters them, not a fixed sequence.
- **No autoplay timer, no play/pause/next controls** — the walker's position drives everything.
- **Requires browser geolocation permission** (HTTPS only; GitHub Pages provides this).
- **Desktop / no-GPS fallback** — `?simulate=1` URL flag + click-to-trigger on POI markers so authors and desktop visitors can preview without walking.
- **Bounded map view** — `setMaxBounds` around the walk's neighborhood so the camera can't wander.

## Folder Layout

Create a new top-level `/tourmaps/` directory, mirroring `/storymaps/`:

```
/tourmaps/
├── index.json                    # Registry of tour IDs (mirrors storymaps/index.json)
├── reports.json                  # Metadata for each tour (mirrors storymaps/reports.json)
├── template/                     # Starter kit for new tours
│   ├── PLAN.md
│   ├── index.html
│   ├── engine.js                 # TourEngine class (geofence-driven)
│   ├── ui.js                     # UI controller
│   ├── style.css
│   ├── tour.json                 # Content schema
│   └── data/
│       └── stops.geojson
└── tejano-trail/                 # First demo (East Austin)
    ├── index.html
    ├── engine.js                 # (copy of template)
    ├── ui.js
    ├── style.css
    ├── tour.json                 # 10–15 placeholder stops for the user to edit
    └── data/
        └── tejano-trail-stops.geojson
```

## Files to Create

### `/tourmaps/template/tour.json` — content schema

```json
{
  "title": "Tour Name",
  "subtitle": "Neighborhood · Walking tour",
  "initialCamera": { "center": [-97.731, 30.263], "zoom": 15, "pitch": 0, "bearing": 0 },
  "maxBounds": [[-97.745, 30.252], [-97.715, 30.275]],
  "geofence": {
    "defaultRadiusMeters": 40,
    "triggerOnce": true,
    "enableHighAccuracy": true,
    "minMoveMeters": 5
  },
  "layers": [
    {
      "id": "stops",
      "type": "circle",
      "source": "data/stops.geojson",
      "paint": { "circle-radius": 8, "circle-color": "#b4531a", "circle-stroke-color": "#fff", "circle-stroke-width": 2 }
    },
    {
      "id": "stops-radius",
      "type": "circle",
      "source": "data/stops.geojson",
      "paint": { "circle-radius": 24, "circle-color": "#b4531a", "circle-opacity": 0.15, "circle-stroke-color": "#b4531a", "circle-stroke-opacity": 0.35 }
    }
  ],
  "stops": [
    {
      "id": "plaza-saltillo",
      "geofence": { "center": [-97.7315, 30.2634], "radiusMeters": 45 },
      "popup": {
        "anchor": "bottom",
        "title": "Plaza Saltillo",
        "subtitle": "Stop 1 · East Austin",
        "body": "Placeholder narrative...",
        "image": { "src": "...", "alt": "...", "caption": "..." },
        "stats": [{ "label": "Founded", "value": "1990s" }],
        "link": { "href": "...", "text": "Read more →" }
      }
    }
  ]
}
```

Popup sub-schema is **identical** to storymaps (`title/subtitle/body/image/youtube/stats/link`) so `_buildPopupHTML` can be copied verbatim.

### `/tourmaps/template/engine.js` — `TourEngine`

Fork from `/storymaps/template/engine.js` (storymaps/template/engine.js:5), keep these parts verbatim:
- `_buildPopupHTML` (engine.js:296–335)
- `_initLayers` and `_setLayerVisibility` (engine.js:339–383) — useful for the stops/radius layers
- `_loadYouTubeAPI` / `_createYTPlayer` / `_pollYTForStopAt` (engine.js:453–524)
- The `_emit` CustomEvent pattern (engine.js:530–532)

Remove: autoplay sequencing, `currentIndex` iteration, `_startAdvanceTimer`, `_advance`, `loop`, `next/prev/stepNext`, `goToScene`.

Add:
- `start()` — reads `tour.json`, calls `map.setMaxBounds()`, adds stops source/layers, calls `_initGeolocation()`.
- `_initGeolocation()` — calls `navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy, maximumAge: 5000, timeout: 20000 })`. On denial, emits `tour:geolocation-denied` and lets UI show the simulate fallback.
- `_onPosition(pos)` — updates the "you are here" marker; if moved ≥ `minMoveMeters` since last check, runs `_checkGeofences(lng, lat)`.
- `_checkGeofences(lng, lat)` — for each stop, compute **haversine distance** inline (no Turf dependency needed). If distance ≤ `radiusMeters` and stop isn't in `this.visited`, call `_triggerStop(stop, 'gps')`.
- `_triggerStop(stop, source)` — camera `easeTo` to stop, render popup via copied `_buildPopupHTML`, add to `this.visited`, emit `tour:stop-entered` with `{ stop, source, visitedCount, totalStops }`.
- `_setSimulatedPosition(lng, lat)` — used by simulate mode; reuses `_checkGeofences`.
- User "here" marker: a MapLibre `Marker` updated on each position fix.

Haversine helper (inline, no Turf):
```javascript
function haversineMeters(aLng, aLat, bLng, bLat) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
```

### `/tourmaps/template/ui.js` — controls

Different controls than storymaps (no play/pause/next):
- **Permission prompt overlay** — first-paint modal: "This walking tour uses your location to trigger stops. [Allow location] / [Preview without GPS]." Clicking "Preview without GPS" enters simulate mode.
- **Progress chip** — "3 of 12 stops visited." Updates on `tour:stop-entered`.
- **Stop list panel** (toggle via a ⋮ button) — lists all stops; unvisited are greyed, visited are highlighted, clicking any stop fires `_triggerStop(stop, 'click')`. This doubles as the desktop fallback.
- **Simulate mode draggable marker** — only shown when `?simulate=1` or the user picked "Preview without GPS". Dragging the marker calls `engine._setSimulatedPosition(...)`; release re-runs geofence check.
- **Recenter button** — centers the map on the live/simulated position.
- **Brand card** — copy from `/storymaps/template/index.html` (top-right title + back link).

### `/tourmaps/template/style.css`

Fork from `/storymaps/template/style.css` and keep the glassmorphism look. Add styles for:
- `.tm-permission-modal` (full-screen overlay)
- `.tm-progress-chip`
- `.tm-stop-list` (side panel, slide-in)
- `.tm-here-marker` (pulsing dot)
- `.tm-simulate-marker` (distinct color + "SIM" label)

### `/tourmaps/template/index.html`

Near-identical to `/storymaps/template/index.html` (storymaps/template/index.html:1). Swap:
- MapLibre init center/zoom will be overwritten by `tour.json.initialCamera`.
- After map `load`, call `engine.start('tour.json')` instead of `engine.load('story.json')`.
- Same CDN MapLibre 3.6.0.
- No Turf.js needed (inline haversine).

### `/tourmaps/tejano-trail/` — first demo

Copy of template with:
- `tour.json` pre-seeded with **10–15 plausible East Austin placeholder stops** (user edits real coordinates/narrative later). Suggested stub stops: Plaza Saltillo, Juan in a Million, Pan American Rec Center, Chicano Park murals area, Rosewood Park, Ebenezer Baptist Church, Victory Grill, Texas State Cemetery entrance, Emma S. Barrientos MACC, Huston-Tillotson University gate, Oakwood Cemetery, Boggy Creek Greenbelt trailhead, Metz Elementary, Roy's Taxi plaque, Tejano Healthy Walking Trail marker. Coordinates clustered in ~30.25°–30.28°N, −97.74°–−97.71°W.
- `maxBounds` encompassing those clusters.
- `initialCamera` zoom 14–15 for neighborhood scale.
- Generated `data/tejano-trail-stops.geojson` FeatureCollection (one Point per stop) for rendering dots; the geofence circles come from `tour.json` so the author has one source of truth.

### Registry wiring

- Create `/tourmaps/index.json` with `["tejano-trail"]`.
- Create `/tourmaps/reports.json` with one entry for the Tejano Trail (category "Walking Tours", accent `#b4531a`). Follow the exact schema of `/storymaps/reports.json`.
- **Do not** touch the homepage or `storymaps/*.json` — tourmaps stays an independent section. (If the user later wants it on the homepage, that's a separate ask.)

## Critical Files Referenced (read-only, for patterns)

- `/home/user/loraatx.github.io/storymaps/template/engine.js` — `_buildPopupHTML`, `_initLayers`, `_setLayerVisibility`, `_loadYouTubeAPI` / `_createYTPlayer` / `_pollYTForStopAt`, `_emit` (lines 296–335, 339–395, 453–524, 530–532)
- `/home/user/loraatx.github.io/storymaps/template/index.html` — MapLibre init + scaffold (lines 8, 44–56)
- `/home/user/loraatx.github.io/storymaps/template/style.css` — glassmorphism styles, popup CSS
- `/home/user/loraatx.github.io/storymaps/template/ui.js` — CustomEvent listener pattern
- `/home/user/loraatx.github.io/storymaps/austin-neighborhoods/` — neighborhood-scale reference
- `/home/user/loraatx.github.io/storymaps/reports.json` — registry schema

## Branch & Commit

All work on `claude/add-geofence-story-maps-Mde1A`. One commit introducing the `/tourmaps/` tree.

## Verification

1. **Static serve locally**: `python3 -m http.server 8000` at repo root; open `http://localhost:8000/tourmaps/tejano-trail/`.
2. **Permission modal**: first load shows the permission prompt.
3. **Simulate mode**: load `http://localhost:8000/tourmaps/tejano-trail/?simulate=1`. Drag the SIM marker into a stop's radius → popup fires, progress chip increments, stop list shows it visited.
4. **Click-to-trigger**: with no GPS permission, clicking a stop in the side panel fires its popup (this is the authoring workflow).
5. **Bounds**: pan to the edge of the map — camera stops at `maxBounds` instead of scrolling into downtown.
6. **No console errors** on Chrome + iOS Safari simulator.
7. **Real GPS** (optional, user tests on phone): open on HTTPS GitHub Pages URL, grant location, walk near a seeded coordinate — popup fires once, progress increments, and doesn't re-fire (because `triggerOnce: true`).
8. **Popup parity**: a stop with `image`, `stats`, and `link` in `tour.json` renders identically to a storymaps scene (same CSS classes).

## Out of Scope

- Registering the new section on the homepage / `apps.html` / `maps.html` (separate ask).
- Turf.js (inline haversine is sufficient for circular geofences).
- Route-drawing between stops (can be added later as a `line` layer in `tour.json.layers`).
- Offline tile caching / PWA install.
