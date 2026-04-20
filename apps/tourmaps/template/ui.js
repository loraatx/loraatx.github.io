// ui.js — wires DOM elements to the TourEngine via CustomEvents.
// No tour logic here; all state lives in engine.js.

function initTourUI(engine) {
  const brandTitle  = document.getElementById('tm-tour-name');
  const permModal   = document.getElementById('tm-permission');
  const allowBtn    = document.getElementById('tm-allow-gps');
  const previewBtn  = document.getElementById('tm-preview');
  const progressEl  = document.getElementById('tm-progress');
  const stopsBtn    = document.getElementById('tm-stops-btn');
  const stopsPanel  = document.getElementById('tm-stops-panel');
  const stopsList   = document.getElementById('tm-stops-list');
  const stopsClose  = document.getElementById('tm-stops-close');
  const recenterBtn = document.getElementById('tm-recenter');
  const banner      = document.getElementById('tm-banner');
  const compassEl   = document.getElementById('tm-compass');
  const compassArrow = compassEl?.querySelector('.tm-compass-arrow');
  const compassLabel = compassEl?.querySelector('.tm-compass-label');
  const compassDist  = compassEl?.querySelector('.tm-compass-dist');

  // ── Populate brand card title ───────────────────────────────────
  const t = engine.tour;
  if (t?.title && brandTitle) brandTitle.textContent = t.title;

  // ── Build stops list ────────────────────────────────────────────
  function renderStopsList() {
    stopsList.innerHTML = '';
    engine.stops.forEach((stop, i) => {
      const li = document.createElement('li');
      li.className = 'tm-stop-item' + (engine.isVisited(stop.id) ? ' is-visited' : '');
      li.dataset.id = stop.id;
      li.innerHTML = `
        <span class="tm-stop-index">${i + 1}</span>
        <span class="tm-stop-body">
          <span class="tm-stop-title">${escapeHTML(stop.popup?.title ?? stop.id)}</span>
          ${stop.popup?.subtitle ? `<span class="tm-stop-subtitle">${escapeHTML(stop.popup.subtitle)}</span>` : ''}
        </span>
        <span class="tm-stop-check" aria-hidden="true">✓</span>
      `;
      li.addEventListener('click', () => {
        engine.triggerStopById(stop.id, 'click');
        closeStopsPanel();
      });
      stopsList.appendChild(li);
    });
  }
  renderStopsList();

  function updateProgress() {
    const visited = engine.visited.size;
    const total = engine.stops.length;
    progressEl.textContent = `${visited} / ${total}`;
    progressEl.setAttribute('aria-label', `${visited} of ${total} stops visited`);
  }
  updateProgress();

  function syncStopItem(id) {
    const li = stopsList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (!li) return;
    li.classList.toggle('is-visited', engine.isVisited(id));
  }

  // ── Stops panel open/close ──────────────────────────────────────
  function openStopsPanel()  { stopsPanel.classList.add('is-open'); }
  function closeStopsPanel() { stopsPanel.classList.remove('is-open'); }

  stopsBtn.addEventListener('click', openStopsPanel);
  stopsClose.addEventListener('click', closeStopsPanel);

  // ── Permission modal ────────────────────────────────────────────
  const urlSimulate = new URLSearchParams(window.location.search).get('simulate') === '1';
  if (urlSimulate) {
    permModal.hidden = true;
    engine.enableSimulateMode();
    showBanner('Simulate mode — drag the SIM marker onto a stop to trigger its popup.');
  }

  allowBtn?.addEventListener('click', () => {
    permModal.hidden = true;
    engine.requestGeolocation();
  });

  previewBtn?.addEventListener('click', () => {
    permModal.hidden = true;
    engine.enableSimulateMode();
    showBanner('Preview mode — drag the SIM marker or pick a stop from the list.');
  });

  // ── Recenter button ─────────────────────────────────────────────
  recenterBtn.addEventListener('click', () => engine.recenter());

  // ── Banner helper ───────────────────────────────────────────────
  function showBanner(msg, ms = 6000) {
    if (!banner) return;
    banner.textContent = msg;
    banner.hidden = false;
    clearTimeout(showBanner._t);
    if (ms > 0) showBanner._t = setTimeout(() => { banner.hidden = true; }, ms);
  }

  // ── Compass pill ────────────────────────────────────────────────
  let lastPos = null;

  function formatDistance(m) {
    if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1)} km`;
    return `${Math.round(m)} m`;
  }

  function nearestUnvisited(lng, lat) {
    let best = null;
    for (const stop of engine.stops) {
      if (engine.isVisited(stop.id)) continue;
      const c = stop.geofence?.center ?? stop.popup?.lngLat;
      if (!c) continue;
      const d = haversineMeters(lng, lat, c[0], c[1]);
      if (!best || d < best.d) best = { stop, d, lng: c[0], lat: c[1] };
    }
    return best;
  }

  function updateCompass() {
    if (!compassEl) return;
    if (!lastPos) { compassEl.hidden = true; return; }
    const near = nearestUnvisited(lastPos.lng, lastPos.lat);
    if (!near) { compassEl.hidden = true; return; }
    const bearing = bearingDegrees(lastPos.lng, lastPos.lat, near.lng, near.lat);
    compassArrow.style.transform = `rotate(${bearing}deg)`;
    compassLabel.textContent = near.stop.popup?.title ?? near.stop.id;
    compassDist.textContent = formatDistance(near.d);
    compassEl.dataset.stopId = near.stop.id;
    compassEl.hidden = false;
  }

  compassEl?.addEventListener('click', () => {
    const id = compassEl.dataset.stopId;
    if (id) engine.triggerStopById(id, 'compass');
  });

  // ── Listen to engine events ─────────────────────────────────────
  window.addEventListener('tour:stop-entered', e => {
    syncStopItem(e.detail.stop.id);
    updateProgress();
    updateCompass();
  });

  window.addEventListener('tour:stop-visited-change', e => {
    syncStopItem(e.detail.id);
    updateProgress();
    updateCompass();
  });

  window.addEventListener('tour:position-update', e => {
    lastPos = { lng: e.detail.lng, lat: e.detail.lat };
    updateCompass();
  });

  window.addEventListener('tour:geolocation-denied', () => {
    showBanner('Location permission denied — switching to preview mode.', 8000);
    engine.enableSimulateMode();
  });

  window.addEventListener('tour:geolocation-unavailable', () => {
    showBanner('This browser does not support geolocation — using preview mode.', 8000);
    engine.enableSimulateMode();
  });
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Initial bearing (0° = north, clockwise) from A to B.
function bearingDegrees(aLng, aLat, bLng, bLat) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(aLat), φ2 = toRad(bLat);
  const Δλ = toRad(bLng - aLng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
