// app.js — Austin Parcels viewer.
//
// Data flow:
//   PMTiles vector tileset (Supabase Storage, public bucket)
//     -> MapLibre vector source -> fill+line layers
//   Click a parcel -> read parcel_id from the MVT feature
//     -> Supabase PostgREST select * where parcel_id = id
//     -> render popup

(function () {
  const CFG = window.PARCELS_CONFIG;
  if (!CFG) {
    console.error('PARCELS_CONFIG missing; did config.js load?');
    return;
  }

  // --- PMTiles protocol registration ---------------------------------------
  const pmProtocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', pmProtocol.tile);

  // --- Supabase client ------------------------------------------------------
  const { createClient } = window.supabase;
  const sb = createClient(CFG.supabase.url, CFG.supabase.anonKey, {
    auth: { persistSession: false }
  });

  // --- Map ------------------------------------------------------------------
  const map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        basemap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        },
        parcels: {
          type: 'vector',
          url: CFG.pmtiles.url,
          promoteId: 'parcel_id'
        }
      },
      layers: [
        { id: 'basemap', type: 'raster', source: 'basemap' },
        {
          id: 'parcels-fill',
          type: 'fill',
          source: 'parcels',
          'source-layer': CFG.pmtiles.sourceLayer,
          minzoom: CFG.pmtiles.minzoom,
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], '#ffb703',
              ['boolean', ['feature-state', 'hover'],    false], '#8ecae6',
              '#cfd8dc'
            ],
            'fill-opacity': 0.55,
            'fill-outline-color': '#455a64'
          }
        },
        {
          id: 'parcels-line',
          type: 'line',
          source: 'parcels',
          'source-layer': CFG.pmtiles.sourceLayer,
          minzoom: CFG.pmtiles.minzoom,
          paint: {
            'line-color': '#37474f',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.2, 16, 1.2]
          }
        }
      ]
    },
    center:    CFG.center,
    zoom:      CFG.zoom,
    maxBounds: CFG.maxBounds
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'imperial' }), 'bottom-left');

  // --- Zoom-hint banner -----------------------------------------------------
  const zoomHint = document.getElementById('zoom-hint');
  function updateZoomHint() {
    if (!zoomHint) return;
    zoomHint.hidden = map.getZoom() >= CFG.zoomHintThreshold;
  }
  map.on('load', updateZoomHint);
  map.on('zoomend', updateZoomHint);

  // --- Hover feature-state --------------------------------------------------
  const SRC = { source: 'parcels', sourceLayer: CFG.pmtiles.sourceLayer };
  let hoverId = null;

  map.on('mousemove', 'parcels-fill', (e) => {
    if (!e.features || e.features.length === 0) return;
    const id = e.features[0].id;
    if (id == null) return;
    if (hoverId !== null && hoverId !== id) {
      map.setFeatureState({ ...SRC, id: hoverId }, { hover: false });
    }
    hoverId = id;
    map.setFeatureState({ ...SRC, id }, { hover: true });
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', 'parcels-fill', () => {
    if (hoverId !== null) {
      map.setFeatureState({ ...SRC, id: hoverId }, { hover: false });
    }
    hoverId = null;
    map.getCanvas().style.cursor = '';
  });

  // --- Click: read parcel_id from tile, query Supabase, show popup ---------
  let selectedId = null;

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderPopup(data) {
    const rows = [];
    rows.push(['Parcel ID', data.parcel_id]);
    rows.push(['Zoning', data.zoning || '—']);

    // Render any keys the metadata jsonb carries so v1.1 enrichment
    // (address, owner, value, etc.) shows up without editing this file.
    if (data.metadata && typeof data.metadata === 'object') {
      for (const [k, v] of Object.entries(data.metadata)) {
        if (v == null || v === '') continue;
        rows.push([k, typeof v === 'object' ? JSON.stringify(v) : String(v)]);
      }
    }

    const dl = rows.map(([k, v]) =>
      `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`
    ).join('');

    return `<div class="parcel-popup"><dl>${dl}</dl></div>`;
  }

  map.on('click', 'parcels-fill', async (e) => {
    if (!e.features || e.features.length === 0) return;
    const f = e.features[0];
    const id = f.id != null ? f.id : f.properties && f.properties.parcel_id;
    if (id == null) return;

    if (selectedId !== null && selectedId !== id) {
      map.setFeatureState({ ...SRC, id: selectedId }, { selected: false });
    }
    selectedId = id;
    map.setFeatureState({ ...SRC, id }, { selected: true });

    const popup = new maplibregl.Popup({ maxWidth: '320px', offset: 8 })
      .setLngLat(e.lngLat)
      .setHTML(`<div class="parcel-popup"><em>Loading parcel ${escapeHtml(id)}…</em></div>`)
      .addTo(map);

    popup.on('close', () => {
      if (selectedId !== null) {
        map.setFeatureState({ ...SRC, id: selectedId }, { selected: false });
        selectedId = null;
      }
    });

    try {
      const { data, error } = await sb
        .from('parcels')
        .select('parcel_id,zoning,metadata')
        .eq('parcel_id', String(id))
        .maybeSingle();

      if (error) {
        popup.setHTML(
          `<div class="parcel-popup"><strong>Parcel ${escapeHtml(id)}</strong>` +
          `<p class="err">Lookup failed: ${escapeHtml(error.message)}</p></div>`
        );
        return;
      }
      if (!data) {
        popup.setHTML(
          `<div class="parcel-popup"><strong>Parcel ${escapeHtml(id)}</strong>` +
          `<p class="err">No attribute row found in Supabase.</p></div>`
        );
        return;
      }
      popup.setHTML(renderPopup(data));
    } catch (err) {
      popup.setHTML(
        `<div class="parcel-popup"><strong>Parcel ${escapeHtml(id)}</strong>` +
        `<p class="err">${escapeHtml(err.message || String(err))}</p></div>`
      );
    }
  });

  // --- Source-load diagnostics ---------------------------------------------
  map.on('error', (e) => {
    console.warn('[parcels] map error', e && e.error ? e.error : e);
  });
})();
