// Minimal MapLibre app with style switching + basic controls.

const mapContainer = document.getElementById("mapCanvas");
const styleSelect = document.getElementById("style");
const styleUrlInput = document.getElementById("styleUrl");
const goBtn = document.getElementById("go");
const searchBox = document.getElementById("search");

function readParams() {
  const u = new URL(location.href);
  const g = (k, d) => Number(u.searchParams.get(k) ?? d);
  const s = u.searchParams.get("style");
  return {
    center: [g("lng", -97.7431), g("lat", 30.2672)],
    zoom: g("z", 13), pitch: g("p", 60), bearing: g("b", 0),
    style: s
  };
}
function writeParams() {
  const u = new URL(location.href);
  const c = map.getCenter();
  u.searchParams.set("lat", c.lat.toFixed(5));
  u.searchParams.set("lng", c.lng.toFixed(5));
  u.searchParams.set("z", map.getZoom().toFixed(2));
  u.searchParams.set("p", map.getPitch().toFixed(0));
  u.searchParams.set("b", map.getBearing().toFixed(0));
  u.searchParams.set("style", styleSelect.value);
  history.replaceState({}, "", u);
}

// Replace these placeholders with real OpenFreeMap style URLs later.
const STYLE_REGISTRY = {
  OFM_3D: "https://tiles.openfreemap.org/styles/liberty",   // 3D buildings via extrusions
  OFM_2D: "https://tiles.openfreemap.org/styles/positron"   // crisp 2D
};

const init = readParams();
if (init.style && STYLE_REGISTRY[init.style]) styleSelect.value = init.style;

function resolveStyle() {
  const choice = styleSelect.value;
  if (choice === "CUSTOM") return styleUrlInput.value.trim();
  return STYLE_REGISTRY[choice];
}

let map = new maplibregl.Map({
  container: mapContainer,
  style: resolveStyle(),
  center: init.center,
  zoom: init.zoom,
  pitch: init.pitch,
  bearing: init.bearing,
  attributionControl: false
});

map.setPitch(init.pitch); map.setBearing(init.bearing); map.setZoom(init.zoom); map.setCenter(init.center);

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

const attrib = document.getElementById("attrib");
function showMsg(msg) {
  attrib.textContent = msg;
  setTimeout(() => attrib.textContent = "© OpenStreetMap contributors", 2000);
}

map.on("dataloading", () => attrib.textContent = "Loading map…");
map.on("idle", () => attrib.textContent = "© OpenStreetMap contributors");
map.on("error", e => {
  console.error(e);
  showMsg("Map style error — check console");
});

const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: false,          // set true to keep following the user
  showUserHeading: true              // optional: shows direction arrow
});
map.addControl(geolocate, 'top-right');

map.on('load', () => geolocate.trigger());
["moveend","pitchend","rotateend","zoomend"].forEach(evt => map.on(evt, writeParams));

styleSelect.addEventListener("change", () => {
  const newStyle = resolveStyle();
  if (newStyle) map.setStyle(newStyle);
});
styleSelect.addEventListener("change", writeParams);

styleUrlInput.addEventListener("change", () => {
  if (styleSelect.value === "CUSTOM") {
    const custom = styleUrlInput.value.trim();
    if (custom) map.setStyle(custom);
  }
});

goBtn.addEventListener("click", () => {
  const raw = searchBox.value.trim();
  if (!raw) return;
  const [lat, lng] = raw.split(",").map(s => Number(s.trim()));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), essential: true });
  } else {
    alert("Please enter coordinates like: 30.2672,-97.7431");
  }
});

async function addKml(source) {
  const xml = typeof source === "string"
    ? await (await fetch(source)).text()
    : await source.text();
  const dom = new DOMParser().parseFromString(xml, "text/xml");
  const geojson = toGeoJSON.kml(dom);

  const id = "kml";
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
  map.addSource(id, { type: "geojson", data: geojson });
  map.addLayer({ id, type: "line", source: id, paint: { "line-color": "#f00" } });
}

document.getElementById("loadKml").onclick = () =>
  addKml(document.getElementById("kmlUrl").value.trim());

document.getElementById("kmlFile").onchange = e =>
  addKml(e.target.files[0]);

// Auto-enable terrain if the style includes a DEM source.
map.on("styledata", () => {
  try {
    const style = map.getStyle();
    const sources = style && style.sources ? style.sources : {};
    const demKey = Object.keys(sources).find(k => sources[k].type === "raster-dem");
    map.setTerrain(demKey ? { source: demKey } : null);
  } catch (_) {}
});

// Helper for adding a GeoJSON overlay from a URL (no persistence)
export async function addGeoJsonOverlay(url, id = "overlay") {
  const res = await fetch(url);
  const geojson = await res.json();

  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);

  map.addSource(id, { type: "geojson", data: geojson });
  map.addLayer({
    id,
    type: "circle",
    source: id,
    paint: { "circle-radius": 4, "circle-opacity": 0.85 }
  });
}

