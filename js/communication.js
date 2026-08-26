/* A tiny, backend-free link between the GM and public browser windows. */
(function () {
  const CHANNEL_NAME = "the-outsider-public-display-v1";
  const STORAGE_KEY = "the-outsider-public-state-v1";
  const DEFAULT_STATE = Object.freeze({ mode: "idle", handout: null, updatedAt: 0 });
  let channel = null;

  function safeState(candidate) {
    const mode = ["idle", "showing", "hidden"].includes(candidate && candidate.mode) ? candidate.mode : "idle";
    const rawHandout = candidate && candidate.handout;
    const handout = rawHandout && typeof rawHandout.id === "string" && typeof rawHandout.image === "string"
      ? { id: rawHandout.id, image: rawHandout.image }
      : null;
    return { mode, handout, updatedAt: Number(candidate && candidate.updatedAt) || Date.now() };
  }

  function getState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? safeState(JSON.parse(saved)) : { ...DEFAULT_STATE };
    } catch (error) {
      return { ...DEFAULT_STATE };
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
    const state = safeState({ ...nextState, updatedAt: Date.now() });
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
