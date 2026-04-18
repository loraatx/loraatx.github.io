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

  function markStopVisitedInList(id) {
    const li = stopsList.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (li) li.classList.add('is-visited');
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

  // ── Listen to engine events ─────────────────────────────────────
  window.addEventListener('tour:stop-entered', e => {
    markStopVisitedInList(e.detail.stop.id);
    updateProgress();
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
