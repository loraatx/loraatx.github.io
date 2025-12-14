(() => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const storedTheme = localStorage.getItem('theme');
  const initialTheme = storedTheme || (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = initialTheme;

  const themeToggle = document.querySelector('.theme-toggle');
  const toggleIcon = themeToggle?.querySelector('.toggle-icon');
  const toggleLabel = themeToggle?.querySelector('.toggle-label');

  const updateToggleUI = (theme) => {
    if (!toggleIcon || !toggleLabel) return;
    toggleIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    toggleLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  };

  updateToggleUI(initialTheme);

  themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.dataset.theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('theme', nextTheme);
    updateToggleUI(nextTheme);
  });

  const navSections = document.querySelectorAll('.nav-section');
  navSections.forEach((section) => {
    const toggle = section.querySelector('.nav-section-toggle');
    const links = section.querySelector('.nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', () => {
      const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isExpanded));
      links.hidden = isExpanded;
      toggle.classList.toggle('is-collapsed', isExpanded);
    });
  });

  const navLinks = document.querySelectorAll('.nav-link');
  const mapLabel = document.querySelector('[data-map-label]');
  const mapNote = document.querySelector('[data-map-note]');
  const detailTitle = document.querySelector('[data-detail-title]');
  const detailBody = document.querySelector('[data-detail-body]');
  const detailTag = document.querySelector('[data-detail-tag]');
  const mapViewport = document.querySelector('.map-viewport');
  const baseColor = mapViewport?.dataset.baseColor || '#0067c5';

  const activateLink = (target) => {
    navLinks.forEach((btn) => btn.classList.toggle('is-active', btn === target));
    const description = target.dataset.description || '';
    const tag = target.dataset.tag || '';
    const overlay = target.dataset.mapLabel || target.textContent;
    const overlayNote = target.dataset.overlayNote || 'Shared preview map across all items.';
    const accent = target.dataset.color || baseColor;

    if (detailTitle) detailTitle.textContent = target.textContent;
    if (detailBody) detailBody.textContent = description;
    if (detailTag) detailTag.textContent = tag;
    if (mapLabel) mapLabel.textContent = overlay;
    if (mapNote) mapNote.textContent = overlayNote;
    if (mapViewport) mapViewport.style.setProperty('--map-accent', accent);
  };

  navLinks.forEach((btn) => {
    btn.addEventListener('click', () => activateLink(btn));
  });

  const initial = document.querySelector('.nav-link.is-active') || navLinks[0];
  if (initial) activateLink(initial);
})();
