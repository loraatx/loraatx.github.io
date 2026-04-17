// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "PS5 Slim Bundles in Austin",
  eyebrow:  "Austin Shopping",
  subtitle: "Where to buy a PlayStation 5 Slim across Austin retailers",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "Austin-area retail locations carrying PlayStation 5 Slim consoles and bundles — big-box, warehouse club, specialty, and local used-game shops.",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.756, 30.305],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#003087",
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
  nameField: "store_name",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "retailer", label: "Retailer" },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "store_name", header: "Store"    },
    { property: "retailer",   header: "Retailer" },
    { property: "address",    header: "Address"  },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "retailer", label: "Retailer" },
    { property: "address",  label: "Address"  },
  ]
};
