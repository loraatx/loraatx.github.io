let map;
let allFeatures = [];
let popup;

async function init() {
  const response = await fetch("./data.geojson");
  const geojson = await response.json();
  allFeatures = geojson.features;

  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [-97.7431, 30.2672],
    zoom: 15,
    pitch: 60,
    bearing: -17.6,
    antialias: true
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  map.on("load", () => {
    add3DBuildings();

    map.addSource("places", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: allFeatures
      }
    });

    map.addLayer({
      id: "places-layer",
      type: "circle",
      source: "places",
      paint: {
        "circle-radius": 7,
        "circle-color": "#2c7be5",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2
      }
    });

    map.on("click", "places-layer", (e) => {
      const feature = e.features[0];
      showPopup(feature);
    });

    map.on("mouseenter", "places-layer", () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", "places-layer", () => {
      map.getCanvas().style.cursor = "";
    });

    fillDropdown("filterType", getUniqueValues("type"));
    fillDropdown("filterOutdoor", getUniqueValues("outdoor"));
    fillDropdown("filterWifi", getUniqueValues("wifi"));

    document.getElementById("filterType").addEventListener("change", applyFilters);
    document.getElementById("filterOutdoor").addEventListener("change", applyFilters);
    document.getElementById("filterWifi").addEventListener("change", applyFilters);

    applyFilters();
  });
}

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
      filter: ["==", ["get", "extrude"], "true"],
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        "fill-extrusion-color": "#aaa",
        "fill-extrusion-height": ["get", "render_height"],
        "fill-extrusion-base": ["get", "render_min_height"],
        "fill-extrusion-opacity": 0.7
      }
    },
    labelLayerId
  );
}

function getUniqueValues(field) {
  const values = allFeatures.map(feature => feature.properties[field]);
  return [...new Set(values)].sort();
}

function fillDropdown(selectId, values) {
  const select = document.getElementById(selectId);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function applyFilters() {
  const typeValue = document.getElementById("filterType").value;
  const outdoorValue = document.getElementById("filterOutdoor").value;
  const wifiValue = document.getElementById("filterWifi").value;

  const filtered = allFeatures.filter((feature) => {
    const p = feature.properties;

    const matchesType = typeValue === "all" || p.type === typeValue;
    const matchesOutdoor = outdoorValue === "all" || p.outdoor === outdoorValue;
    const matchesWifi = wifiValue === "all" || p.wifi === wifiValue;

    return matchesType && matchesOutdoor && matchesWifi;
  });

  updateMap(filtered);
  updateTable(filtered);
  updateCount(filtered);
  fitMapToFeatures(filtered);
}

function updateMap(features) {
  const source = map.getSource("places");
  if (!source) return;

  source.setData({
    type: "FeatureCollection",
    features: features
  });
}

function updateTable(features) {
  const tableBody = document.getElementById("tableBody");
  tableBody.innerHTML = "";

  features.forEach((feature) => {
    const p = feature.properties;
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${p.name}</td>
      <td>${p.type}</td>
      <td>${p.outdoor}</td>
      <td>${p.wifi}</td>
      <td>${p.neighborhood}</td>
    `;

    row.addEventListener("click", () => {
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 16,
        pitch: 60,
        bearing: -17.6
      });

      showPopup(feature);
    });

    tableBody.appendChild(row);
  });
}

function updateCount(features) {
  document.getElementById("resultCount").textContent = `${features.length} results`;
}

function fitMapToFeatures(features) {
  if (features.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();

  features.forEach((feature) => {
    bounds.extend(feature.geometry.coordinates);
  });

  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: 16,
    duration: 500
  });

  map.once("moveend", () => {
    if (map.getZoom() >= 15) {
      map.easeTo({
        pitch: 60,
        bearing: -17.6,
        duration: 400
      });
    }
  });
}

function showPopup(feature) {
  const p = feature.properties;
  const coords = feature.geometry.coordinates.slice();

  if (popup) popup.remove();

  popup = new maplibregl.Popup()
    .setLngLat(coords)
    .setHTML(`
      <div class="popup-title">${p.name}</div>
      <div class="popup-row"><strong>Type:</strong> ${p.type}</div>
      <div class="popup-row"><strong>Outdoor:</strong> ${p.outdoor}</div>
      <div class="popup-row"><strong>Wi-Fi:</strong> ${p.wifi}</div>
      <div class="popup-row"><strong>Neighborhood:</strong> ${p.neighborhood}</div>
    `)
    .addTo(map);
}

init();
