// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Austin Coffee Shops",
  eyebrow:  "Austin Metro",
  subtitle: "",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "This map showcases coffee shops, cafés, and tea houses across the Austin metro area. Each pin reflects a real location with available details such as health inspection scores, contact info, outdoor seating, and more. Use the filters below the map to narrow results, or click any marker or table row to explore a location in depth.",

  // ── Map defaults ──────────────────────────────────────────
  center:      [-97.743, 30.267],
  zoom:        12,
  pitch:       45,
  bearing:     -15,
  markerColor: "#6b3a2a",

  // ── Geographic bounds lock ────────────────────────────────
  // null = unlimited panning (default for city-wide maps)
  // [[minLng, minLat], [maxLng, maxLat]] = lock to a bounding box
  // Example for Rainey Street: [[-97.745, 30.250], [-97.732, 30.265]]
  maxBounds: null,

  // ── Reddit search ─────────────────────────────────────────
  // Appended to every Reddit search: "<name> Austin"
  redditCity: "Austin",

  // ── Feature flags ─────────────────────────────────────────
  // Set any to false to hide that button/feature entirely
  features: {
    drawTools:   true,
    measure:     true,
    exportPNG:   true,
    exportCSV:   true,
    reportPDF:   true,
    streetView:  true,
    satellite:   true,
    topo:        true,
    darkMode:    true,
    geolocation: true,
  },

  // ── Social footer links ───────────────────────────────────
  // Set url to "" to hide that icon in the footer
  socialLinks: [
    { platform: "youtube",   url: "" },
    { platform: "x",         url: "" },
    { platform: "facebook",  url: "" },
    { platform: "instagram", url: "" },
    { platform: "reddit",    url: "" },
    { platform: "patreon",   url: "" },
    { platform: "discord",   url: "" },
  ],

  // ── Overlay layers ────────────────────────────────────────
  // Each entry adds a checkbox to the "Layers" panel on the map.
  // colorProperty: the GeoJSON property used to color-code polygons.
  // Add as many as needed — no limit.
  overlays: [
    { label: "Zip Codes",    file: "../shared/SecondData.geojson",        colorProperty: "zipcode"       },
    { label: "Flood Zone",   file: "../shared/floodzone.geojson",         colorProperty: "flood_zone"    },
    { label: "City Council", file: "../shared/Council_Districts.geojson", colorProperty: "district_name" },
  ],

  // ── Data schema ───────────────────────────────────────────
  // Which GeoJSON property is the display name (popup title + Reddit search)
  nameField: "name",

  // Google Maps Embed API key — required for the Street View popup tab.
  // Get one at https://console.cloud.google.com/ (Maps Embed API)
  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  // Each becomes a dropdown above the table; values auto-populated from data
  filters: [
    { property: "type",            label: "Type" },
    { property: "outdoor_seating", label: "Outdoor Seating" }
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "name",      header: "Name" },
    { property: "type",      header: "Type" },
    { property: "address",   header: "Address" },
    { property: "phone",     header: "Phone" },
    { property: "website",   header: "Website" },
    { property: "instagram", header: "Instagram" }
  ],

  // ── Popup detail rows ─────────────────────────────────────
  // (name is always shown as the popup title)
  popupFields: [
    { property: "type",             label: "Type" },
    { property: "address",          label: "Address" },
    { property: "phone",            label: "Phone" },
    { property: "website",          label: "Website" },
    { property: "instagram",        label: "Instagram" },
    { property: "wifi",             label: "Wi-Fi" },
    { property: "outdoor_seating",  label: "Outdoor Seating" },
    { property: "drive_through",    label: "Drive-Through" },
    { property: "inspection_score", label: "Health Score" },
    { property: "inspection_date",  label: "Last Inspected" }
  ]
};
