# Deploy notes — austin-ps5-bundles

Source: `assets/staging/NikeShoes/` (folder name is a placeholder; content is
PS5 Slim bundle data).

- title: PS5 Slim Bundles in Austin
- eyebrow: Austin Shopping
- subtitle: Where to buy a PlayStation 5 Slim across Austin retailers
- marker_color: #003087 (PlayStation blue)
- marker_icon: pin
- name_field: store_name
- category (homepage): Shopping
- filters: [retailer]
- columns: [store_name, retailer, address]
- popup: [retailer, address]

## Data profile

- 18 features across 7 retailers: Best Buy (3), Target (4), Walmart (2),
  Costco (2), Sam's Club (2), GameStop (3), Game Over Videogames (2).
- Centroid: [-97.756, 30.305].

## Skipped rows

None — every row in `b6be2161.csv` had `lat`/`lon` (the CSV uses `lat`/`lon`
rather than `latitude`/`longitude`, so `scripts/staging_intake.py
csv-to-geojson` was bypassed in favor of an inline conversion).
