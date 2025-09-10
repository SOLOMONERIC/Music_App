// Retro Player - No frameworks
(function () {
  "use strict";

  /**
   * Utilities
   */
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const formatTime = (sec) => {
    if (!isFinite(sec)) return "0:00";
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, "0");
    const m = Math.floor(sec / 60);
    return `${m}:${s}`;
  };

  const storage = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {}
    },
    del(key) {
      try { localStorage.removeItem(key); } catch {}
    }
  };

  /**
   * Elements
   */
  const els = {
    themeToggle: qs("#themeToggle"),
    searchInput: qs("#searchInput"),
    searchBtn: qs("#searchBtn"),
    clearSearchBtn: qs("#clearSearchBtn"),
    results: qs("#results"),
    resultItemTemplate: qs("#resultItemTemplate"),
    queueItemTemplate: qs("#queueItemTemplate"),
    library: qs("#library"),
    filePicker: qs("#filePicker"),
    addLocalBtn: qs("#addLocalBtn"),
    clearLibraryBtn: qs("#clearLibraryBtn"),
    queue: qs("#queue"),
    shuffleBtn: qs("#shuffleBtn"),
    repeatBtn: qs("#repeatBtn"),
    clearQueueBtn: qs("#clearQueueBtn"),
    cover: qs("#cover"),
    title: qs("#title"),
    artist: qs("#artist"),
    prevBtn: qs("#prevBtn"),
    playBtn: qs("#playBtn"),
    nextBtn: qs("#nextBtn"),
    seek: qs("#seek"),
    currentTime: qs("#currentTime"),
    duration: qs("#duration"),
    muteBtn: qs("#muteBtn"),
    volume: qs("#volume"),
    audio: qs("#audio"),
    lyricsBtn: qs("#lyricsBtn"),
    lyricsPanel: qs("#lyricsPanel"),
    lyricsContent: qs("#lyricsContent"),
    closeLyricsBtn: qs("#closeLyricsBtn"),
    refreshLyricsBtn: qs("#refreshLyricsBtn"),
    waveform: qs("#waveform"),
  };

  /**
   * State
   */
  const state = {
    queue: storage.get("rp_queue", []),
    queueIndex: clamp(storage.get("rp_queueIndex", 0), 0, Number.MAX_SAFE_INTEGER),
    repeat: storage.get("rp_repeat", false),
    shuffle: storage.get("rp_shuffle", false),
    library: storage.get("rp_library", []), // local files metadata
    theme: storage.get("rp_theme", "dark"),
    volume: storage.get("rp_volume", 1),
  };

  // Theme init
  function applyTheme(t) {
    document.documentElement.classList.toggle("light", t === "light");
    storage.set("rp_theme", t);
    els.themeToggle.setAttribute('aria-checked', String(t === 'light'));
  }
  applyTheme(state.theme);

  // Volume init
  els.volume.value = String(state.volume);
  els.audio.volume = clamp(state.volume, 0, 1);

  /**
   * Rendering helpers
   */
  function createResultItem(track) {
    const li = els.resultItemTemplate.content.firstElementChild.cloneNode(true);
    const img = qs(".avatar", li);
    const primary = qs(".primary", li);
    const secondary = qs(".secondary", li);
    img.src = track.album?.cover_medium || track.album?.cover || "";
    img.alt = track.title || "cover";
    primary.textContent = track.title;
    secondary.textContent = `${track.artist?.name || "Unknown"} • ${track.album?.title || ""}`;
    li.dataset.payload = JSON.stringify({
      type: "deezer",
      id: track.id,
      title: track.title,
      artist: track.artist?.name,
      cover: track.album?.cover_medium,
      preview: track.preview, // 30s preview
      link: track.link,
    });
    return li;
  }

  function createQueueItem(item) {
    const li = els.queueItemTemplate.content.firstElementChild.cloneNode(true);
    const img = qs(".avatar", li);
    const primary = qs(".primary", li);
    const secondary = qs(".secondary", li);
    img.src = item.cover || "";
    img.alt = item.title || "cover";
    primary.textContent = item.title || item.name || "Untitled";
    secondary.textContent = item.artist || (item.type === "local" ? "Local file" : "");
    li.dataset.index = String(item.index ?? -1);
    return li;
  }

  function renderQueue() {
    els.queue.innerHTML = "";
    state.queue.forEach((item, idx) => {
      const node = createQueueItem({ ...item, index: idx });
      els.queue.appendChild(node);
    });
    storage.set("rp_queue", state.queue);
    storage.set("rp_queueIndex", state.queueIndex);
  }

  function renderLibrary() {
    els.library.innerHTML = "";
    state.library.forEach((it) => {
      const li = document.createElement("li");
      li.className = "list-item";
      const img = document.createElement("img");
      img.className = "avatar";
      img.alt = "cover";
      img.src = it.cover || "";
      const text = document.createElement("div");
      text.className = "text";
      const p = document.createElement("div"); p.className = "primary"; p.textContent = it.title || it.name;
      const s = document.createElement("div"); s.className = "secondary"; s.textContent = "Local file";
      const actions = document.createElement("div");
      actions.className = "actions";
      const qBtn = document.createElement("button"); qBtn.className = "btn small"; qBtn.textContent = "Queue";
      const playBtn = document.createElement("button"); playBtn.className = "btn ghost small"; playBtn.textContent = "Play";
      actions.appendChild(qBtn); actions.appendChild(playBtn);
      text.appendChild(p); text.appendChild(s);
      li.appendChild(img); li.appendChild(text); li.appendChild(actions);

      qBtn.addEventListener("click", () => addToQueue(it));
      playBtn.addEventListener("click", () => {
        addToQueue(it, true);
      });
      els.library.appendChild(li);
    });
    storage.set("rp_library", state.library);
  }

  function updateNowPlaying(meta) {
    els.cover.src = meta.cover || "";
    els.title.textContent = meta.title || meta.name || "—";
    els.artist.textContent = meta.artist || (meta.type === "local" ? "Local file" : "—");
    document.title = `${els.title.textContent} • Retro Player`;
    fetchAndRenderLyrics(meta).catch(() => {});
    resetWaveform();
  }

  /**
   * Player controls
   */
  function loadIndex(i) {
    if (state.queue.length === 0) {
      els.audio.removeAttribute("src");
      updateNowPlaying({});
      return;
    }
    state.queueIndex = clamp(i, 0, state.queue.length - 1);
    const item = state.queue[state.queueIndex];
    updateNowPlaying(item);
    if (item.type === "deezer") {
      // Deezer preview is a 30s mp3 link at track.preview
      els.audio.src = item.preview || "";
    } else if (item.type === "local") {
      els.audio.src = item.url;
    } else if (item.url) {
      els.audio.src = item.url;
    }
    els.audio.play().catch(() => {});
    updatePlayButton();
    highlightActiveQueueItem();
    storage.set("rp_queueIndex", state.queueIndex);
  }

  function playNext() {
    if (state.shuffle) {
      const next = Math.floor(Math.random() * state.queue.length);
      loadIndex(next);
    } else if (state.queueIndex < state.queue.length - 1) {
      loadIndex(state.queueIndex + 1);
    } else if (state.repeat) {
      loadIndex(0);
    }
  }

  function playPrev() {
    if (els.audio.currentTime > 3) {
      els.audio.currentTime = 0; return;
    }
    const prev = state.queueIndex > 0 ? state.queueIndex - 1 : (state.repeat ? state.queue.length - 1 : 0);
    loadIndex(prev);
  }

  function updatePlayButton() {
    els.playBtn.textContent = els.audio.paused ? "▶️" : "⏸";
  }

  function highlightActiveQueueItem() {
    qsa(".queue-item", els.queue).forEach((li, i) => {
      li.style.outline = i === state.queueIndex ? `2px solid var(--accent)` : "none";
      li.style.background = i === state.queueIndex ? "rgba(255,255,255,0.05)" : "transparent";
    });
  }

  function addToQueue(item, andPlay = false) {
    state.queue.push(item);
    renderQueue();
    if (andPlay) {
      loadIndex(state.queue.length - 1);
    }
  }

  function removeFromQueue(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.queue.splice(index, 1);
    if (state.queueIndex >= state.queue.length) state.queueIndex = state.queue.length - 1;
    renderQueue();
    highlightActiveQueueItem();
  }

  /**
   * Drag reorder queue
   */
  let dragIndex = null;
  els.queue.addEventListener("dragstart", (e) => {
    const li = e.target.closest(".queue-item");
    if (!li) return;
    dragIndex = Number(li.dataset.index);
    e.dataTransfer.effectAllowed = "move";
  });
  els.queue.addEventListener("dragover", (e) => {
    e.preventDefault();
    const after = getDragAfterElement(els.queue, e.clientY);
    const dragging = qsa(".queue-item", els.queue).find((el) => Number(el.dataset.index) === dragIndex);
    if (!dragging) return;
    if (after == null) {
      els.queue.appendChild(dragging);
    } else {
      els.queue.insertBefore(dragging, after);
    }
  });
  els.queue.addEventListener("drop", () => {
    const order = qsa(".queue-item", els.queue).map((el) => Number(el.dataset.index));
    const newQueue = order.map((i) => state.queue[i]);
    state.queue = newQueue;
    state.queueIndex = clamp(state.queueIndex, 0, state.queue.length - 1);
    renderQueue();
    highlightActiveQueueItem();
  });

  function getDragAfterElement(container, y) {
    const elsArr = [...container.querySelectorAll(".queue-item")];
    return elsArr.reduce(
      (closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: child };
        } else {
          return closest;
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element;
  }

  /**
   * Deezer JSONP search
   */
  const JSONP_CB_PREFIX = "__dz_cb_";
  function searchDeezer(query) {
    return new Promise((resolve, reject) => {
      if (!query || !query.trim()) return resolve([]);
      const cbName = JSONP_CB_PREFIX + Math.random().toString(36).slice(2);
      const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&output=jsonp&callback=${cbName}`;
      const script = document.createElement("script");
      window[cbName] = (data) => {
        try { resolve(data.data || []); } finally {
          delete window[cbName];
          script.remove();
        }
      };
      script.onerror = () => {
        delete window[cbName];
        script.remove();
        reject(new Error("Deezer request failed"));
      };
      script.src = url;
      document.body.appendChild(script);
    });
  }

  async function runSearch() {
    const q = els.searchInput.value.trim();
    els.results.innerHTML = "";
    if (!q) return;
    const loading = document.createElement("div");
    loading.className = "hint";
    loading.textContent = "Searching Deezer…";
    els.results.parentElement.appendChild(loading);
    try {
      const tracks = await searchDeezer(q);
      tracks.slice(0, 40).forEach((t) => {
        const li = createResultItem(t);
        const qbtn = qs('[data-action="queue"]', li);
        const pbtn = qs('[data-action="play"]', li);
        qbtn.addEventListener("click", () => {
          const payload = JSON.parse(li.dataset.payload);
          addToQueue(payload);
        });
        pbtn.addEventListener("click", () => {
          const payload = JSON.parse(li.dataset.payload);
          addToQueue(payload, true);
        });
        els.results.appendChild(li);
      });
    } catch (e) {
      const err = document.createElement("div"); err.className = "hint"; err.textContent = "Search failed. Check connection.";
      els.results.parentElement.appendChild(err);
    } finally {
      loading.remove();
    }
  }

  /**
   * Local files: create object URLs and minimal metadata
   */
  function handleLocalFiles(files) {
    const items = Array.from(files).map((f) => ({
      type: "local",
      name: f.name,
      title: f.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(f),
      cover: "",
    }));
    state.library.push(...items);
    renderLibrary();
  }

  /**
   * Bind events
   */
  els.themeToggle.addEventListener("click", () => {
    state.theme = document.documentElement.classList.contains("light") ? "dark" : "light";
    applyTheme(state.theme);
  });

  els.searchBtn.addEventListener("click", runSearch);
  els.clearSearchBtn.addEventListener("click", () => { els.results.innerHTML = ""; els.searchInput.value = ""; els.searchInput.focus(); });
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  els.addLocalBtn.addEventListener("click", () => els.filePicker.click());
  els.filePicker.addEventListener("change", (e) => handleLocalFiles(e.target.files));
  els.clearLibraryBtn.addEventListener("click", () => { state.library = []; renderLibrary(); });

  els.shuffleBtn.addEventListener("click", () => { state.shuffle = !state.shuffle; els.shuffleBtn.style.borderColor = state.shuffle ? "var(--accent)" : "var(--border)"; });
  els.repeatBtn.addEventListener("click", () => { state.repeat = !state.repeat; els.repeatBtn.style.borderColor = state.repeat ? "var(--accent)" : "var(--border)"; storage.set("rp_repeat", state.repeat); });
  els.clearQueueBtn.addEventListener("click", () => { state.queue = []; state.queueIndex = 0; renderQueue(); updateNowPlaying({}); els.audio.pause(); updatePlayButton(); });

  els.prevBtn.addEventListener("click", playPrev);
  els.nextBtn.addEventListener("click", playNext);
  els.playBtn.addEventListener("click", () => { if (els.audio.src) { if (els.audio.paused) { els.audio.play(); } else { els.audio.pause(); } } updatePlayButton(); });

  els.seek.addEventListener("input", () => {
    if (els.audio.duration) {
      const t = (Number(els.seek.value) / Number(els.seek.max)) * els.audio.duration;
      els.audio.currentTime = t;
    }
  });
  els.volume.addEventListener("input", () => {
    els.audio.volume = clamp(Number(els.volume.value), 0, 1);
    storage.set("rp_volume", els.audio.volume);
  });
  els.muteBtn.addEventListener("click", () => {
    els.audio.muted = !els.audio.muted;
    els.muteBtn.textContent = els.audio.muted ? "🔇" : "🔈";
  });

  // Queue item interactions
  els.queue.addEventListener("click", (e) => {
    const li = e.target.closest(".queue-item");
    if (!li) return;
    const idx = Number(li.dataset.index);
    if (e.target.matches('[data-action="remove"]')) {
      removeFromQueue(idx);
    } else {
      loadIndex(idx);
    }
  });

  // Audio events
  els.audio.addEventListener("timeupdate", () => {
    els.currentTime.textContent = formatTime(els.audio.currentTime);
    els.duration.textContent = formatTime(els.audio.duration);
    if (els.audio.duration) {
      els.seek.value = String(Math.floor((els.audio.currentTime / els.audio.duration) * Number(els.seek.max)));
    }
    syncLyrics(els.audio.currentTime);
  });
  els.audio.addEventListener("play", updatePlayButton);
  els.audio.addEventListener("pause", updatePlayButton);
  els.audio.addEventListener("ended", () => {
    if (state.repeat && state.queue.length === 1) {
      els.audio.currentTime = 0; els.audio.play(); return;
    }
    playNext();
  });

  // Keyboard shortcuts
  window.addEventListener("keydown", (e) => {
    const activeTag = document.activeElement?.tagName?.toLowerCase();
    const typing = activeTag === "input" || activeTag === "textarea";
    if (e.key === "/") { e.preventDefault(); els.searchInput.focus(); return; }
    if (typing) return;
    if (e.code === "Space") { e.preventDefault(); els.playBtn.click(); }
    if (e.key.toLowerCase() === "k") playPrev();
    if (e.key.toLowerCase() === "l") playNext();
    if (e.key.toLowerCase() === "m") els.muteBtn.click();
    if (e.key.toLowerCase() === "s") els.shuffleBtn.click();
    if (e.key.toLowerCase() === "r") els.repeatBtn.click();
    if (e.key.toLowerCase() === "t") els.themeToggle.click();
  });

  // Initial render
  renderQueue();
  renderLibrary();
  if (state.queue.length > 0) {
    loadIndex(clamp(state.queueIndex, 0, state.queue.length - 1));
  }

  /**
   * Waveform Visualizer (Web Audio API)
   */
  let audioCtx = null, analyser = null, dataArray = null, rafId = null, canvasCtx = null;
  function ensureAudioGraph() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaElementSource(els.audio);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      const gain = audioCtx.createGain();
      src.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      canvasCtx = els.waveform.getContext("2d");
      drawWaveform();
    }
  }
  function resetWaveform() {
    if (!els.waveform) return;
    const ctx = els.waveform.getContext("2d");
    ctx.clearRect(0, 0, els.waveform.width, els.waveform.height);
  }
  function drawWaveform() {
    if (!analyser || !canvasCtx || !els.waveform) return;
    const w = els.waveform.clientWidth;
    const h = els.waveform.height;
    if (els.waveform.width !== w) els.waveform.width = w;
    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.clearRect(0, 0, w, h);
    canvasCtx.lineWidth = 2;
    const grad = canvasCtx.createLinearGradient(0,0,w,0);
    grad.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
    grad.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim());
    canvasCtx.strokeStyle = grad;
    canvasCtx.beginPath();
    const slice = w / dataArray.length;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0; // 0..2
      const y = (v * h) / 2;
      const x = i * slice;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }
    canvasCtx.stroke();
    rafId = requestAnimationFrame(drawWaveform);
  }
  els.audio.addEventListener('play', () => { ensureAudioGraph(); if (audioCtx?.state === 'suspended') audioCtx.resume(); });
  els.audio.addEventListener('pause', () => { if (audioCtx?.state === 'running') {/* keep visual */} });

  /**
   * Lyrics (LRCLIB and fallback)
   */
  let currentLyrics = null; // {lines: [{time: seconds, text}], raw}
  async function fetchAndRenderLyrics(meta) {
    if (!meta || (!meta.title && !meta.name)) return clearLyrics();
    const title = meta.title || meta.name;
    const artist = meta.artist || "";
    try {
      // LRCLIB API (no key): https://lrclib.net/api/search?artist_name=&track_name=
      const url = `https://lrclib.net/api/search?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('lyrics not found');
      const data = await res.json();
      const best = Array.isArray(data) ? data[0] : null;
      if (best?.syncedLyrics) {
        currentLyrics = parseLRC(best.syncedLyrics);
      } else if (best?.plainLyrics) {
        currentLyrics = { lines: best.plainLyrics.split(/\n+/).map((t)=>({ time: null, text: t })), raw: best.plainLyrics };
      } else {
        currentLyrics = null;
      }
    } catch {
      currentLyrics = null;
    }
    renderLyrics();
  }
  function clearLyrics() { currentLyrics = null; renderLyrics(); }
  function parseLRC(lrc) {
    const lines = [];
    const re = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]\s*(.*)/g;
    let m;
    while ((m = re.exec(lrc)) !== null) {
      const min = Number(m[1]);
      const sec = Number(m[2]);
      const cs = m[3] ? Number(m[3]) : 0;
      const time = min * 60 + sec + cs / 100;
      lines.push({ time, text: m[4] });
    }
    lines.sort((a,b)=> (a.time ?? Number.MAX_VALUE) - (b.time ?? Number.MAX_VALUE));
    return { lines, raw: lrc };
  }
  function renderLyrics() {
    els.lyricsContent.innerHTML = "";
    if (!currentLyrics || !currentLyrics.lines?.length) {
      const d = document.createElement('div'); d.className = 'hint'; d.textContent = 'No lyrics found.'; els.lyricsContent.appendChild(d); return;
    }
    currentLyrics.lines.forEach((ln, i) => {
      const div = document.createElement('div');
      div.className = 'lyrics-line';
      div.dataset.index = String(i);
      div.textContent = ln.text || '';
      els.lyricsContent.appendChild(div);
    });
  }
  function syncLyrics(currentSec) {
    if (!currentLyrics || !currentLyrics.lines || !currentLyrics.lines.length) return;
    // Find current line
    let idx = -1;
    for (let i = 0; i < currentLyrics.lines.length; i++) {
      const t = currentLyrics.lines[i].time;
      const nextT = currentLyrics.lines[i+1]?.time ?? Number.POSITIVE_INFINITY;
      if (t != null && currentSec >= t && currentSec < nextT) { idx = i; break; }
    }
    qsa('.lyrics-line', els.lyricsContent).forEach((el, i) => {
      if (i === idx) {
        el.classList.add('active');
        // Auto-scroll
        const top = el.offsetTop - 80;
        els.lyricsContent.scrollTo({ top, behavior: 'smooth' });
      } else {
        el.classList.remove('active');
      }
    });
  }

  // Lyrics UI controls
  els.lyricsBtn.addEventListener('click', () => {
    const hidden = els.lyricsPanel.hasAttribute('hidden');
    if (hidden) {
      els.lyricsPanel.removeAttribute('hidden');
    } else {
      els.lyricsPanel.setAttribute('hidden', '');
    }
  });
  els.closeLyricsBtn.addEventListener('click', () => { els.lyricsPanel.setAttribute('hidden', ''); });
  els.refreshLyricsBtn.addEventListener('click', () => {
    const current = state.queue[state.queueIndex];
    fetchAndRenderLyrics(current || {}).catch(() => {});
  });
})();


