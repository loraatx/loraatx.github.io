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

    // Set initial camera if provided
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
      // First play
      this.paused = false;
      const token = ++this._abortToken;
      this._runScene(0, token);
      this._emit('playstate-change', { playing: true });
      return;
    }

    if (!this.paused) return;
    this.paused = false;

    if (this.state === 'TRANSITIONING') {
      // Re-run the transition for the current scene (map.stop() discarded the old flyTo)
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
      if (this.ytPlayer?.playVideo) this.ytPlayer.playVideo();
      this._resumeTimer();
    }

    this._emit('playstate-change', { playing: true });
  }

  pause() {
    if (this.paused) return;
    this.paused = true;

    // Abort in-progress map animation
    this.map.stop();

    // Pause YouTube
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

  goToScene(index) {
    if (index < 0 || index >= this.scenes.length) return;
    const token = ++this._abortToken;
    this.paused = false;
    this._clearTimer();
    this._clearYTPoll();
    if (this.ytPlayer) { try { this.ytPlayer.stopVideo(); } catch (e) {} }
    if (this.popup) { this.popup.remove(); this.popup = null; }
    this._runScene(index, token);
    this._emit('playstate-change', { playing: true });
  }

  next() {
    const next = (this.currentIndex + 1) % this.scenes.length;
    this.goToScene(next);
  }

  prev() {
    const prev = (this.currentIndex - 1 + this.scenes.length) % this.scenes.length;
    this.goToScene(prev);
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

    // Camera transition
    await this._doTransition(scene, token);

    // Stale check — goToScene() was called while we were flying
    if (token !== this._abortToken) return;

    // Pause check — map.stop() resolved the transition early
    if (this.paused) {
      this._setState('TRANSITIONING'); // stay here so play() re-runs the transition
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

      const onMoveEnd = () => {
        // Always resolve — stale check happens in _runScene after await
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
        const opts = {
          zoom: cam.zoom,
          pitch: cam.pitch,
          bearing: cam.bearing,
          duration: cam.duration ?? 1200,
        };
        if (cam.center) opts.center = cam.center;
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
      maxWidth: '320px',
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

    // YouTube scene: inject player after popup is in DOM
    if (p.youtube) {
      await this._loadYouTubeAPI();
      if (token !== this._abortToken) return;

      const placeholderId = `yt-player-${token}`;
      await this._createYTPlayer(placeholderId, p.youtube.videoId, p.youtube.startAt, p.youtube.mute);
      if (token !== this._abortToken) return;

      if (p.youtube.stopAt != null) {
        this._pollYTForStopAt(p.youtube.stopAt, token);
      } else {
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
      // Placeholder div — YT player injected after popup is in DOM
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
      const target = p.link.external ? ' target="_blank" rel="noopener"' : '';
      html += `<a class="sm-popup-link" href="${p.link.href}"${target}>${p.link.text ?? 'View →'}</a>`;
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

      // Force opacity to 0 so all layers start hidden
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

      // Both calls must be synchronous for MapLibre to tween
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
    if (this._ytAPIPromise) return this._ytAPIPromise;

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

    return new Promise(resolve => {
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
        },
      });
    });
  }

  _pollYTForStopAt(stopAt, token) {
    this._clearYTPoll();
    this._ytPollInterval = setInterval(() => {
      if (token !== this._abortToken) { this._clearYTPoll(); return; }
      if (this.paused) return;
      if (!this.ytPlayer?.getCurrentTime) return;
      const t = this.ytPlayer.getCurrentTime();
      if (t >= stopAt) {
        this._clearYTPoll();
        this._advance(token);
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
