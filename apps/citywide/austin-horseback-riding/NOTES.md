# Deploy Notes — Austin Horseback Riding

## Field picks

- **nameField:** `name`
- **filters:** *(none — category values are too unique per row for effective filtering)*
- **columns:** `[name, category, area]`
- **popupFields:** `[category, area, phone, website, primary_activities, notes]`
- **markerColor:** `#8B4513` (saddle brown)
- **markerIconStyle:** `pin`
- **center:** `[-97.74, 30.30]` (Austin centroid — no geocoded features yet)

## Input files

- Report: `assets/staging/Austinhorseback/5dd0126e.md`
- CSV: `assets/staging/Austinhorseback/063f6679.csv`

## Geocoding status

**The staging CSV has no `latitude` or `longitude` columns.** All 17 operators need
to be geocoded before they will appear on the map.

To add coordinates:
1. Add `latitude` and `longitude` columns to `063f6679.csv`
2. Fill in coords for each row
3. Re-run:
   ```bash
   python scripts/staging_intake.py csv-to-geojson \
     --csv "assets/staging/Austinhorseback/063f6679.csv" \
     --out apps/citywide/austin-horseback-riding/data.geojson
   ```
4. Also copy the updated GeoJSON to:
   ```bash
   cp apps/citywide/austin-horseback-riding/data.geojson \
      storymaps/austin-horseback-riding/data/austin-horseback-riding.geojson
   ```

## All 17 operators (need geocoding)

1. Texas Trail Rides / Lone Star Ranch — 8601 Bluff Springs Rd, SE Austin
2. Southern Trails — 15701 Decker Lake Rd, Manor (NE of Austin)
3. Maverick Horseback Riding — Lockhart / Central Texas area
4. Willow Horseback Riding of Austin — 1201 W 6th St, Central Austin
5. Tri-Star Farm — 6648 Spicewood Springs Rd, NW Austin
6. Bee Cave Riding Center — 15740 Hamilton Pool Rd, Bee Cave
7. Manor Equestrian Center — 13406 Cameron Rd, Manor
8. White Fences Equestrian Center — 10908 Jones Rd, Manor
9. Lone Star Stables (Lone Star Equestrian Center) — Westlake / W Austin
10. Monarch Stables Austin — Buda, TX
11. Scissortail Hill Equestrian — 9513 S Hwy 183, South Austin
12. Rio Vista Farm — 1225 Creek Rd, Dripping Springs
13. Lone Star Riding Club — 10701 Darden Hill Rd, Driftwood
14. Switch Willo Stables — NW Austin
15. Coraggio Equestrian — SW Austin (12+ acres shaded trails)
16. Miraval Austin Resort & Spa — NW Austin / Lake Travis area
17. Austin Carriage Rides and Tours — Downtown Austin (Red River St)
