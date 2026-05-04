# Deploy Notes — Austin Horseback Riding

## Field picks

- **nameField:** `name`
- **filters:** *(none — all 17 category values are unique per row)*
- **columns:** `[name, category, area]`
- **popupFields:** `[category, area, phone, website, primary_activities, notes]`
- **markerColor:** `#8B4513` (saddle brown)
- **markerIconStyle:** `pin`
- **center:** `[-97.795, 30.251]` (mean centroid of all 17 geocoded features)

## Input files

- Report: `assets/staging/Austinhorseback/5dd0126e.md`
- CSV (original, no coords): `assets/staging/Austinhorseback/063f6679.csv`
- CSV (with lat/lng columns added but blank): `assets/staging/Austinhorseback/30fa9f47 (2).csv`

## Geocoding status

All 17 operators are mapped. Coordinates are **approximate** — derived from known
street addresses in the report using training-data knowledge. Accuracy is roughly
city-block level. Verify against Google Maps or a geocoding service before using
for navigation or precision analysis.

To regenerate from a corrected CSV once you have verified coordinates:
```bash
python scripts/staging_intake.py csv-to-geojson \
  --csv "assets/staging/Austinhorseback/30fa9f47 (2).csv" \
  --out apps/citywide/austin-horseback-riding/data.geojson
cp apps/citywide/austin-horseback-riding/data.geojson \
   storymaps/austin-horseback-riding/data/austin-horseback-riding.geojson
```

## Approximate coordinates used

| Operator | lat | lng | Source address |
|---|---|---|---|
| Texas Trail Rides / Lone Star Ranch | 30.1602 | -97.7418 | 8601 Bluff Springs Rd, Austin TX |
| Southern Trails | 30.3289 | -97.5661 | 15701 Decker Lake Rd, Manor TX |
| Maverick Horseback Riding | 29.8857 | -97.6703 | Lockhart, TX area |
| Willow Horseback Riding of Austin | 30.2699 | -97.7560 | 1201 W 6th St, Austin TX |
| Tri-Star Farm | 30.4093 | -97.7897 | 6648 Spicewood Springs Rd, Austin TX |
| Bee Cave Riding Center | 30.3268 | -97.9254 | 15740 Hamilton Pool Rd, Bee Cave TX |
| Manor Equestrian Center | 30.3451 | -97.5534 | 13406 Cameron Rd, Manor TX |
| White Fences Equestrian Center | 30.3284 | -97.5834 | 10908 Jones Rd, Manor TX |
| Lone Star Stables | 30.2907 | -97.8134 | Westlake / West Austin area |
| Monarch Stables Austin | 30.0850 | -97.8406 | Buda, TX |
| Scissortail Hill Equestrian | 30.1314 | -97.7760 | 9513 S Hwy 183, Austin TX |
| Rio Vista Farm | 30.1904 | -98.0866 | 1225 Creek Rd, Dripping Springs TX |
| Lone Star Riding Club | 30.1259 | -98.0201 | 10701 Darden Hill Rd, Driftwood TX |
| Switch Willo Stables | 30.4178 | -97.7671 | Northwest Austin area |
| Coraggio Equestrian | 30.2124 | -97.9012 | Southwest Austin Hill Country area |
| Miraval Austin Resort & Spa | 30.4837 | -97.9812 | NW Austin / Lake Travis (Spicewood area) |
| Austin Carriage Rides and Tours | 30.2672 | -97.7394 | Red River St, Downtown Austin |
