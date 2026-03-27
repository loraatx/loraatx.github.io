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
let filteredFeatures = [];
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
    antialias: true,
    preserveDrawingBuffer: true
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");
  map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: false,
    showUserLocation: true
  }), "top-right");

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

  filteredFeatures = filtered;
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

// --- Export menu toggle ---

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("exportBtn");
  const menu = document.getElementById("exportMenu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });

  document.addEventListener("click", () => {
    menu.classList.remove("open");
  });
});

// --- CSV export (filtered table) ---

function exportCSV() {
  const headers = CONFIG.columns.map(c => c.header);
  const rows = filteredFeatures.map(f => {
    const p = f.properties;
    return CONFIG.columns.map(c => {
      let val = (p[c.property] ?? "").toString();
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    }).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${CONFIG.title.replace(/[^a-z0-9]/gi, "_")}_export.csv`;
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById("exportMenu").classList.remove("open");
}

// --- PDF export (map screenshot + filtered table) ---

async function exportPDF() {
  const menu = document.getElementById("exportMenu");
  menu.classList.remove("open");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 12;

  // Title
  pdf.setFontSize(16);
  pdf.setFont(undefined, "bold");
  pdf.text(CONFIG.title, margin, margin + 6);
  pdf.setFontSize(10);
  pdf.setFont(undefined, "normal");
  pdf.setTextColor(100);
  pdf.text(CONFIG.subtitle, margin, margin + 12);
  pdf.setTextColor(0);

  // Map screenshot (use MapLibre's native canvas — html2canvas can't capture WebGL)
  const mapCanvas = map.getCanvas();
  const imgData = mapCanvas.toDataURL("image/png");
  const mapY = margin + 18;
  const mapW = pageW - margin * 2;
  const mapH = (mapCanvas.height / mapCanvas.width) * mapW;
  const clampedMapH = Math.min(mapH, pageH - mapY - margin - 10);
  pdf.addImage(imgData, "PNG", margin, mapY, mapW, clampedMapH);

  // Table on next page
  pdf.addPage();
  const headers = CONFIG.columns.map(c => c.header);
  const colW = (pageW - margin * 2) / headers.length;
  let y = margin + 6;

  // Table title
  pdf.setFontSize(12);
  pdf.setFont(undefined, "bold");
  pdf.text(`${filteredFeatures.length} Locations`, margin, y);
  y += 8;

  // Header row
  pdf.setFillColor(235, 235, 235);
  pdf.rect(margin, y - 4, pageW - margin * 2, 8, "F");
  pdf.setFontSize(8);
  pdf.setFont(undefined, "bold");
  pdf.setTextColor(80);
  headers.forEach((h, i) => {
    pdf.text(h.toUpperCase(), margin + i * colW + 2, y);
  });
  pdf.setTextColor(0);
  y += 6;

  // Data rows
  pdf.setFont(undefined, "normal");
  pdf.setFontSize(9);
  filteredFeatures.forEach(f => {
    if (y > pageH - margin) {
      pdf.addPage();
      y = margin + 6;
    }
    const p = f.properties;
    CONFIG.columns.forEach((col, i) => {
      const val = (p[col.property] ?? "").toString();
      const truncated = val.length > 35 ? val.slice(0, 33) + "..." : val;
      pdf.text(truncated, margin + i * colW + 2, y);
    });
    y += 5.5;
  });

  pdf.save(`${CONFIG.title.replace(/[^a-z0-9]/gi, "_")}_export.pdf`);
}

init();
