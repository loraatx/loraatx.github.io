# Deploy notes — austin-bike-shops

Source: `assets/staging/BikeShopsAustin/`.

- title: E-Bike and Bicycle Shops in Greater Austin
- eyebrow: Austin Shopping
- subtitle: Independent, chain, and e-bike specialist shops across the metro
- marker_color: #2f855a
- marker_icon: pin
- name_field: shop_name
- category (homepage): Shopping
- filters: [type, sells_ebikes, city]
- columns: [shop_name, type, city, sells_ebikes, address]
- popup: [type, city, sells_ebikes, offers_pro_fit, austin_energy_e_ride_rebate, address, notes]

## Data profile

- 12 rows in CSV; 5 mapped (had geocoded lat/long), 7 skipped.
- Centroid of mapped features: `[-97.742, 30.353]`.

## Skipped rows (missing lat/long in CSV)

- ATX Bikes
- Mellow Johnny's Bike Shop
- Specialized Austin @ Domain Northside
- Velorangutan
- Blur Cycleworks
- Electric Avenue
- MOD BIKES

Geocode these addresses upstream in `assets/staging/BikeShopsAustin/28f0ed7b (1).csv`
and re-run staging intake to include them on the map.
