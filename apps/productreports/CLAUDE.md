# apps/citywide

This folder contains the map apps that power the **Product Intelligence Reports**. Each subfolder is a self-contained app served at its own URL slug (e.g. `/apps/citywide/austin-bike-shops/`).

## Apps are identical and modular

All apps share the same `app.js`, `style.css`, `index.html`, and favicon files — these are never modified per-app. The only files that differ between apps are:

| File | Purpose |
|------|---------|
| `config.js` | All app-specific settings (title, theme, filters, columns, map center, etc.) |
| `data.geojson` | The location data for that app's subject |

## Creating a new app

Copy the `template/` folder and rename it to your desired URL slug, then edit only `config.js` and `data.geojson`.

```
cp -r apps/citywide/template apps/citywide/your-new-slug
```

All `config.js` fields are documented inline. The `nameField` value must match a property key in `data.geojson`.
