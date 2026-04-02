// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // Page text
  title: "Community Boards",
  eyebrow: "Austin Metro",
  subtitle: "",

  // Map defaults
  center: [-97.722, 30.268],
  zoom: 13,
  pitch: 45,
  bearing: -15,
  markerColor: "#e63946",

  // Overlay 1 — SecondData.geojson
  overlayLabel: "Zip Codes",
  overlayColorProperty: "zipcode",

  // Overlay 2 — floodzone.geojson
  overlay2Label: "Flood Zones",
  overlay2ColorProperty: "flood_zone",

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
