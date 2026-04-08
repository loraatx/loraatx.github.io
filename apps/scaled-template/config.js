// ============================================================
// CONFIG — This file + data.geojson are the ONLY files that
// change between deployments. Everything else stays untouched.
// ============================================================
const CONFIG = {
  // ── Identity ──────────────────────────────────────────────
  title:    "Scaled Template",
  eyebrow:  "Downtown Austin",
  subtitle: "",

  infoPanelText: "",

  // ── Map defaults ──────────────────────────────────────────
  center:      [-97.743, 30.256],
  zoom:        16,
  pitch:       45,
  bearing:     -15,
  markerColor: "#2d7a1a",

  // Constrained to downtown Austin / both sides of Lady Bird Lake
  maxBounds: [[-97.753, 30.248], [-97.733, 30.264]],

  // ── Geographic bounds lock ────────────────────────────────

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
    { label: "Zip Codes",    file: "../shared/SecondData.geojson",        colorProperty: "zipcode"       },
    { label: "Flood Zone",   file: "../shared/floodzone.geojson",         colorProperty: "flood_zone"    },
    { label: "City Council", file: "../shared/Council_Districts.geojson", colorProperty: "district_name" },
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
