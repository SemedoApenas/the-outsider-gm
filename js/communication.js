/* A tiny, backend-free link between the GM and public browser windows. */
(function () {
  const CHANNEL_NAME = "the-outsider-public-display-v1";
  const STORAGE_KEY = "the-outsider-public-state-v1";

  /*
   * The public state is intentionally declarative: whatever this object
   * says is exactly what the Public Screen should be showing/playing right
   * now. A freshly opened player.html calls getState() and renders the
   * current truth immediately, instead of waiting for the next command.
   *
   * Fields added after the original release (roll, music) are optional and
   * always sanitized with safe defaults, so older saved state (or a stray
   * malformed message) can never break either window.
   */
  const DEFAULT_MUSIC = Object.freeze({
    track: null,        // { id, kind: "builtin" | "custom", file?, label } | null
    playing: false,
    loop: false,
    volume: 0.65,
    indicatorEnabled: true,
    resetToken: 0        // bumped on every explicit "Stop" so player.js can distinguish stop from pause
  });
  const DEFAULT_STATE = Object.freeze({
    mode: "idle",
    handout: null,
    roll: null,
    music: DEFAULT_MUSIC,
    updatedAt: 0
  });

  let channel = null;

  function safeHandout(candidate) {
    if (!candidate || typeof candidate.id !== "string") return null;
    const kind = candidate.kind === "custom" ? "custom" : "builtin";
    const image = typeof candidate.image === "string" ? candidate.image : null;
    // Built-in handouts travel with their static image path (as before).
    // Custom handouts travel as an id only; each window resolves the blob
    // locally via OutsiderStorage so no Blob ever needs to cross windows.
    if (kind === "builtin" && !image) return null;
    return { id: candidate.id, kind, image: kind === "builtin" ? image : null };
  }

  function safeRoll(candidate) {
    if (!candidate) return null;
    const dice = [1, 2, 3].includes(Number(candidate.dice)) ? Number(candidate.dice) : null;
    const results = Array.isArray(candidate.results)
        ? candidate.results.map(Number).filter((n) => n >= 1 && n <= 6)
        : null;

    if (!dice || !results || results.length !== dice) return null;

    const revealedAt = Number(candidate.revealedAt) || Date.now();
    const visible = Boolean(candidate.visible);

    return { dice, results, revealedAt, visible };
  }

  function safeMusic(candidate) {
    const source = candidate || {};
    const rawTrack = source.track;
    let track = null;
    if (rawTrack && typeof rawTrack.id === "string") {
      const kind = rawTrack.kind === "custom" ? "custom" : "builtin";
      const file = typeof rawTrack.file === "string" ? rawTrack.file : null;
      const label = typeof rawTrack.label === "string" ? rawTrack.label : "";
      if (kind === "builtin" && !file) track = null;
      else track = { id: rawTrack.id, kind, file: kind === "builtin" ? file : null, label };
    }
    const volume = Number(source.volume);
    return {
      track,
      playing: Boolean(source.playing) && Boolean(track),
      loop: Boolean(source.loop),
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_MUSIC.volume,
      indicatorEnabled: source.indicatorEnabled === undefined ? DEFAULT_MUSIC.indicatorEnabled : Boolean(source.indicatorEnabled),
      resetToken: Number(source.resetToken) || 0
    };
  }

  function safeState(candidate) {
    const mode = ["idle", "showing", "hidden"].includes(candidate && candidate.mode) ? candidate.mode : "idle";
    return {
      mode,
      handout: safeHandout(candidate && candidate.handout),
      roll: safeRoll(candidate && candidate.roll),
      music: safeMusic(candidate && candidate.music),
      updatedAt: Number(candidate && candidate.updatedAt) || Date.now()
    };
  }

  function getState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? safeState(JSON.parse(saved)) : safeState(DEFAULT_STATE);
    } catch (error) {
      return safeState(DEFAULT_STATE);
    }
  }

  function makeChannel() {
    if (channel || !("BroadcastChannel" in window)) return channel;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (error) {
      channel = null;
    }
    return channel;
  }

  function publish(nextState) {
    // Merge over the current state so callers can pass partial updates
    // (e.g. only { roll } or only { music }) without clobbering the rest.
    const state = safeState({ ...getState(), ...nextState, updatedAt: Date.now() });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // BroadcastChannel still lets open windows synchronize if storage is blocked.
    }
    const activeChannel = makeChannel();
    if (activeChannel) activeChannel.postMessage({ type: "public-state", state });
    return state;
  }

  function subscribe(listener) {
    const activeChannel = makeChannel();
    if (activeChannel) {
      activeChannel.addEventListener("message", (event) => {
        if (event.data && event.data.type === "public-state") listener(safeState(event.data.state));
      });
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        listener(safeState(JSON.parse(event.newValue)));
      } catch (error) {
        // Ignore invalid browser storage values and leave the current public image alone.
      }
    });
  }

  window.OutsiderPublicSync = { getState, publish, subscribe };
})();
