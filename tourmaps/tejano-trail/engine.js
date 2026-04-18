// TourEngine — drives the /tourmaps/ geofence-triggered walking-tour experience.
// All content, stop geofences, layers, and popup content come from tour.json.
// Popups fire when the user's geolocation crosses into a stop's radius, or when
// the user clicks a stop in the side panel / drags the simulate marker.

class TourEngine {
  constructor(map) {
    this.map = map;
    this.tour = null;
    this.stops = [];
    this.visited = new Set();

    this.popup = null;
    this.ytPlayer = null;
    this.ytReady = false;
    this._ytAPIPromise = null;
    this._ytPollInterval = null;

    this._watchId = null;
    this._lastCheck = null;         // { lng, lat } of last geofence check
    this._hereMarker = null;
    this._simulate = false;
    this._simMarker = null;
  }

  // ── Public API ──────────────────────────────────────────────────

  async start(url) {
    const res = await fetch(url);
    this.tour = await res.json();
    this.stops = this.tour.stops ?? [];

    const ic = this.tour.initialCamera;
    if (ic) {
      this.map.jumpTo({
        center: ic.center,
        zoom: ic.zoom ?? 15,
        pitch: ic.pitch ?? 0,
        bearing: ic.bearing ?? 0,
      });
    }

    if (Array.isArray(this.tour.maxBounds) && this.tour.maxBounds.length === 2) {
      this.map.setMaxBounds(this.tour.maxBounds);
    }

    this._initStopsSource();
    this._initLayers();
    this._emit('tour-loaded', { tour: this.tour });
  }

  requestGeolocation() {
    if (!('geolocation' in navigator)) {
      this._emit('geolocation-unavailable', {});
      return;
    }
    const opts = {
      enableHighAccuracy: this.tour?.geofence?.enableHighAccuracy !== false,
      maximumAge: 5000,
      timeout: 20000,
    };
    this._watchId = navigator.geolocation.watchPosition(
      pos => this._onPosition(pos),
      err => this._onPositionError(err),
      opts
    );
  }

  stopGeolocation() {
    if (this._watchId != null) {
      navigator.geolocation.clearWatch(this._watchId);
      this._watchId = null;
    }
  }

  enableSimulateMode(startLngLat) {
    if (this._simulate) return;
    this._simulate = true;
    this.stopGeolocation();

    const el = document.createElement('div');
    el.className = 'tm-simulate-marker';
    el.innerHTML = '<span class="tm-simulate-dot"></span><span class="tm-simulate-label">SIM</span>';

    const start = startLngLat ?? this.tour?.initialCamera?.center ?? this.map.getCenter().toArray();
    this._simMarker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat(start)
      .addTo(this.map);

    this._simMarker.on('dragend', () => {
      const { lng, lat } = this._simMarker.getLngLat();
      this._setSimulatedPosition(lng, lat);
    });

    this._setSimulatedPosition(start[0], start[1]);
    this._emit('simulate-enabled', {});
  }

  triggerStopById(id, source = 'click') {
    const stop = this.stops.find(s => s.id === id);
    if (stop) this._triggerStop(stop, source);
  }

  recenter() {
    const pos = this._lastCheck;
    if (!pos) return;
    this.map.easeTo({ center: [pos.lng, pos.lat], duration: 600 });
  }

  isVisited(id) {
    return this.visited.has(id);
  }

  // ── Geolocation handlers ────────────────────────────────────────

  _onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    this._updateHereMarker(lng, lat, accuracy);

    const minMove = this.tour?.geofence?.minMoveMeters ?? 5;
    if (this._lastCheck) {
      const moved = haversineMeters(this._lastCheck.lng, this._lastCheck.lat, lng, lat);
      if (moved < minMove) return;
    }
    this._lastCheck = { lng, lat };
    this._checkGeofences(lng, lat, 'gps');
  }

  _onPositionError(err) {
    console.warn('TourEngine: geolocation error', err.message);
    this._emit('geolocation-denied', { error: err.message, code: err.code });
  }

  _setSimulatedPosition(lng, lat) {
    this._lastCheck = { lng, lat };
    this._updateHereMarker(lng, lat, null);
    this._checkGeofences(lng, lat, 'simulate');
  }

  _updateHereMarker(lng, lat, accuracy) {
    if (this._simulate) return; // SIM marker is the "here" marker in simulate mode
    if (!this._hereMarker) {
      const el = document.createElement('div');
      el.className = 'tm-here-marker';
      el.innerHTML = '<span class="tm-here-pulse"></span><span class="tm-here-dot"></span>';
      this._hereMarker = new maplibregl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this._hereMarker.setLngLat([lng, lat]);
    }
  }

  _checkGeofences(lng, lat, source) {
    const defaultRadius = this.tour?.geofence?.defaultRadiusMeters ?? 40;
    const triggerOnce = this.tour?.geofence?.triggerOnce !== false;

    for (const stop of this.stops) {
      if (!stop.geofence?.center) continue;
      const radius = stop.geofence.radiusMeters ?? defaultRadius;
      const [sLng, sLat] = stop.geofence.center;
      const d = haversineMeters(lng, lat, sLng, sLat);
      if (d <= radius) {
        if (triggerOnce && this.visited.has(stop.id)) continue;
        this._triggerStop(stop, source);
      }
    }
  }

  // ── Stop trigger ────────────────────────────────────────────────

  _triggerStop(stop, source) {
    // Clean up any previous popup/video
    if (this.popup) { this.popup.remove(); this.popup = null; }
    this._clearYTPoll();
    if (this.ytPlayer) { try { this.ytPlayer.stopVideo(); } catch (e) {} }

    const center = stop.geofence?.center ?? stop.popup?.lngLat;
    if (center) {
      this.map.easeTo({
        center,
        zoom: stop.camera?.zoom ?? this.map.getZoom(),
        pitch: stop.camera?.pitch ?? this.map.getPitch(),
        bearing: stop.camera?.bearing ?? this.map.getBearing(),
        duration: 800,
        padding: { top: 200, bottom: 0, left: 0, right: 0 },
      });
    }

    this._showPopup(stop);

    const wasVisited = this.visited.has(stop.id);
    this.visited.add(stop.id);
    this._setStopVisitedOnMap(stop.id);

    this._emit('stop-entered', {
      stop,
      source,
      firstVisit: !wasVisited,
      visitedCount: this.visited.size,
      totalStops: this.stops.length,
    });
  }

  _setStopVisitedOnMap(id) {
    // Drive the "visited" data-driven styling via feature-state
    if (!this.map.getSource('tour-stops')) return;
    this.map.setFeatureState(
      { source: 'tour-stops', id },
      { visited: true }
    );
  }

  // ── Popup (copied from StoryEngine for visual parity) ───────────

  async _showPopup(stop) {
    const p = stop.popup;
    if (!p) return;
    const lngLat = p.lngLat ?? stop.geofence?.center;
    if (!lngLat) return;

    const token = Date.now();
    const html = this._buildPopupHTML(p, token);

    this.popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      anchor: p.anchor ?? 'bottom',
      offset: p.offset ?? 12,
      maxWidth: '320px',
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(this.map);

    if (p.youtube) {
      try {
        await Promise.race([
          this._loadYouTubeAPI(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('YT API timeout')), 6000)),
        ]);
        const placeholderId = `yt-player-${token}`;
        await Promise.race([
          this._createYTPlayer(placeholderId, p.youtube.videoId, p.youtube.startAt, p.youtube.mute),
          new Promise((_, rej) => setTimeout(() => rej(new Error('YT Player timeout')), 8000)),
        ]);
        if (p.youtube.stopAt != null) this._pollYTForStopAt(p.youtube.stopAt, token);
      } catch (e) {
        console.warn('TourEngine: YouTube failed.', e.message);
      }
    }
  }

  _buildPopupHTML(p, token) {
    let html = '<div class="sm-popup">';

    if (p.title || p.subtitle) {
      html += '<div class="sm-popup-header">';
      if (p.title) html += `<h3 class="sm-popup-title">${p.title}</h3>`;
      if (p.subtitle) html += `<p class="sm-popup-subtitle">${p.subtitle}</p>`;
      html += '</div>';
    }

    if (p.image?.src) {
      html += '<figure class="sm-popup-figure">';
      html += `<img src="${p.image.src}" alt="${p.image.alt ?? ''}" class="sm-popup-img" loading="lazy" />`;
      if (p.image.caption) html += `<figcaption>${p.image.caption}</figcaption>`;
      html += '</figure>';
    }

    if (p.youtube) {
      html += `<div class="sm-popup-video-wrap"><div id="yt-player-${token}" class="sm-yt-placeholder"></div></div>`;
    }

    if (p.body) {
      html += `<div class="sm-popup-body">${p.body}</div>`;
    }

    if (p.stats?.length) {
      html += '<table class="sm-popup-stats">';
      p.stats.forEach(({ label, value }) => {
        html += `<tr><th>${label}</th><td>${value}</td></tr>`;
      });
      html += '</table>';
    }

    if (p.link?.href) {
      html += `<a class="sm-popup-link" href="${p.link.href}" target="_blank" rel="noopener noreferrer">${p.link.text ?? 'View →'}</a>`;
    }

    html += '</div>';
    return html;
  }

  // ── Layers ──────────────────────────────────────────────────────

  _initStopsSource() {
    // Build a FeatureCollection from tour.json stops so authors only edit one file.
    const features = this.stops
      .filter(s => s.geofence?.center)
      .map(s => ({
        type: 'Feature',
        id: s.id,
        properties: {
          id: s.id,
          title: s.popup?.title ?? s.id,
          subtitle: s.popup?.subtitle ?? '',
          radiusMeters: s.geofence.radiusMeters ?? this.tour?.geofence?.defaultRadiusMeters ?? 40,
        },
        geometry: { type: 'Point', coordinates: s.geofence.center },
      }));

    if (!this.map.getSource('tour-stops')) {
      this.map.addSource('tour-stops', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features },
        promoteId: 'id',
      });
    }
  }

  _initLayers() {
    const layers = this.tour.layers ?? [];
    layers.forEach(layerDef => {
      // Built-in virtual source: "tour-stops"
      const useBuiltIn = layerDef.source === 'tour-stops';

      if (!useBuiltIn && !this.map.getSource(layerDef.id)) {
        this.map.addSource(layerDef.id, { type: 'geojson', data: layerDef.source });
      }

      const spec = {
        id: layerDef.id,
        type: layerDef.type,
        source: useBuiltIn ? 'tour-stops' : layerDef.id,
        paint: layerDef.paint ?? {},
        layout: { visibility: 'visible', ...(layerDef.layout ?? {}) },
      };
      if (layerDef.sourceLayer) spec['source-layer'] = layerDef.sourceLayer;
      if (layerDef.filter) spec.filter = layerDef.filter;

      if (layerDef.insertBefore && this.map.getLayer(layerDef.insertBefore)) {
        this.map.addLayer(spec, layerDef.insertBefore);
      } else {
        this.map.addLayer(spec);
      }
    });
  }

  // ── YouTube (copied from StoryEngine) ───────────────────────────

  _loadYouTubeAPI() {
    if (this.ytReady) return Promise.resolve();
    if (this._ytAPIPromise) return this._ytAPIPromise;
    this._ytAPIPromise = new Promise(resolve => {
      window.onYouTubeIframeAPIReady = () => { this.ytReady = true; resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    });
    return this._ytAPIPromise;
  }

  _createYTPlayer(containerId, videoId, startAt, mute) {
    if (this.ytPlayer) {
      try { this.ytPlayer.destroy(); } catch (e) {}
      this.ytPlayer = null;
    }
    return new Promise((resolve, reject) => {
      const el = document.getElementById(containerId);
      if (!el) { reject(new Error('YT placeholder not found')); return; }
      this.ytPlayer = new YT.Player(containerId, {
        videoId,
        playerVars: {
          autoplay: 1, start: startAt ?? 0, mute: mute !== false ? 1 : 0,
          controls: 1, rel: 0, modestbranding: 1, playsinline: 1,
        },
        events: {
          onReady: event => { event.target.playVideo(); resolve(event.target); },
          onError: event => { reject(new Error(`YT player error: ${event.data}`)); },
        },
      });
    });
  }

  _pollYTForStopAt(stopAt, token) {
    this._clearYTPoll();
    this._ytPollInterval = setInterval(() => {
      if (!this.ytPlayer?.getCurrentTime) return;
      try {
        const t = this.ytPlayer.getCurrentTime();
        if (t >= stopAt) { this._clearYTPoll(); }
      } catch (e) { this._clearYTPoll(); }
    }, 250);
  }

  _clearYTPoll() {
    if (this._ytPollInterval) { clearInterval(this._ytPollInterval); this._ytPollInterval = null; }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _emit(name, detail) {
    window.dispatchEvent(new CustomEvent(`tour:${name}`, { detail }));
  }
}

// Great-circle distance in metres between two lng/lat pairs.
function haversineMeters(aLng, aLat, bLng, bLat) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat))
          * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
