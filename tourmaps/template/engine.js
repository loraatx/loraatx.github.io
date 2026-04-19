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
    this._seedVisitedFromStorage();
    this._emit('tour-loaded', { tour: this.tour });
  }

  _seedVisitedFromStorage() {
    if (!window.TourStorage) return;
    for (const stop of this.stops) {
      if (TourStorage.getVisited(stop.id)) {
        this.visited.add(stop.id);
        this._setStopVisitedOnMap(stop.id);
      }
    }
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

  // Public — used by popup check-in toggle and external UI.
  toggleVisited(id, visited) {
    const on = visited !== undefined ? !!visited : !this.visited.has(id);
    if (on) this.visited.add(id);
    else this.visited.delete(id);
    if (window.TourStorage) TourStorage.setVisited(id, on);
    // Feature-state only supports setting true; setting {visited: false} works too but
    // we also need to re-render; setFeatureState merges so this is fine.
    if (this.map.getSource('tour-stops')) {
      this.map.setFeatureState({ source: 'tour-stops', id }, { visited: on });
    }
    this._emit('stop-visited-change', {
      id,
      visited: on,
      visitedCount: this.visited.size,
      totalStops: this.stops.length,
    });
  }

  // ── Geolocation handlers ────────────────────────────────────────

  _onPosition(pos) {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    this._updateHereMarker(lng, lat, accuracy);
    this._emit('position-update', { lng, lat, accuracy, source: 'gps' });

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
    this._emit('position-update', { lng, lat, accuracy: null, source: 'simulate' });
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
    const content = this._buildPopupDOM(stop, p, token);

    this.popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      anchor: p.anchor ?? 'bottom',
      offset: p.offset ?? 12,
      maxWidth: '320px',
    })
      .setLngLat(lngLat)
      .setDOMContent(content)
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

  // Wraps the static HTML + appends the interactive footer as a DOM node
  // so event listeners (check-in / note / photo) survive MapLibre's rendering.
  _buildPopupDOM(stop, p, token) {
    const root = document.createElement('div');
    root.className = 'sm-popup-root';
    const staticPart = document.createElement('div');
    staticPart.innerHTML = this._buildPopupHTML(p, token);
    // _buildPopupHTML already returns <div class="sm-popup">...</div>
    root.appendChild(staticPart.firstChild);
    root.appendChild(this._buildActionsFooter(stop));
    return root;
  }

  _buildActionsFooter(stop) {
    const footer = document.createElement('div');
    footer.className = 'tm-popup-actions';
    const hasStorage = !!window.TourStorage;

    // ── Check-in toggle ───────────────────────────────────────────
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'tm-checkin-btn';
    const syncCheckBtn = () => {
      const on = this.visited.has(stop.id);
      checkBtn.classList.toggle('is-on', on);
      checkBtn.textContent = on ? '✓ Visited' : 'Mark as visited';
      checkBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    syncCheckBtn();
    checkBtn.addEventListener('click', () => {
      this.toggleVisited(stop.id);
      syncCheckBtn();
    });
    footer.appendChild(checkBtn);

    if (!hasStorage) return footer; // notes/photos require storage

    // ── Text note ─────────────────────────────────────────────────
    const noteWrap = document.createElement('label');
    noteWrap.className = 'tm-note-field';
    const noteLabel = document.createElement('span');
    noteLabel.className = 'tm-note-label';
    noteLabel.textContent = 'Note';
    const savedIndicator = document.createElement('span');
    savedIndicator.className = 'tm-note-saved';
    savedIndicator.textContent = 'Saved';
    savedIndicator.hidden = true;
    const noteArea = document.createElement('textarea');
    noteArea.rows = 2;
    noteArea.placeholder = 'Jot a thought…';
    noteArea.value = TourStorage.getNote(stop.id);
    let noteTimer = null;
    noteArea.addEventListener('input', () => {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => {
        TourStorage.setNote(stop.id, noteArea.value);
        savedIndicator.hidden = false;
        setTimeout(() => { savedIndicator.hidden = true; }, 1200);
      }, 500);
    });
    noteWrap.appendChild(noteLabel);
    noteWrap.appendChild(savedIndicator);
    noteWrap.appendChild(noteArea);
    footer.appendChild(noteWrap);

    // ── Photo capture ─────────────────────────────────────────────
    const photoRow = document.createElement('div');
    photoRow.className = 'tm-photo-row';
    const photoBtn = document.createElement('button');
    photoBtn.type = 'button';
    photoBtn.className = 'tm-photo-btn';
    photoBtn.textContent = '+ Photo';
    const photoInput = document.createElement('input');
    photoInput.type = 'file';
    photoInput.accept = 'image/*';
    photoInput.setAttribute('capture', 'environment');
    photoInput.hidden = true;
    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'tm-photo-thumb-wrap';

    const renderThumb = (blob) => {
      thumbWrap.innerHTML = '';
      if (!blob) { photoBtn.hidden = false; return; }
      photoBtn.hidden = true;
      const url = URL.createObjectURL(blob);
      const img = document.createElement('img');
      img.className = 'tm-photo-thumb';
      img.src = url;
      img.alt = 'Your photo of this stop';
      img.addEventListener('click', () => tmOpenLightbox(url));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'tm-photo-remove';
      remove.setAttribute('aria-label', 'Remove photo');
      remove.textContent = '×';
      remove.addEventListener('click', async () => {
        await TourStorage.deletePhoto(stop.id);
        URL.revokeObjectURL(url);
        renderThumb(null);
      });
      thumbWrap.appendChild(img);
      thumbWrap.appendChild(remove);
    };

    TourStorage.getPhoto(stop.id).then(renderThumb);

    photoBtn.addEventListener('click', () => photoInput.click());
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      await TourStorage.setPhoto(stop.id, file);
      renderThumb(file);
    });
    photoRow.appendChild(photoBtn);
    photoRow.appendChild(photoInput);
    photoRow.appendChild(thumbWrap);
    footer.appendChild(photoRow);

    return footer;
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

// Full-screen lightbox for a stop's saved photo. One overlay is reused across
// clicks so we don't stack DOMs. The passed URL is a live object URL created
// by the caller; we do not revoke it here (the thumbnail owns its lifetime).
function tmOpenLightbox(url) {
  let box = document.getElementById('tm-photo-lightbox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'tm-photo-lightbox';
    box.className = 'tm-photo-lightbox';
    box.hidden = true;
    const img = document.createElement('img');
    img.alt = 'Full-size photo';
    box.appendChild(img);
    box.addEventListener('click', () => { box.hidden = true; });
    document.body.appendChild(box);
  }
  box.querySelector('img').src = url;
  box.hidden = false;
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
