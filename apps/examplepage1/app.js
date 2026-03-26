// ============================================================
// CONFIG — Update this block when swapping to new GeoJSON data
// ============================================================
const CONFIG = {
  // Page text
  title: "Tacos & Mexican Food",
  eyebrow: "EAST AUSTIN",
  subtitle: "33 spots — Mexican, Tex-Mex, and taco restaurants in East Austin.",

  // Map defaults
  center: [-97.722, 30.268],
  zoom: 13,
  pitch: 45,
  bearing: -15,
  markerColor: "#e63946",

  // Which GeoJSON property is the display name (used as popup title)
  nameField: "name",

  // Filters — each becomes a dropdown; values auto-populated from data
  filters: [
    { property: "kind",    label: "Type" },
    { property: "cuisine", label: "Cuisine" }
  ],

  // Table columns
  columns: [
    { property: "name",    header: "Name" },
    { property: "kind",    header: "Type" },
    { property: "cuisine", header: "Cuisine" },
    { property: "address", header: "Address" }
  ],

  // Popup detail rows (name is always shown as the title)
  popupFields: [
    { property: "kind",             label: "Type" },
    { property: "cuisine",          label: "Cuisine" },
    { property: "address",          label: "Address" },
    { property: "phone",            label: "Phone" },
    { property: "inspection_score", label: "Health Score" },
    { property: "inspection_date",  label: "Inspected" }
  ]
};
// ============================================================

let map;
let allFeatures = [];
let currentPopup;

async function init() {
  // Set page text from config
  document.getElementById("pageEyebrow").textContent = CONFIG.eyebrow;
  document.getElementById("pageTitle").textContent = CONFIG.title;
  document.getElementById("pageSubtitle").textContent = CONFIG.subtitle;
  document.title = CONFIG.title;

  // Create map
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: CONFIG.center,
    zoom: CONFIG.zoom,
    pitch: CONFIG.pitch,
    bearing: CONFIG.bearing,
    antialias: true
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  // Load GeoJSON
  const response = await fetch("./data.geojson");
  const geojson = await response.json();
  allFeatures = geojson.features;

  map.on("load", () => {
    add3DBuildings();
    addPlacesLayers();
    buildFilters();
    buildTableHead();
    applyFilters();
  });
}

// --- 3D Buildings ---

function add3DBuildings() {
  const layers = map.getStyle().layers;
  let labelLayerId;
  for (const layer of layers) {
    if (layer.type === "symbol" && layer.layout && layer.layout["text-field"]) {
      labelLayerId = layer.id;
      break;
    }
  }

  map.addLayer(
    {
      id: "3d-buildings",
      source: "openmaptiles",
      "source-layer": "building",
      type: "fill-extrusion",
      minzoom: 13,
      paint: {
        "fill-extrusion-color": "#c8cdd4",
        "fill-extrusion-height": [
          "interpolate", ["linear"], ["zoom"],
          13, 0,
          15, ["coalesce", ["get", "render_height"], 10]
        ],
        "fill-extrusion-base": [
          "interpolate", ["linear"], ["zoom"],
          13, 0,
          15, ["coalesce", ["get", "render_min_height"], 0]
        ],
        "fill-extrusion-opacity": 0.65
      }
    },
    labelLayerId
  );
}

// --- Places source + marker layers ---

function addPlacesLayers() {
  map.addSource("places", {
    type: "geojson",
    data: { type: "FeatureCollection", features: allFeatures }
  });

  // Shadow
  map.addLayer({
    id: "places-shadow",
    type: "circle",
    source: "places",
    paint: {
      "circle-radius": 10,
      "circle-color": "rgba(0,0,0,0.25)",
      "circle-blur": 0.8,
      "circle-translate": [1, 2]
    }
  });

  // Marker
  map.addLayer({
    id: "places-layer",
    type: "circle",
    source: "places",
    paint: {
      "circle-radius": 8,
      "circle-color": CONFIG.markerColor,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2.5,
      "circle-pitch-alignment": "map"
    }
  });

  map.on("click", "places-layer", (e) => {
    showPopup(e.features[0]);
  });

  map.on("mouseenter", "places-layer", () => {
    map.getCanvas().style.cursor = "pointer";
  });

  map.on("mouseleave", "places-layer", () => {
    map.getCanvas().style.cursor = "";
  });
}

// --- Popup (shared between map click and table click) ---

function showPopup(feature) {
  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const name = props[CONFIG.nameField] || "";

  const rows = CONFIG.popupFields
    .filter(f => props[f.property] !== null && props[f.property] !== undefined && props[f.property] !== "")
    .map(f => {
      let val = props[f.property];
      if (f.property === "inspection_score") val = `${val}/100`;
      return `<div class="popup-row"><strong>${f.label}:</strong>&nbsp;${val}</div>`;
    })
    .join("");

  const navHtml = `
    <div class="popup-nav">
      <a class="popup-nav-google" href="https://www.google.com/maps/search/?api=1&query=${lat},${lng}" target="_blank" rel="noopener">Google</a>
      <a class="popup-nav-apple" href="https://maps.apple.com/?q=${lat},${lng}" target="_blank" rel="noopener">Apple</a>
      <a class="popup-nav-waze" href="https://waze.com/ul?ll=${lat},${lng}&navigate=yes" target="_blank" rel="noopener">Waze</a>
    </div>`;

  if (currentPopup) currentPopup.remove();

  currentPopup = new maplibregl.Popup({ maxWidth: "280px" })
    .setLngLat([lng, lat])
    .setHTML(`<div class="popup-title">${name}</div>${rows}${navHtml}`)
    .addTo(map);
}

// --- Filters (built dynamically from CONFIG.filters) ---

function buildFilters() {
  const container = document.getElementById("filters");
  container.innerHTML = "";

  CONFIG.filters.forEach(f => {
    const group = document.createElement("div");
    group.className = "filter-group";

    const label = document.createElement("label");
    label.textContent = f.label;

    const select = document.createElement("select");
    select.dataset.property = f.property;

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    select.appendChild(allOption);

    getUniqueValues(f.property).forEach(val => {
      const option = document.createElement("option");
      option.value = val;
      option.textContent = val;
      select.appendChild(option);
    });

    select.addEventListener("change", applyFilters);

    group.appendChild(label);
    group.appendChild(select);
    container.appendChild(group);
  });
}

function getUniqueValues(property) {
  const values = allFeatures.map(f => f.properties[property]);
  return [...new Set(values)].sort();
}

// --- Filter logic ---

function applyFilters() {
  const selects = document.querySelectorAll("#filters select");
  const activeFilters = [];

  selects.forEach(select => {
    if (select.value !== "all") {
      activeFilters.push({ property: select.dataset.property, value: select.value });
    }
  });

  const filtered = allFeatures.filter(feature => {
    const p = feature.properties;
    return activeFilters.every(f => p[f.property] === f.value);
  });

  updateMap(filtered);
  updateTable(filtered);
  updateCount(filtered);
  fitMapToFeatures(filtered);
}

// --- Map update ---

function updateMap(features) {
  const source = map.getSource("places");
  if (!source) return;
  source.setData({ type: "FeatureCollection", features });
}

// --- Table (built dynamically from CONFIG.columns) ---

function buildTableHead() {
  const thead = document.getElementById("tableHead");
  const tr = document.createElement("tr");

  CONFIG.columns.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.header;
    tr.appendChild(th);
  });

  thead.innerHTML = "";
  thead.appendChild(tr);
}

function updateTable(features) {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = "";

  features.forEach(feature => {
    const p = feature.properties;
    const row = document.createElement("tr");

    CONFIG.columns.forEach(col => {
      const td = document.createElement("td");
      td.textContent = p[col.property] || "";
      row.appendChild(td);
    });

    row.addEventListener("click", () => {
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 15.5,
        pitch: 50,
        bearing: -10,
        duration: 1500,
        essential: true
      });
      showPopup(feature);
    });

    tableBody.appendChild(row);
  });
}

// --- Count ---

function updateCount(features) {
  document.getElementById("resultCount").textContent = `${features.length} results`;
}

// --- Fit bounds ---

function fitMapToFeatures(features) {
  if (features.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  features.forEach(f => bounds.extend(f.geometry.coordinates));

  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: 15,
    pitch: CONFIG.pitch,
    bearing: CONFIG.bearing,
    duration: 800
  });
}

init();
