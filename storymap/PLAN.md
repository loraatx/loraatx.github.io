# Plan: Story Map Page (`/storymap/`)

## Context
Build a self-contained, full-screen cinematic story map page separate from the homepage. It is driven entirely by `story.json` — no code changes are needed to author new stories. The page can advertise reports and apps on the site by flying to relevant locations, showing rich popups (image, YouTube clip, stats table, CTA link), toggling GeoJSON layers on/off with opacity fades, and doing in-place camera reveals (pitch/bearing changes without moving). A play/pause button and scene dot indicators complete the UI. Everything lives in `/storymap/` and is fully self-contained.

---

## Files to Create

```
/storymap/
  index.html      page shell — map + UI scaffolding
  engine.js       StoryEngine class (all playback logic)
  ui.js           UI init (dots, play/pause, title overlay)
  style.css       all styles for this page
  story.json      6-scene Austin pools sample story
  data/           (user populates with their own GeoJSONs)
```

No dependency on the parent `style.css` or `page.js`.

---

## story.json Schema

```json
{
  "title": "string (required)",
  "subtitle": "string (optional)",
  "loop": true,
  "autoplay": true,
  "initialCamera": { "center": [lng, lat], "zoom": 10, "pitch": 0, "bearing": 0 },

  "layers": [
    {
      "id": "pool-areas",
      "type": "fill | line | circle | fill-extrusion | symbol",
      "source": "data/pool-areas.geojson",
      "paint": { "fill-color": "#0067c5", "fill-opacity": 0 },
      "layout": {},
      "transitionOpacity": 0.35,
      "transitionDuration": 700,
      "insertBefore": "road-label"
    }
  ],

  "scenes": [
    {
      "id": "unique-id",
      "transition": "fly | ease | jump",
      "duration": 6000,
      "camera": {
        "center": [lng, lat],
        "zoom": 16,
        "pitch": 55,
        "bearing": 90,
        "speed": 0.8,
        "curve": 1.4,
        "duration": 2000
      },
      "showLayers": ["pool-areas"],
      "hideLayers": ["parks"],
      "popup": {
        "lngLat": [lng, lat],
        "anchor": "bottom",
        "title": "string",
        "subtitle": "string",
        "body": "raw HTML string",
        "image": { "src": "url", "alt": "string", "caption": "string" },
        "youtube": { "videoId": "string", "startAt": 0, "stopAt": 20, "mute": true },
        "stats": [ { "label": "Open Since", "value": "1917" } ],
        "link": { "href": "url", "text": "View Report →", "external": false }
      }
    }
  ]
}
```

**Key rules:**
- `transition: "fly"` → `map.flyTo()`, requires `camera.center`
- `transition: "ease"` → `map.easeTo()`, `camera.center` optional (stays at current location for in-place reveals)
- `transition: "jump"` → `map.jumpTo()`, instant cut
- If `popup.youtube.stopAt` is set, it overrides `duration` for auto-advance; the YouTube `stopAt` timer fires instead
- `youtube.mute` defaults to `true` (browsers block unmuted autoplay)
- All layers start with opacity 0 at page load; `showLayers`/`hideLayers` fades them using MapLibre paint transitions

---

## engine.js — StoryEngine Class

### State machine
```
IDLE → TRANSITIONING → WAITING → SHOWING → ADVANCING → (next scene)
```
Pause is valid in `TRANSITIONING` and `SHOWING`. All async callbacks carry an `_abortToken` (integer incremented by every `goToScene()` call) and exit immediately if stale — this prevents race conditions from rapid dot-clicks or mid-flight pauses.

### Key methods
- `load(url)` — fetches story.json, calls `_initLayers()`, emits `sm:story-loaded`
- `play()` / `pause()` / `toggle()`
- `goToScene(index)` — increments abort token, cancels timers/YT, calls `_runScene`
- `next()` / `prev()`

### `_runScene(index, abortToken)` — central orchestrator
1. Remove old popup; stop YT player
2. Call `_setLayerVisibility()` for `showLayers`/`hideLayers` (start fades before camera moves)
3. `await _doTransition(scene, abortToken)` — resolves on `map.once('moveend')`
4. Check abort token; if paused, bail (play() will re-run transition)
5. Inject popup via `_showPopup(scene)`
6. Start timer: if `youtube.stopAt` set → `_pollYTForStopAt()`; else → `_startSceneTimer(duration)`

### `_doTransition(scene, abortToken)` — returns Promise
```javascript
// fly
map.flyTo({ center, zoom, pitch, bearing, speed, curve });
// ease (in-place cinematic move)
map.easeTo({ center?, zoom, pitch, bearing, duration: cam.duration ?? 1200 });
// jump
map.jumpTo({ center, zoom, pitch, bearing });
// all: map.once('moveend', resolve)
```

### `_setLayerVisibility(ids, visible)` — opacity fade
```javascript
// MapLibre paint transitions require TWO synchronous setPaintProperty calls:
map.setPaintProperty(id, `${opacityProp}-transition`, { duration, delay: 0 });
map.setPaintProperty(id, opacityProp, targetOpacity);
// opacityProp: fill-opacity, line-opacity, circle-opacity, fill-extrusion-opacity, etc.
```
**NEVER use `setLayoutProperty('visibility', 'none')` for animated layers** — it culls the layer from rendering and prevents transition. All story layers stay at `visibility: visible`; only opacity is animated.

### `_initLayers()` — registers all layers at page load
- Adds GeoJSON source for each layer (`type: 'geojson', data: layerDef.source`)
- Overrides paint opacity to 0 so all layers start invisible
- Adds MapLibre layer with `visibility: 'visible'`
- Respects `insertBefore` for z-ordering (e.g. insert polygons under road labels)

### YouTube integration
```javascript
// Load API once, reuse promise if mid-load:
_loadYouTubeAPI() {
  if (this.ytReady) return Promise.resolve();
  if (this._ytAPIPromise) return this._ytAPIPromise;
  this._ytAPIPromise = new Promise(resolve => {
    window.onYouTubeIframeAPIReady = () => { this.ytReady = true; resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
  return this._ytAPIPromise;
}

// Create player in popup placeholder div after popup is in DOM:
this.ytPlayer = new YT.Player(placeholderId, {
  videoId,
  playerVars: { autoplay: 1, start: startAt, mute: 1, controls: 0, rel: 0, playsinline: 1 },
  events: { onReady: e => { e.target.playVideo(); resolve(); } }
});

// Poll for stopAt — IFrame API has no onTimeReached event:
this._ytPollInterval = setInterval(() => {
  if (abortToken !== this._abortToken) { clearInterval(...); return; }
  if (this.paused) return;
  const t = this.ytPlayer.getCurrentTime?.();
  if (t != null && t >= stopAt) { clearInterval(...); this._advance(abortToken); }
}, 250);
```

### Pause/resume — map.stop() edge case
`map.stop()` fires `moveend` immediately, resolving `_doTransition` early. After the await, check `this.paused` and return without showing popup. When `play()` is called from `TRANSITIONING`, re-run `_doTransition` for the current scene index.

### Popup close button
User clicking the close button on a popup triggers `sm:scene-change` to advance. The popup's `close` event calls `_advance(abortToken)`.

### Events emitted (CustomEvent on window)
- `sm:story-loaded` — story parsed, layers added
- `sm:scene-change` — `{ index, scene }` — update dot indicators
- `sm:playstate-change` — `{ playing: bool }` — update play/pause button

---

## ui.js — UI Controller
Listens to engine events. Holds references to DOM elements only. No playback logic.

```javascript
function initUI(engine) {
  // Populate title overlay from engine.story.title/subtitle
  // Build dot buttons (one per scene), wire click → engine.goToScene(i)
  // Wire play button click → engine.toggle()
  // window.addEventListener('sm:scene-change', ...) → updateDots
  // window.addEventListener('sm:playstate-change', ...) → swap ▶/⏸ icons
}
```

---

## index.html — Page Shell
- Full-screen `<div id="map">`
- Story title overlay (top-left, glassmorphism, `pointer-events: none`)
- Play/pause button (bottom-left, 48px circle, ▶/⏸ SVG icons)
- Scene dot nav (bottom-center, pill container, active dot stretches to pill shape)
- "City Anatomy ↗" back link (top-right, subtle)
- MapLibre initialized same as homepage (liberty style, Austin center, 3D buildings)
- Script order: `maplibre-gl.js` → `engine.js` → `ui.js` → inline init

---

## style.css — Key Rules

**CSS variables** — copied from parent (not imported), both light and dark via `@media (prefers-color-scheme: dark)`.

**Popup structure** — `.sm-popup` wrapper inside `.maplibregl-popup-content`:
- `.sm-popup-figure` — image bleeds to popup edges (`margin: -14px -16px 12px`), `max-height: 160px`, `object-fit: cover`
- `.sm-popup-video-wrap` — full-width bleed, `aspect-ratio: 16/9`, child iframe fills 100%
- `.sm-popup-stats` — table, `border-top` separating rows, label left / value right bold
- `.sm-popup-link` — full-width filled button (`background: var(--accent)`)
- `.maplibregl-popup-content` — `padding: 0`, `overflow: hidden` (clips image to border-radius), `max-width: 320px`

**Play button** — `position: fixed; bottom: 32px; left: 20px`, glassmorphism, hover lifts + accent border.

**Dots** — `position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%)`, pill container, active dot animates width `8px → 22px` (pill shape) via CSS transition.

**Title overlay** — `position: fixed; top: 20px; left: 20px`, max-width 280px, glassmorphism, `pointer-events: none`.

---

## Sample story.json — 6 scenes (Austin Pools)

| # | ID | Transition | Layers | Popup |
|---|---|---|---|---|
| 1 | `overview` | fly | show: parks | title + stats + CTA link |
| 2 | `barton-springs` | fly | show: pool-areas + creek-corridors | image + body + stats + link |
| 3 | `barton-drone-reveal` | **ease** (in-place pitch 55°→70°, bearing 90°→180°) | keep pool-areas | YouTube clip (4s–26s) + body |
| 4 | `deep-eddy` | fly | keep pool-areas | image + body + stats |
| 5 | `citywide-access` | fly (zoom out) | show: parks + pool-areas | body + stats + CTA link |
| 6 | `barton-creek-watershed` | fly | show: creek-corridors + parks | body + stats + external link |

Scene 3 demonstrates the in-place ease transition and YouTube timing. Scene 1 and 5 show the zoom-out overview pattern. Scenes 2 and 4 show the fly-to-detail pattern with images.

---

## Verification

1. `anatomy.city/storymap/` loads → map flies in, title overlay visible, 6 dots at bottom, ⏸ button at bottom-left
2. Each scene: camera transition → popup appears → auto-advances after duration (or YouTube stopAt)
3. Scene 3: map does NOT move, only pitch/bearing changes → YouTube embed plays, auto-advances at 26s
4. Layer show/hide: at scene 2, pool-areas polygon fades in smoothly; at scene 5, creek-corridors fade out
5. Play/pause: clicking ⏸ freezes timer + YouTube; ▶ resumes from remaining time
6. Dot click mid-flight: previous flight cancels cleanly, new scene starts
7. Last scene auto-loops to first
8. Edit `story.json` only (no code change) → new scenes work immediately
9. Check on mobile: popup fits screen, dots are tappable, play button accessible
