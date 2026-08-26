(function () {
  const stage = document.getElementById("player-stage");
  const idle = document.getElementById("player-idle");
  const handoutImage = document.getElementById("public-handout");
  const fallback = document.getElementById("public-fallback");
  let imageLoadToken = 0;

  function setMode(mode) {
    stage.dataset.mode = mode;
    const hidden = mode === "hidden";
    idle.hidden = hidden;
    fallback.hidden = true;
    if (hidden) handoutImage.hidden = true;
  }

  function render(state) {
    const mode = state && state.mode ? state.mode : "idle";
    // Invalidate a pending image on every state change. Without this, an image
    // that finishes loading just after HIDE could repaint the public screen.
    const loadToken = ++imageLoadToken;
    setMode(mode);
    if (mode !== "showing" || !state.handout || !state.handout.image) {
      handoutImage.hidden = true;
      idle.hidden = mode === "hidden";
      return;
    }

    idle.hidden = true;
    handoutImage.hidden = true;
    fallback.hidden = true;
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
    handoutImage.src = state.handout.image;
  }

  window.OutsiderPublicSync.subscribe(render);
  render(window.OutsiderPublicSync.getState());
})();
