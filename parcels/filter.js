// filter.js — controller for the parcel search/filter panel.
//
// Owns the filter panel UI only. It collects the user's criteria and emits a
// `parcelfilterchange` event; app.js translates that into a search_parcels
// query and de-emphasises non-matching parcels on the map. app.js reports
// back via `parcelfilterresult`, which updates the result badge.
//
// No-ops gracefully when #filter-panel is absent (e.g. /parcels/embed.html).

(function () {
  const panel = document.getElementById('filter-panel');
  if (!panel) return;

  const elCategories = panel.querySelectorAll('#filter-categories input[type="checkbox"]');
  const elFarMin    = panel.querySelector('#far-min');
  const elFarMax    = panel.querySelector('#far-max');
  const elHeightMin = panel.querySelector('#height-min');
  const elHeightMax = panel.querySelector('#height-max');
  const elPermit    = panel.querySelector('#permit-since');
  const elClear     = panel.querySelector('#filter-clear');
  const elToggle    = panel.querySelector('#filter-toggle');
  const elResult    = panel.querySelector('#filter-result');

  function num(input) {
    const v = parseFloat(input.value);
    return Number.isFinite(v) ? v : null;
  }

  // Translate the "permit in last N years" select into an ISO cutoff date.
  function permitAfterDate() {
    const years = parseInt(elPermit.value, 10);
    if (!Number.isFinite(years) || years <= 0) return null;
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    return d.toISOString().slice(0, 10);
  }

  function collect() {
    return {
      categories: Array.from(elCategories)
        .filter(c => c.checked).map(c => c.value),
      farMin:      num(elFarMin),
      farMax:      num(elFarMax),
      heightMin:   num(elHeightMin),
      heightMax:   num(elHeightMax),
      permitAfter: permitAfterDate()
    };
  }

  function emit() {
    const s = collect();
    const active =
      s.categories.length > 0 ||
      s.farMin != null || s.farMax != null ||
      s.heightMin != null || s.heightMax != null ||
      s.permitAfter != null;
    document.dispatchEvent(new CustomEvent('parcelfilterchange', {
      detail: Object.assign({ active }, s)
    }));
  }

  let debounceTimer = null;
  function emitDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(emit, 400);
  }

  elCategories.forEach(c => c.addEventListener('change', emitDebounced));
  [elFarMin, elFarMax, elHeightMin, elHeightMax]
    .forEach(i => i.addEventListener('input', emitDebounced));
  elPermit.addEventListener('change', emitDebounced);

  elClear.addEventListener('click', () => {
    clearTimeout(debounceTimer);
    elCategories.forEach(c => { c.checked = false; });
    elFarMin.value = elFarMax.value = '';
    elHeightMin.value = elHeightMax.value = '';
    elPermit.value = '';
    emit();
  });

  elToggle.addEventListener('click', () => {
    const collapsed = panel.classList.toggle('is-collapsed');
    elToggle.setAttribute('aria-expanded', String(!collapsed));
    elToggle.setAttribute('aria-label', collapsed ? 'Show filters' : 'Hide filters');
  });

  // Result badge — driven by app.js after each search.
  document.addEventListener('parcelfilterresult', (e) => {
    const d = e.detail || {};
    if (d.loading) {
      elResult.dataset.state = 'loading';
      elResult.textContent = 'Searching…';
      return;
    }
    if (d.error) {
      elResult.dataset.state = 'error';
      elResult.textContent = d.error;
      return;
    }
    if (d.count == null) {
      elResult.dataset.state = 'idle';
      elResult.textContent = 'Adjust filters to find parcels';
      return;
    }
    elResult.dataset.state = 'done';
    if (d.count === 0) {
      elResult.textContent = 'No parcels match in this view';
    } else if (d.count === 1) {
      elResult.textContent = '1 parcel matches in this view';
    } else {
      elResult.textContent =
        d.count.toLocaleString('en-US') + ' parcels match in this view';
    }
  });
}());
