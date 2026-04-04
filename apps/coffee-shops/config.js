// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // Page text
  title: "Austin Coffee Shops",
  eyebrow: "Austin Metro",
  subtitle: "",

  // Map defaults
  center: [-97.743, 30.267],
  zoom: 12,
  pitch: 45,
  bearing: -15,
  markerColor: "#6b3a2a",

  // Overlay 1 — SecondData.geojson
  overlayLabel: "Zip Codes",
  overlayColorProperty: "zipcode",

  // Overlay 2 — floodzone.geojson
  overlay2Label: "Flood Zone",
  overlay2ColorProperty: "flood_zone",

  // Overlay 3 — Council_Districts.geojson
  overlay3Label: "City Council",
  overlay3ColorProperty: "district_name",

  // Which GeoJSON property is the display name (used as popup title)
  nameField: "name",

  // Filters — each becomes a dropdown; values auto-populated from data
  filters: [
    { property: "type",             label: "Type" },
    { property: "wifi",             label: "Wi-Fi" },
    { property: "outdoor_seating",  label: "Outdoor Seating" }
  ],

  // Table columns (lat/lng excluded from CSV via csv:false)
  columns: [
    { property: "name",    header: "Name" },
    { property: "type",    header: "Type" },
    { property: "address", header: "Address" },
    { property: "phone",   header: "Phone" },
    { property: "website", header: "Website" },
    { property: "lat",     header: "Lat", csv: false },
    { property: "lng",     header: "Lng", csv: false }
  ],

  // Popup detail rows (name is always shown as the title)
  popupFields: [
    { property: "type",             label: "Type" },
    { property: "address",          label: "Address" },
    { property: "phone",            label: "Phone" },
    { property: "website",          label: "Website" },
    { property: "wifi",             label: "Wi-Fi" },
    { property: "outdoor_seating",  label: "Outdoor Seating" },
    { property: "drive_through",    label: "Drive-Through" },
    { property: "inspection_score", label: "Health Score" },
    { property: "inspection_date",  label: "Last Inspected" }
  ]
};
