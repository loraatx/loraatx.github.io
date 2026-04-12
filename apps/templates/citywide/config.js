// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Citywide Template",
  eyebrow:  "Austin Metro",
  subtitle: "",

  // Text shown in the ⓘ info flyout panel
  infoPanelText: "",

  // ── Map defaults ──────────────────────────────────────────
  center:          [-97.743, 30.267],
  zoom:            10,
  pitch:           45,
  bearing:         -15,
  markerColor:     "#2d7a1a",
  // markerIconStyle: "golf" | "drop" (water) | "pin" (simple) — default: "golf"
  markerIconStyle: "golf",

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
  nameField: "Course",

  googleMapsApiKey: "",

  // ── Filters ───────────────────────────────────────────────
  filters: [
    { property: "Type",  label: "Type"  },
    { property: "Holes", label: "Holes" },
    { property: "Area",  label: "Area"  },
  ],

  // ── Table columns ─────────────────────────────────────────
  columns: [
    { property: "Course",              header: "Course"   },
    { property: "Type",                header: "Type"     },
    { property: "Holes",               header: "Holes"    },
    { property: "Area",                header: "Area"     },
    { property: "Approx. price tier",  header: "Price"    },
  ],

  // ── Popup detail rows ─────────────────────────────────────
  popupFields: [
    { property: "Type",               label: "Type"     },
    { property: "Holes",              label: "Holes"    },
    { property: "Area",               label: "Area"     },
    { property: "Approx. price tier", label: "Price"    },
    { property: "Designer / notes",   label: "Designer" },
  ]
};
