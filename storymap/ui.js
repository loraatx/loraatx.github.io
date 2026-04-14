// ui.js — wires DOM elements to the StoryEngine via CustomEvents.
// No playback logic here; all state lives in engine.js.

function initUI(engine) {
  const playBtn     = document.getElementById('sm-play-btn');
  const iconPause   = playBtn.querySelector('.sm-icon-pause');
  const iconPlay    = playBtn.querySelector('.sm-icon-play');
  const dotsNav     = document.getElementById('sm-dots');
  const titleOverlay = document.getElementById('sm-title-overlay');
  const titleEl     = document.getElementById('sm-story-title');
  const subtitleEl  = document.getElementById('sm-story-subtitle');

  // ── Populate title overlay ──────────────────────────────────────
  const s = engine.story;
  if (s?.title) {
    titleEl.textContent = s.title;
    subtitleEl.textContent = s.subtitle ?? '';
    subtitleEl.hidden = !s.subtitle;
    titleOverlay.hidden = false;
  }

  // ── Build scene dot buttons ─────────────────────────────────────
  engine.scenes.forEach((scene, i) => {
    const dot = document.createElement('button');
    dot.className = 'sm-dot';
    dot.setAttribute('aria-label',
      `Scene ${i + 1}${scene.popup?.title ? ': ' + scene.popup.title : ''}`);
    dot.addEventListener('click', () => engine.goToScene(i));
    dotsNav.appendChild(dot);
  });

  function updateDots(activeIndex) {
    dotsNav.querySelectorAll('.sm-dot').forEach((dot, i) => {
      dot.classList.toggle('is-active', i === activeIndex);
    });
  }

  // ── Play/Pause button ───────────────────────────────────────────
  playBtn.addEventListener('click', () => engine.toggle());

  function updatePlayBtn(playing) {
    iconPause.style.display = playing ? '' : 'none';
    iconPlay.style.display  = playing ? 'none' : '';
    playBtn.setAttribute('aria-label', playing ? 'Pause story' : 'Play story');
    playBtn.title = playing ? 'Pause' : 'Play';
  }

  // ── Listen to engine events ─────────────────────────────────────
  window.addEventListener('sm:scene-change',    e => updateDots(e.detail.index));
  window.addEventListener('sm:playstate-change', e => updatePlayBtn(e.detail.playing));

  // Set initial state (autoplay = playing)
  updatePlayBtn(engine.story?.autoplay !== false);
  updateDots(0);
}
