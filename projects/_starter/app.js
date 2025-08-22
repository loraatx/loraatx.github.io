// Minimal MapLibre app with style switching + basic controls.

const mapContainer = document.getElementById("mapCanvas");
const styleSelect = document.getElementById("style");
const styleUrlInput = document.getElementById("styleUrl");
const pitchInput = document.getElementById("pitch");
const bearingInput = document.getElementById("bearing");
const zoomInput = document.getElementById("zoom");
const pitchVal = document.getElementById("pitchVal");
const bearingVal = document.getElementById("bearingVal");
const zoomVal = document.getElementById("zoomVal");
const goBtn = document.getElementById("go");
const searchBox = document.getElementById("search");

// Replace these placeholders with real OpenFreeMap style URLs later.
const STYLE_REGISTRY = {
  "OFM_3D": "https://{YOUR_OPENFREEMAP_3D_STYLE_URL}/style.json",
  "OFM_2D": "https://{YOUR_OPENFREEMAP_2D_STYLE_URL}/style.json",
};

function resolveStyle() {
  const choice = styleSelect.value;
  if (choice === "CUSTOM") return styleUrlInput.value.trim();
  return STYLE_REGISTRY[choice];
}

let map = new maplibregl.Map({
  container: mapContainer,
  style: resolveStyle(),
  center: [-97.7431, 30.2672], // Austin
  zoom: Number(zoomInput.value),
  pitch: Number(pitchInput.value),
  bearing: Number(bearingInput.value),
  attributionControl: false
});

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

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: false,          // set true to keep following the user
  showUserHeading: true              // optional: shows direction arrow
});
map.addControl(geolocate, 'top-right');

map.on('load', () => geolocate.trigger());

function syncLabels() {
  pitchVal.textContent = `${pitchInput.value}°`;
  bearingVal.textContent = `${bearingInput.value}°`;
  zoomVal.textContent = `z${zoomInput.value}`;
}
syncLabels();

pitchInput.addEventListener("input", () => { map.setPitch(Number(pitchInput.value)); syncLabels(); });
bearingInput.addEventListener("input", () => { map.setBearing(Number(bearingInput.value)); syncLabels(); });
zoomInput.addEventListener("input", () => { map.setZoom(Number(zoomInput.value)); syncLabels(); });

styleSelect.addEventListener("change", () => {
  const newStyle = resolveStyle();
  if (newStyle) map.setStyle(newStyle);
});

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

// Austin zoning overlay
const toggleZoning = document.getElementById("toggleZoning");
let zoningData;

async function addZoning() {
  if (!zoningData) {
    const url = "https://maps.austintexas.gov/arcgis/rest/services/Shared/Zoning_1/MapServer/0/query?where=1=1&outFields=*&f=geojson";
    const res = await fetch(url);
    zoningData = await res.json();
  }
  if (!map.getSource("zoning")) {
    map.addSource("zoning", { type: "geojson", data: zoningData });
    map.addLayer({
      id: "zoning-fill",
      type: "fill",
      source: "zoning",
      paint: { "fill-color": "#ec4899", "fill-opacity": 0.15 }
    });
    map.addLayer({
      id: "zoning-line",
      type: "line",
      source: "zoning",
      paint: { "line-color": "#ec4899", "line-width": 1 }
    });
  }
}

function removeZoning() {
  if (map.getLayer("zoning-line")) map.removeLayer("zoning-line");
  if (map.getLayer("zoning-fill")) map.removeLayer("zoning-fill");
  if (map.getSource("zoning")) map.removeSource("zoning");
}

toggleZoning?.addEventListener("change", async () => {
  if (toggleZoning.checked) {
    await addZoning();
  } else {
    removeZoning();
  }
});

map.on("styledata", () => {
  if (toggleZoning?.checked) addZoning();
});
