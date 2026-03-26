let map;
let allFeatures = [];

async function init() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [-97.7431, 30.2672],
    zoom: 13,
    pitch: 45,
    bearing: -15,
    antialias: true
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  const response = await fetch("./data.geojson");
  const geojson = await response.json();
  allFeatures = geojson.features;

  map.on("load", () => {
    // Find the first symbol layer to insert buildings beneath labels
    const layers = map.getStyle().layers;
    let labelLayerId;
    for (let i = 0; i < layers.length; i++) {
      if (layers[i].type === "symbol" && layers[i].layout && layers[i].layout["text-field"]) {
        labelLayerId = layers[i].id;
        break;
      }
    }

    // Add 3D building extrusion layer
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

    // Add places data source
    map.addSource("places", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: allFeatures
      }
    });

    // Shadow layer for drop-shadow effect on markers
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

    // Main marker layer
    map.addLayer({
      id: "places-layer",
      type: "circle",
      source: "places",
      paint: {
        "circle-radius": 8,
        "circle-color": "#e63946",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2.5,
        "circle-pitch-alignment": "map"
      }
    });

    map.on("click", "places-layer", (e) => {
      const feature = e.features[0];
      const props = feature.properties;
      const coords = feature.geometry.coordinates.slice();

      new maplibregl.Popup()
        .setLngLat(coords)
        .setHTML(`
          <div class="popup-title">${props.name}</div>
          <div class="popup-row"><strong>Type:</strong> ${props.type}</div>
          <div class="popup-row"><strong>Outdoor:</strong> ${props.outdoor}</div>
          <div class="popup-row"><strong>Wi-Fi:</strong> ${props.wifi}</div>
          <div class="popup-row"><strong>Neighborhood:</strong> ${props.neighborhood}</div>
        `)
        .addTo(map);
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

function getUniqueValues(field) {
  const values = allFeatures.map(f => f.properties[field]);
  return [...new Set(values)].sort();
}

function fillDropdown(selectId, values) {
  const select = document.getElementById(selectId);

  values.forEach(value => {
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

  const filtered = allFeatures.filter(feature => {
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

  features.forEach(feature => {
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
      const coords = feature.geometry.coordinates;
      map.flyTo({
        center: coords,
        zoom: 15.5,
        pitch: 50,
        bearing: -10,
        duration: 1500,
        essential: true
      });

      new maplibregl.Popup()
        .setLngLat(coords)
        .setHTML(`
          <div class="popup-title">${p.name}</div>
          <div class="popup-row"><strong>Type:</strong> ${p.type}</div>
          <div class="popup-row"><strong>Outdoor:</strong> ${p.outdoor}</div>
          <div class="popup-row"><strong>Wi-Fi:</strong> ${p.wifi}</div>
          <div class="popup-row"><strong>Neighborhood:</strong> ${p.neighborhood}</div>
        `)
        .addTo(map);
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

  features.forEach(feature => {
    bounds.extend(feature.geometry.coordinates);
  });

  map.fitBounds(bounds, {
    padding: 60,
    maxZoom: 15,
    pitch: 45,
    bearing: -15,
    duration: 800
  });
}

init();
