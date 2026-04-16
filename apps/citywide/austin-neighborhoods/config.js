// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Historic and Emerging Neighborhoods of Austin, Texas",
  eyebrow:  "Austin Metro",
  subtitle: "A survey of central, historic, and master-planned Austin communities",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "A map of Austin neighborhoods spanning 19th-century freedmen's districts, early streetcar suburbs, mid-century ranch areas, and 21st-century master-planned communities. Filter by area to explore different parts of the city.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.754, 30.264],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#2B6CB0",
  // markerIconStyle: "golf" | "drop" (water) | "pin" (simple) — default: "golf"
  markerIconStyle: "pin",

  // ── Geographic bounds lock ────────────────────────────────
  maxBounds: [[-98.04, 29.97], [-97.47, 30.62]],

  // ── Theme overrides (leave undefined to use defaults) ────────
  // theme: {
  //   headerBg:    "#1a4d0e",   // header bar background
  //   pageBg:      "#e4ede0",   // page / table background
  //   fontHeading: "Oswald",    // heading font (Google Font name)
  //   fontBody:    "Barlow",    // body font (Google Font name)
  // },

  // ── Reddit search ─────────────────────────────────────────
  redditCity: "Austin",

  // ── Feature flags ─────────────────────────────────────────
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
  overlays: [
    { label: "Zip Codes",    file: "../../shared/SecondData.geojson",        colorProperty: "zipcode"       },
    { label: "Flood Zone",   file: "../../shared/floodzone.geojson",         colorProperty: "flood_zone"    },
    { label: "City Council", file: "../../shared/Council_Districts.geojson", colorProperty: "district_name" },
  ],

  // ── Data schema ───────────────────────────────────────────
  nameField: "name",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "area", label: "Area" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "name",     header: "Neighborhood" },
    { property: "area",     header: "Area"         },
    { property: "category", header: "Type"         },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "area",        label: "Area"  },
    { property: "category",    label: "Type"  },
    { property: "description", label: "About" },
  ]
};
