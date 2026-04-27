// StoryEngine — drives the /storymap/ cinematic story map experience.
// All content, camera moves, layers, and popup content come from story.json.
// No DOM knowledge here; UI is handled by ui.js which listens to CustomEvents.

class StoryEngine {
  constructor(map) {
    this.map = map;
    this.story = null;
    this.scenes = [];
    this.currentIndex = -1;
    this.state = 'IDLE'; // IDLE | TRANSITIONING | WAITING | SHOWING | ADVANCING
    this.paused = false;

    this.popup = null;
    this.ytPlayer = null;
    this.ytReady = false;
    this._ytAPIPromise = null;
    this._ytPollInterval = null;

    this._timer = null;
    this._timerStart = null;
    this._timerRemaining = null;
    this._abortToken = 0;
  }

  // ── Public API ──────────────────────────────────────────────────

  async load(url) {
    const res = await fetch(url);
    this.story = await res.json();
    this.scenes = this.story.scenes ?? [];

    if (this.scenes.length === 0) {
      console.warn('StoryEngine: story.json has no scenes.');
      return;
    }

    const ic = this.story.initialCamera;
    if (ic) {
      this.map.jumpTo({
        center: ic.center,
        zoom: ic.zoom ?? 10,
        pitch: ic.pitch ?? 0,
        bearing: ic.bearing ?? 0,
      });
    }

    this._initLayers();
    this._emit('story-loaded', { story: this.story });
  }

  play() {
    if (!this.paused && this.state !== 'IDLE') return;

    if (this.state === 'IDLE') {
      this.paused = false;
      const token = ++this._abortToken;
      this._runScene(0, token);
      this._emit('playstate-change', { playing: true });
      return;
    }

    if (!this.paused) return;
    this.paused = false;

    if (this.state === 'TRANSITIONING') {
      // map.stop() already fired moveend and resolved _doTransition early.
      // Re-run the camera transition for the current scene.
      const token = ++this._abortToken;
      this._doTransition(this.scenes[this.currentIndex], token).then(() => {
        if (token !== this._abortToken) return;
        if (this.paused) return;
        this._setState('SHOWING');
        const scene = this.scenes[this.currentIndex];
        if (scene.popup) this._showPopup(scene, token);
        else this._startAdvanceTimer(scene, token);
      });
    } else if (this.state === 'SHOWING') {
      // Resume YouTube if present
      if (this.ytPlayer?.playVideo) {
        try { this.ytPlayer.playVideo(); } catch (e) {}
      }
      // Resume or start the advance timer (_timerRemaining is always set by _startAdvanceTimer)
      this._resumeTimer();
    }

    this._emit('playstate-change', { playing: true });
  }

  pause() {
    if (this.paused) return;
    this.paused = true;

    this.map.stop(); // fires moveend immediately; _runScene checks paused after await

    if (this.ytPlayer?.pauseVideo) {
      try { this.ytPlayer.pauseVideo(); } catch (e) {}
    }

    this._pauseTimer();
    this._emit('playstate-change', { playing: false });
  }

  toggle() {
    if (this.paused || this.state === 'IDLE') this.play();
    else this.pause();
  }

  // keepPaused: true when the Next button is clicked while paused —
  // fly to the next scene and stop there; don't auto-advance further.
  goToScene(index, keepPaused = false) {
    if (index < 0 || index >= this.scenes.length) return;
    const token = ++this._abortToken;

    if (!keepPaused) this.paused = false;

    this._clearTimer();
    this._clearYTPoll();
    if (this.ytPlayer) { try { this.ytPlayer.stopVideo(); } catch (e) {} }
    if (this.popup) { this.popup.remove(); this.popup = null; }

    this._runScene(index, token);

    if (!keepPaused) this._emit('playstate-change', { playing: true });
    // When keepPaused, the play button icon stays as-is (already showing ▶).
  }

  next() { this.goToScene((this.currentIndex + 1) % this.scenes.length); }
  prev() { this.goToScene((this.currentIndex - 1 + this.scenes.length) % this.scenes.length); }

  // Called by Next button in the UI — respects current paused state.
  stepNext() {
    const nextIndex = (this.currentIndex + 1) % this.scenes.length;
    this.goToScene(nextIndex, this.paused);
  }

  // ── Core scene runner ───────────────────────────────────────────

  async _runScene(index, token) {
    this.currentIndex = index;
    const scene = this.scenes[index];
    this._setState('TRANSITIONING');
    this._emit('scene-change', { index, scene });

    // Clean up previous state
    if (this.popup) { this.popup.remove(); this.popup = null; }
    this._clearYTPoll();
    if (this.ytPlayer) { try { this.ytPlayer.stopVideo(); } catch (e) {} }

    // Start layer fades before camera moves for a coordinated feel
    if (scene.showLayers?.length) this._setLayerVisibility(scene.showLayers, true);
    if (scene.hideLayers?.length) this._setLayerVisibility(scene.hideLayers, false);

    await this._doTransition(scene, token);

    // Stale check — goToScene() was called while flying
    if (token !== this._abortToken) return;

    // Pause check — map.stop() resolved the transition early.
    // Stay in TRANSITIONING so play() re-runs the transition.
    if (this.paused) {
      this._setState('TRANSITIONING');
      return;
    }

    this._setState('SHOWING');

    if (scene.popup) {
      await this._showPopup(scene, token);
    } else {
      this._startAdvanceTimer(scene, token);
    }
  }

  // ── Camera transition ───────────────────────────────────────────

  _doTransition(scene, token) {
    return new Promise(resolve => {
      const cam = scene.camera ?? {};
      const t = scene.transition ?? 'fly';

      // Offset the viewport so the popup (which floats above its anchor)
      // appears visually centred — equivalent to pulling the anchor point
      // slightly below screen centre.
      const padding = { top: 200, bottom: 0, left: 0, right: 0 };

      const onMoveEnd = () => {
        this._setState('WAITING');
        resolve();
      };

      if (t === 'jump') {
        this.map.jumpTo({
          center: cam.center,
          zoom: cam.zoom,
          pitch: cam.pitch,
          bearing: cam.bearing,
        });
        this.map.once('moveend', onMoveEnd);
        return;
      }

      if (t === 'ease') {
        // For in-place reveals the author may omit camera.center.
        // Fall back to the popup's lngLat so the point stays on screen.
        const center = cam.center ?? scene.popup?.lngLat;
        const opts = {
          zoom: cam.zoom,
          pitch: cam.pitch,
          bearing: cam.bearing,
          duration: cam.duration ?? 1200,
          padding,
        };
        if (center) opts.center = center;
        this.map.easeTo(opts);
        this.map.once('moveend', onMoveEnd);
        return;
      }

      // Default: fly
      this.map.flyTo({
        center: cam.center,
        zoom: cam.zoom ?? 15,
        pitch: cam.pitch ?? 45,
        bearing: cam.bearing ?? 0,
        speed: cam.speed ?? 0.8,
        curve: cam.curve ?? 1.4,
        padding,
      });
      this.map.once('moveend', onMoveEnd);
    });
  }

  // ── Popup ───────────────────────────────────────────────────────

  async _showPopup(scene, token) {
    const p = scene.popup;
    const lngLat = p.lngLat ?? scene.camera?.center;
    if (!lngLat) { this._startAdvanceTimer(scene, token); return; }

    const html = this._buildPopupHTML(p, token);

    this.popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: false,
      anchor: p.anchor ?? 'bottom',
      offset: p.offset ?? 12,
      maxWidth: '352px',
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(this.map);

    // User closes popup manually → advance
    this.popup.on('close', () => {
      if (this.state === 'SHOWING' && token === this._abortToken) {
        this._advance(token);
      }
    });

    if (p.youtube) {
      try {
        // Guard against a blocked or slow YT API script
        await Promise.race([
          this._loadYouTubeAPI(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('YT API timeout')), 6000)),
        ]);
        if (token !== this._abortToken) return;

        const placeholderId = `yt-player-${token}`;
        await Promise.race([
          this._createYTPlayer(placeholderId, p.youtube.videoId, p.youtube.startAt, p.youtube.mute),
          new Promise((_, rej) => setTimeout(() => rej(new Error('YT Player timeout')), 8000)),
        ]);
        if (token !== this._abortToken) return;

        // In step/paused mode pause the video immediately after it loads
        if (this.paused && this.ytPlayer?.pauseVideo) {
          try { this.ytPlayer.pauseVideo(); } catch (e) {}
        }

        if (p.youtube.stopAt != null) {
          this._pollYTForStopAt(p.youtube.stopAt, token);
        } else {
          this._startAdvanceTimer(scene, token);
        }
      } catch (e) {
        console.warn('StoryEngine: YouTube failed, using duration fallback.', e.message);
        this._startAdvanceTimer(scene, token);
      }
    } else {
      this._startAdvanceTimer(scene, token);
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

  // ── Layer choreography ──────────────────────────────────────────

  _initLayers() {
    if (!this.story.layers?.length) return;

    this.story.layers.forEach(layerDef => {
      if (!this.map.getSource(layerDef.id)) {
        this.map.addSource(layerDef.id, { type: 'geojson', data: layerDef.source });
      }

      const paint = { ...layerDef.paint };
      const opacityProp = this._opacityProp(layerDef.type);
      if (opacityProp) paint[opacityProp] = 0;

      const spec = {
        id: layerDef.id,
        type: layerDef.type,
        source: layerDef.id,
        paint,
        layout: { visibility: 'visible', ...(layerDef.layout ?? {}) },
      };
      if (layerDef.sourceLayer) spec['source-layer'] = layerDef.sourceLayer;

      if (layerDef.insertBefore && this.map.getLayer(layerDef.insertBefore)) {
        this.map.addLayer(spec, layerDef.insertBefore);
      } else {
        this.map.addLayer(spec);
      }
    });
  }

  _setLayerVisibility(ids, visible) {
    ids.forEach(id => {
      const layerDef = this.story.layers?.find(l => l.id === id);
      if (!layerDef || !this.map.getLayer(id)) return;

      const opacityProp = this._opacityProp(layerDef.type);
      if (!opacityProp) return;

      const targetOpacity = visible ? (layerDef.transitionOpacity ?? 0.6) : 0;
      const duration = layerDef.transitionDuration ?? 500;

      // Both calls must be synchronous for MapLibre to tween the value
      this.map.setPaintProperty(id, `${opacityProp}-transition`, { duration, delay: 0 });
      this.map.setPaintProperty(id, opacityProp, targetOpacity);
    });
  }

  _opacityProp(type) {
    return {
      fill: 'fill-opacity',
      line: 'line-opacity',
      circle: 'circle-opacity',
      'fill-extrusion': 'fill-extrusion-opacity',
      symbol: 'icon-opacity',
      raster: 'raster-opacity',
      heatmap: 'heatmap-opacity',
    }[type] ?? null;
  }

  // ── Advance timer ───────────────────────────────────────────────

  _startAdvanceTimer(scene, token) {
    const ms = scene.duration ?? 5000;
    this._clearTimer();
    this._timerStart = Date.now();
    this._timerRemaining = ms;
    this._timer = setTimeout(() => {
      this._timerRemaining = null;
      this._advance(token);
    }, ms);

    // Step/pause mode: store the duration but freeze the timer immediately
    if (this.paused) this._pauseTimer();
  }

  _pauseTimer() {
    if (!this._timer) return;
    clearTimeout(this._timer);
    this._timer = null;
    if (this._timerStart != null && this._timerRemaining != null) {
      this._timerRemaining = this._timerRemaining - (Date.now() - this._timerStart);
    }
  }

  _resumeTimer() {
    if (this._timerRemaining == null) return;
    const remaining = Math.max(0, this._timerRemaining);
    this._timerStart = Date.now();
    this._timer = setTimeout(() => {
      this._timerRemaining = null;
      this._advance(this._abortToken);
    }, remaining);
  }

  _clearTimer() {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
    this._timerStart = null;
    this._timerRemaining = null;
  }

  _advance(token) {
    if (token !== this._abortToken) return;
    this._setState('ADVANCING');
    const loop = this.story.loop !== false;
    const next = this.currentIndex + 1;
    if (next >= this.scenes.length) {
      if (loop) this.goToScene(0);
      else { this._setState('IDLE'); this._emit('story-ended', {}); }
    } else {
      this.goToScene(next);
    }
  }

  // ── YouTube ─────────────────────────────────────────────────────

  _loadYouTubeAPI() {
    if (this.ytReady) return Promise.resolve();
    if (this._ytAPIPromise) return this._ytAPIPromise; // reuse if mid-load

    this._ytAPIPromise = new Promise(resolve => {
      window.onYouTubeIframeAPIReady = () => {
        this.ytReady = true;
        resolve();
      };
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
          autoplay: 1,
          start: startAt ?? 0,
          mute: mute !== false ? 1 : 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: event => {
            event.target.playVideo();
            resolve(event.target);
          },
          onError: event => {
            reject(new Error(`YT player error: ${event.data}`));
          },
        },
      });
    });
  }

  _pollYTForStopAt(stopAt, token) {
    this._clearYTPoll();
    this._ytPollInterval = setInterval(() => {
      if (token !== this._abortToken) { this._clearYTPoll(); return; }
      if (this.paused) return; // freeze while paused; poll resumes when play() called
      if (!this.ytPlayer?.getCurrentTime) return;
      try {
        const t = this.ytPlayer.getCurrentTime();
        if (t >= stopAt) {
          this._clearYTPoll();
          this._advance(token);
        }
      } catch (e) {
        this._clearYTPoll();
        this._advance(token); // if player errors, advance anyway
      }
    }, 250);
  }

  _clearYTPoll() {
    if (this._ytPollInterval) { clearInterval(this._ytPollInterval); this._ytPollInterval = null; }
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _setState(s) { this.state = s; }

  _emit(name, detail) {
    window.dispatchEvent(new CustomEvent(`sm:${name}`, { detail }));
  }
}
