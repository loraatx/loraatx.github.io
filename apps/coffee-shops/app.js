let map;
let allFeatures = [];
let filteredFeatures = [];
let currentPopup;
let draw;
let measuring = false;

// --- 2D/3D view toggle ---

let is3D = true;

function initViewToggle() {
  const btn = document.getElementById("viewToggle");
  btn.addEventListener("click", () => {
    is3D = !is3D;
    btn.textContent = is3D ? "2D" : "3D";
    if (is3D) {
      map.easeTo({ pitch: CONFIG.pitch, bearing: CONFIG.bearing, duration: 600 });
      map.setLayoutProperty("3d-buildings", "visibility", "visible");
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
      map.setLayoutProperty("3d-buildings", "visibility", "none");
    }
  });
}

// --- Satellite view toggle ---

function initSatellite() {
  map.addSource("satellite", {
    type: "raster",
    tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    attribution: "Tiles &copy; Esri"
  });

  map.addLayer({
    id: "satellite-layer",
    type: "raster",
    source: "satellite",
    layout: { visibility: "none" }
  }, map.getStyle().layers[1].id);

  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      this._btn = document.createElement("button");
      this._btn.className = "satellite-btn";
      this._btn.textContent = "Satellite";
      this._btn.onclick = () => {
        const on = map.getLayoutProperty("satellite-layer", "visibility") === "visible";
        map.setLayoutProperty("satellite-layer", "visibility", on ? "none" : "visible");
        this._btn.classList.toggle("active", !on);
      };
      this._container.appendChild(this._btn);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "top-left");
}

// --- Draw tools (terra-draw) ---

function initDraw() {
  var TD = window.terraDraw;
  var TDA = window.terraDrawMaplibreGlAdapter;

  draw = new TD.TerraDraw({
    adapter: new TDA.TerraDrawMapLibreGLAdapter({ map: map, lib: maplibregl }),
    modes: [
      new TD.TerraDrawLineStringMode()
    ]
  });

  draw.start();

  // Mode buttons
  document.querySelectorAll("[data-draw-mode]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      measuring = false;
      map.getCanvas().style.cursor = "";
      document.getElementById("measureBtn").classList.remove("active");
      draw.setMode(btn.dataset.drawMode);
      document.querySelectorAll("[data-draw-mode]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
  });

  // Clear button
  document.getElementById("clearDrawBtn").addEventListener("click", function () {
    draw.clear();
    document.querySelectorAll("[data-draw-mode]").forEach(function (b) { b.classList.remove("active"); });
  });
}

// --- Measure tool ---

function initMeasure() {
  var pts = [];

  map.addSource("measure-pts",  { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addSource("measure-line", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

  map.addLayer({ id: "measure-line-layer", type: "line", source: "measure-line",
    paint: { "line-color": "#e63946", "line-width": 2, "line-dasharray": [3, 2] } });

  map.addLayer({ id: "measure-pts-layer", type: "circle", source: "measure-pts",
    paint: { "circle-radius": 5, "circle-color": "#e63946", "circle-stroke-color": "#fff", "circle-stroke-width": 2 } });

  map.addLayer({ id: "measure-labels-layer", type: "symbol", source: "measure-pts",
    layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, -1.2], "text-anchor": "bottom" },
    paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 2 } });

  function haversine(a, b) {
    var R = 3958.8, toRad = function(x) { return x * Math.PI / 180; };
    var dLat = toRad(b[1] - a[1]), dLng = toRad(b[0] - a[0]);
    var x = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function redraw() {
    var total = 0;
    map.getSource("measure-pts").setData({ type: "FeatureCollection", features: pts.map(function(pt, i) {
      if (i > 0) total += haversine(pts[i - 1], pt);
      return { type: "Feature", geometry: { type: "Point", coordinates: pt },
        properties: { label: i === 0 ? "Start" : (total.toFixed(2) + " mi") } };
    })});
    map.getSource("measure-line").setData({ type: "FeatureCollection",
      features: pts.length > 1 ? [{ type: "Feature", geometry: { type: "LineString", coordinates: pts } }] : [] });
  }

  function clearMeasure() { pts = []; redraw(); }

  map.on("click", function(e) {
    if (!measuring) return;
    pts.push([e.lngLat.lng, e.lngLat.lat]);
    redraw();
  });

  var btn = document.getElementById("measureBtn");
  btn.addEventListener("click", function() {
    measuring = !measuring;
    btn.classList.toggle("active", measuring);
    map.getCanvas().style.cursor = measuring ? "crosshair" : "";
    if (measuring && draw) {
      draw.setMode("static");
      document.querySelectorAll("[data-draw-mode]").forEach(function(b) { b.classList.remove("active"); });
    }
  });

  document.getElementById("clearDrawBtn").addEventListener("click", clearMeasure);
}

// --- USGS Topo overlay ---

function initTopoOverlay() {
  map.addSource("usgs-topo", {
    type: "raster",
    tiles: ["https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}"],
    tileSize: 256,
    attribution: "USGS National Map"
  });

  const firstLabelLayer = map.getStyle().layers.find(
    l => l.type === "symbol" && l.layout && l.layout["text-field"]
  );

  map.addLayer({
    id: "usgs-topo-layer",
    type: "raster",
    source: "usgs-topo",
    layout: { visibility: "none" },
    paint: { "raster-opacity": 0.9 }
  }, firstLabelLayer ? firstLabelLayer.id : undefined);

  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      var lbl = document.createElement("label");
      lbl.className = "overlay-ctrl-label";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", function () {
        map.setLayoutProperty("usgs-topo-layer", "visibility", this.checked ? "visible" : "none");
      });
      var span = document.createElement("span");
      span.textContent = "Topo";
      lbl.appendChild(checkbox);
      lbl.appendChild(span);
      this._container.appendChild(lbl);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "bottom-left");
}

// --- Polygon overlays ---

async function addOverlayControl(geojsonPath, sourceId, label, colorProperty) {
  var res;
  try { res = await fetch(geojsonPath); } catch (e) {
    console.warn("Overlay fetch error:", geojsonPath, e); return;
  }
  if (!res.ok) {
    console.warn("Overlay fetch failed:", geojsonPath, res.status); return;
  }
  var data = await res.json();

  var palette = ["#4285f4","#ea4335","#fbbc04","#34a853","#ff6d00","#46bdc6","#7b1fa2","#f06292"];
  var colorExpr = "#4285f4";

  if (colorProperty) {
    var uniqueVals = [...new Set(data.features.map(function(f) { return f.properties[colorProperty]; }))];
    var matchExpr = ["match", ["get", colorProperty]];
    uniqueVals.forEach(function(val, i) { matchExpr.push(val, palette[i % palette.length]); });
    matchExpr.push("#888");
    colorExpr = matchExpr;
  }

  try {
    map.addSource(sourceId, { type: "geojson", data: data });
    map.addLayer({ id: sourceId + "-fill", type: "fill", source: sourceId,
      layout: { visibility: "none" },
      paint: { "fill-color": colorExpr, "fill-opacity": 0.2 }
    }, "places-shadow");
    map.addLayer({ id: sourceId + "-line", type: "line", source: sourceId,
      layout: { visibility: "none" },
      paint: { "line-color": colorExpr, "line-width": 1.5 }
    }, "places-shadow");
    if (colorProperty) {
      map.addLayer({ id: sourceId + "-labels", type: "symbol", source: sourceId,
        layout: {
          visibility: "none",
          "text-field": ["get", colorProperty],
          "text-size": 11,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Regular"],
          "text-max-width": 8
        },
        paint: { "text-color": "#222", "text-halo-color": "#fff", "text-halo-width": 1.5 }
      }, "places-shadow");
    }
  } catch (e) {
    console.error("Overlay layer error:", sourceId, e); return;
  }

  map.addControl({
    onAdd() {
      this._container = document.createElement("div");
      this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
      var lbl = document.createElement("label");
      lbl.className = "overlay-ctrl-label";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", function () {
        var vis = this.checked ? "visible" : "none";
        map.setLayoutProperty(sourceId + "-fill", "visibility", vis);
        map.setLayoutProperty(sourceId + "-line", "visibility", vis);
        if (colorProperty) map.setLayoutProperty(sourceId + "-labels", "visibility", vis);
      });
      var span = document.createElement("span");
      span.textContent = label;
      lbl.appendChild(checkbox);
      lbl.appendChild(span);
      this._container.appendChild(lbl);
      return this._container;
    },
    onRemove() { this._container.parentNode.removeChild(this._container); }
  }, "bottom-left");
}

async function initOverlay() {
  if (CONFIG.overlayLabel) {
    await addOverlayControl("../shared/SecondData.geojson", "overlay", CONFIG.overlayLabel, CONFIG.overlayColorProperty);
  }
  if (CONFIG.overlay2Label) {
    await addOverlayControl("../shared/floodzone.geojson", "overlay2", CONFIG.overlay2Label, CONFIG.overlay2ColorProperty);
  }
  if (CONFIG.overlay3Label) {
    await addOverlayControl("../shared/Council_Districts.geojson", "overlay3", CONFIG.overlay3Label, CONFIG.overlay3ColorProperty);
  }
}

// --- Theme toggle ---

function initTheme() {
  const btn = document.getElementById("themeToggle");
  const saved = localStorage.getItem("theme") || "light";
  applyTheme(saved);
  btn.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("theme", next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("themeToggle");
  // Show sun when dark (click to go light), moon when light (click to go dark)
  btn.textContent = theme === "dark" ? "\u2600\uFE0F" : "\uD83C\uDF19";
}

async function init() {
  initTheme();
  initReportModal();

  // Set page text from config
  document.getElementById("pageEyebrow").textContent = CONFIG.eyebrow;
  document.getElementById("pageTitle").textContent = CONFIG.title;
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
    initViewToggle();
    initSatellite();
    try { initDraw(); } catch (e) { console.error("Draw init failed:", e); }
    initMeasure();
    addPlacesLayers();
    initTopoOverlay();
    initOverlay();
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

function renderValue(val) {
  if (typeof val === "string" && val.startsWith("http")) {
    return `<a href="${val}" target="_blank" rel="noopener">${val}</a>`;
  }
  return val;
}

function showPopup(feature) {
  const props = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const name = props[CONFIG.nameField] || "";

  const rows = CONFIG.popupFields
    .filter(f => props[f.property] !== null && props[f.property] !== undefined && props[f.property] !== "")
    .map(f => {
      let val = props[f.property];
      if (f.property === "inspection_score") {
        const n = Number(val);
        const cls = n >= 90 ? "score-badge-green" : n >= 70 ? "score-badge-yellow" : "score-badge-red";
        val = `<span class="score-badge ${cls}">${n}/100</span>`;
      } else {
        val = renderValue(val);
      }
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
      const val = p[col.property] ?? "";
      if (typeof val === "string" && val.startsWith("http")) {
        const a = document.createElement("a");
        a.href = val;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = val;
        td.appendChild(a);
      } else {
        td.textContent = val;
      }
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

// --- Report modal ---

function initReportModal() {
  var list = document.getElementById("reportFieldList");
  CONFIG.columns.forEach(function(col) {
    var label = document.createElement("label");
    label.className = "report-field-item";
    var cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = col.property;
    cb.dataset.header = col.header;
    cb.addEventListener("change", updateReportModalState);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(" " + col.header));
    list.appendChild(label);
  });
  document.getElementById("reportCancelBtn").addEventListener("click", closeReportModal);
  document.getElementById("reportGenerateBtn").addEventListener("click", function() {
    var selected = [...document.querySelectorAll("#reportFieldList input:checked")]
      .map(function(cb) { return { property: cb.value, header: cb.dataset.header }; });
    closeReportModal();
    generateReport(selected);
  });
}

function openReportModal() {
  document.getElementById("reportModal").style.display = "flex";
}

function closeReportModal() {
  document.getElementById("reportModal").style.display = "none";
  document.querySelectorAll("#reportFieldList input").forEach(function(cb) {
    cb.checked = false;
    cb.disabled = false;
  });
  document.getElementById("reportGenerateBtn").disabled = true;
}

function updateReportModalState() {
  var checkboxes = [...document.querySelectorAll("#reportFieldList input")];
  var checked = checkboxes.filter(function(cb) { return cb.checked; });
  checkboxes.forEach(function(cb) {
    cb.disabled = checked.length >= 3 && !cb.checked;
  });
  document.getElementById("reportGenerateBtn").disabled = checked.length === 0;
}

function generateReport(selectedColumns) {
  if (!window.jspdf) {
    alert("PDF library not loaded. Please refresh the page and try again.");
    return;
  }
  map.once("render", function() {
    try {
      var canvas = map.getCanvas();
      var imgData = canvas.toDataURL("image/png");
      var { jsPDF } = window.jspdf;

      var pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      var pageW = pdf.internal.pageSize.getWidth();
      var pageH = pdf.internal.pageSize.getHeight();
      var margin = 12;
      var usableW = pageW - margin * 2;
      var MAX_CHARS = 150;

      // Title
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(CONFIG.title, margin, margin + 5);

      // Map image — fill ~52% of page height, maintain aspect ratio
      var mapY = margin + 12;
      var maxMapH = pageH * 0.52;
      var aspect = canvas.height / canvas.width;
      var mapH = Math.min(usableW * aspect, maxMapH);
      pdf.addImage(imgData, "PNG", margin, mapY, usableW, mapH);

      // Table
      var colW = usableW / selectedColumns.length;
      var y = mapY + mapH + 8;

      // Header row
      pdf.setFillColor(235, 235, 235);
      pdf.rect(margin, y - 4, usableW, 7, "F");
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(80);
      selectedColumns.forEach(function(col, i) {
        pdf.text(col.header.toUpperCase(), margin + i * colW + 2, y);
      });
      y += 6;

      // Data rows
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(0);
      filteredFeatures.forEach(function(f) {
        if (y > pageH - margin) { pdf.addPage(); y = margin + 8; }
        var p = f.properties;
        selectedColumns.forEach(function(col, i) {
          var val = (p[col.property] ?? "").toString();
          if (val.length > MAX_CHARS) val = val.slice(0, MAX_CHARS - 1) + "\u2026";
          pdf.text(val, margin + i * colW + 2, y, { maxWidth: colW - 4 });
        });
        y += 6;
      });

      pdf.save(CONFIG.title.replace(/[^a-z0-9]/gi, "_") + "_report.pdf");
    } catch (e) {
      console.error("Report generation failed:", e);
      alert("Could not generate report: " + e.message);
    }
  });
  map.triggerRepaint();
}

// --- Export map as PNG ---

function exportMap() {
  map.once("render", function () {
    var canvas = map.getCanvas();
    var link = document.createElement("a");
    link.download = CONFIG.title.replace(/[^a-z0-9]/gi, "_") + "_map.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
  map.triggerRepaint();
}

// --- CSV export (filtered table) ---

function exportCSV() {
  const csvColumns = CONFIG.columns.filter(c => c.csv !== false);
  const headers = csvColumns.map(c => c.header);
  const rows = filteredFeatures.map(f => {
    const p = f.properties;
    return csvColumns.map(c => {
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
}

init();
