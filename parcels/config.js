// config.js — Austin Parcels app configuration.
//
// Both keys below are PUBLIC by design:
//   - supabase.anonKey is Supabase's publishable client key; access is gated
//     by RLS policies on the parcels tables.
//   - The PMTiles URL points at a public Storage bucket.
// The service-role key MUST never appear here or anywhere in /parcels/.

window.PARCELS_CONFIG = {
  supabase: {
    url:     'https://tqnklodtiithbsxxyycp.supabase.co',
    anonKey: 'sb_publishable_1GIKBIVXNF4LyL0_vYCDTQ_FZYYpZYW'
  },

  pmtiles: {
    // Served by Supabase Storage; range requests supported.
    url:         'pmtiles://https://tqnklodtiithbsxxyycp.supabase.co/storage/v1/object/public/tiles/austin-parcels.pmtiles',
    sourceLayer: 'parcels',
    minzoom:     12,
    maxzoom:     16
  },

  // Map view — center on Austin; override once you pick a specific ZIP.
  // [lng, lat]
  center:    [-97.7431, 30.2672],
  zoom:      13,
  maxBounds: [[-98.20, 30.00], [-97.40, 30.65]],

  // Below this zoom we hide parcels (they smear) and show the banner.
  zoomHintThreshold: 12
};
