# Deploy Notes — Austin Neighborhoods

## Field picks

- **nameField:** `name`
- **filters:** `[area]` — 6 distinct values in geocoded subset (Central, South Central, Central East, North, Southwest, Southeast)
- **columns:** `[name, area, category]`
- **popupFields:** `[area, category, description]`
- **markerColor:** `#2B6CB0`
- **markerIconStyle:** `pin`
- **center:** `[-97.754, 30.264]` (mean of 8 geocoded features)

## Input files

- Report: `assets/staging/Project2neighborhoods/0ed37ac4.md`
- CSV: `assets/staging/Project2neighborhoods/62eeb85e.csv`

## Geocoding summary

8 of 32 rows have coordinates and appear on the map. The other 24 are listed below.

To add them: fill in `latitude` and `longitude` in the CSV, then re-run:

```bash
python scripts/staging_intake.py csv-to-geojson \
  --csv "assets/staging/Project2neighborhoods/62eeb85e.csv" \
  --out apps/citywide/austin-neighborhoods/data.geojson
```

## Skipped rows (missing coords)

1. Clarksville
2. Old West Austin
3. Bouldin Creek
4. Tarrytown
5. Aldridge Place
6. East Cesar Chavez
7. Holly
8. Montopolis
9. Rosewood
10. Chestnut
11. Hancock
12. Allandale
13. Rosedale
14. Brentwood
15. Crestview
16. North Loop
17. Windsor Park
18. Cherrywood
19. Barton Hills
20. South Lamar
21. Riverside
22. Avery Ranch
23. Whisper Valley
24. Onion Creek
