(function () {
  const sync = window.OutsiderPublicSync;
  const storage = window.OutsiderStorage;
  const stage = document.getElementById("player-stage");
  const idle = document.getElementById("player-idle");
  const handoutImage = document.getElementById("public-handout");
  const fallback = document.getElementById("public-fallback");
  const diceOverlay = document.getElementById("dice-overlay");
  const diceOverlayDice = document.getElementById("dice-overlay-dice");
  const diceOverlayExpression = document.getElementById("dice-overlay-expression");
  const diceOverlayTotal = document.getElementById("dice-overlay-total");
  const musicIndicator = document.getElementById("music-indicator");
  const audioPrompt = document.getElementById("audio-enable-prompt");
  const enableAudioButton = document.getElementById("enable-audio-button");

  let imageLoadToken = 0;
  let rollHideTimer = null;
  let lastRollKey = "";
  let lastResetToken = 0;
  let lastTrackKey = "";

  // A silent, one-sample WAV. Playing (and immediately pausing) it during a
  // real user gesture is enough in most browsers to "unlock" this specific
  // <audio> element so that later, gesture-less play() calls triggered by a
  // BroadcastChannel/storage message are allowed to produce sound.
  const SILENT_UNLOCK_SOURCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

  const audio = new Audio();
  audio.preload = "auto";
  let audioUnlocked = false;
  try {
    audioUnlocked = sessionStorage.getItem("outsider-audio-unlocked") === "1";
  } catch (error) {
    audioUnlocked = false;
  }

  function setMode(mode) {
    stage.dataset.mode = mode;
    const hidden = mode === "hidden";
    idle.hidden = hidden;
    fallback.hidden = true;
    if (hidden) handoutImage.hidden = true;
  }

  function renderHandout(state) {
    const mode = state && state.mode ? state.mode : "idle";
    // Invalidate a pending image on every state change. Without this, an image
    // that finishes loading just after HIDE could repaint the public screen.
    const loadToken = ++imageLoadToken;
    setMode(mode);
    if (mode !== "showing" || !state.handout) {
      handoutImage.hidden = true;
      idle.hidden = mode === "hidden";
      return;
    }

    idle.hidden = true;
    handoutImage.hidden = true;
    fallback.hidden = true;

    function applySource(source) {
      if (loadToken !== imageLoadToken) return;
      if (!source) {
        fallback.hidden = false;
        return;
      }
      handoutImage.onload = () => {
        if (loadToken !== imageLoadToken) return;
        handoutImage.hidden = false;
        fallback.hidden = true;
      };
      handoutImage.onerror = () => {
        if (loadToken !== imageLoadToken) return;
        handoutImage.hidden = true;
        // A neutral dark frame is safer than a broken-image icon or diagnostic message.
        fallback.hidden = false;
      };
      handoutImage.src = source;
    }

    if (state.handout.kind === "custom") {
      if (!storage) { fallback.hidden = false; return; }
      storage.getHandoutObjectURL(state.handout.id).then(applySource).catch(() => applySource(null));
    } else {
      applySource(state.handout.image);
    }
  }

  function hideRollOverlay() {
    if (rollHideTimer) { clearTimeout(rollHideTimer); rollHideTimer = null; }
    diceOverlay.classList.remove("is-visible");
    diceOverlay.hidden = true;
  }

  function renderRoll(roll) {
    const key = roll ? `${roll.revealedAt}:${roll.visible}` : "none";
    if (key === lastRollKey) return;
    lastRollKey = key;

    if (rollHideTimer) { clearTimeout(rollHideTimer); rollHideTimer = null; }

    if (!roll || !roll.visible) {
      hideRollOverlay();
      return;
    }

    const OVERLAY_DURATION_MS = 4500;
    const remaining = OVERLAY_DURATION_MS - (Date.now() - roll.revealedAt);
    if (remaining <= 0) {
      hideRollOverlay();
      return;
    }

    diceOverlayDice.textContent = `${roll.dice}d6`;
    diceOverlayExpression.textContent = roll.results.join("   ");
    diceOverlayTotal.textContent = "";
    diceOverlay.hidden = false;
    // Restart the fade-in animation even if the overlay was already visible.
    diceOverlay.classList.remove("is-visible");
    void diceOverlay.offsetWidth;
    diceOverlay.classList.add("is-visible");

    rollHideTimer = setTimeout(hideRollOverlay, remaining);
  }

  function resolveTrackSource(track) {
    if (!track) return Promise.resolve(null);
    if (track.kind === "custom") {
      return storage ? storage.getTrackObjectURL(track.id).catch(() => null) : Promise.resolve(null);
    }
    return Promise.resolve(track.file || null);
  }

  function renderMusic(music) {
    const state = music || { track: null, playing: false, volume: 0.65, indicatorEnabled: true, resetToken: 0 };
    audio.volume = state.volume;

    if (state.resetToken !== lastResetToken) {
      lastResetToken = state.resetToken;
      audio.pause();
      try { audio.currentTime = 0; } catch (error) { /* no source loaded yet */ }
    }

    const trackKey = state.track ? `${state.track.kind}:${state.track.id}` : "none";
    if (trackKey !== lastTrackKey) {
      lastTrackKey = trackKey;
      if (!state.track) {
        audio.pause();
        audio.removeAttribute("src");
      } else {
        resolveTrackSource(state.track).then((source) => {
          if (lastTrackKey !== trackKey) return; // a newer track change already happened
          if (!source) return;
          audio.src = source;
          audio.load();
          if (state.playing) attemptPlay();
        });
      }
    } else if (state.playing) {
      attemptPlay();
    } else {
      audio.pause();
    }

    const showIndicator = state.indicatorEnabled && state.playing && state.track && state.track.label;
    if (showIndicator) {
      musicIndicator.textContent = `♪ ${state.track.label}`;
      musicIndicator.hidden = false;
    } else {
      musicIndicator.hidden = true;
    }
  }

  function attemptPlay() {
    if (!audio.src) return;
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {
        // Blocked by the browser's autoplay policy. The audio-enable prompt
        // (shown below whenever playback hasn't been unlocked yet) is the
        // recovery path — we deliberately do not try to bypass this.
      });
    }
  }

  function markUnlocked() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try { sessionStorage.setItem("outsider-audio-unlocked", "1"); } catch (error) { /* ignore */ }
    audioPrompt.hidden = true;
  }

  function unlockAudio() {
    if (audioUnlocked) { audioPrompt.hidden = true; return; }
    const hadSource = Boolean(audio.src);
    const previousSource = audio.src;
    if (!hadSource) audio.src = SILENT_UNLOCK_SOURCE;
    const playResult = audio.play();
    const finish = () => {
      if (!hadSource) {
        audio.pause();
        audio.removeAttribute("src");
        if (previousSource) audio.src = previousSource;
      }
      markUnlocked();
      // If a track is already meant to be playing, start it for real now.
      const state = sync.getState();
      if (state.music && state.music.playing) renderMusic(state.music);
    };
    if (playResult && typeof playResult.then === "function") {
      playResult.then(finish).catch(finish);
    } else {
      finish();
    }
  }

  audioPrompt.addEventListener("click", unlockAudio);
  enableAudioButton.addEventListener("click", (event) => { event.stopPropagation(); unlockAudio(); });
  audioPrompt.hidden = audioUnlocked;

  function render(state) {
    renderHandout(state);
    renderRoll(state.roll);
    renderMusic(state.music);
  }

  sync.subscribe(render);
  render(sync.getState());
})();
