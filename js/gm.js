(function () {
  const sync = window.OutsiderPublicSync;
  const storage = window.OutsiderStorage;

  const publicStatus = document.getElementById("public-status");
  const statusCopy = document.getElementById("screen-status-copy");
  const currentHandout = document.getElementById("current-handout");
  const overviewScreenStatus = document.getElementById("overview-screen-status");
  const handoutGrid = document.getElementById("handout-grid");
  const newHandoutButton = document.getElementById("new-handout-button");
  const nowPlaying = document.getElementById("now-playing");
  const overviewMusic = document.getElementById("overview-music");
  const musicMessage = document.getElementById("music-message");
  const trackList = document.getElementById("track-list");
  const newTrackButton = document.getElementById("new-track-button");
  const volumeSlider = document.getElementById("volume-slider");
  const musicIndicatorToggle = document.getElementById("music-indicator-toggle");
  const musicLoopToggle = document.getElementById("music-loop-toggle");
  const diceResults = Array.from(document.querySelectorAll(".die-result"));
  const diceTotal = document.getElementById("dice-total");
  const rollButton = document.getElementById("roll-button");
  const rollHistory = document.getElementById("roll-history");
  const lastRollLabel = document.getElementById("last-roll");
  const showLastRollButton = document.getElementById("show-last-roll");
  const hideRollButton = document.getElementById("hide-roll");
  const diceVisibilityPrivate = document.getElementById("dice-visibility-private");
  const diceVisibilityPublic = document.getElementById("dice-visibility-public");

  const handoutDialog = document.getElementById("handout-dialog");
  const handoutPreviewDialog = document.getElementById("handout-preview-dialog");
  const handoutPreviewImage = document.getElementById("handout-preview-image");
  const handoutPreviewClose = document.getElementById("handout-preview-close");
  const handoutForm = document.getElementById("handout-form");
  const handoutDialogTitle = document.getElementById("handout-dialog-title");
  const handoutTitleInput = document.getElementById("handout-title-input");
  const handoutCategoryInput = document.getElementById("handout-category-input");
  const handoutImageInput = document.getElementById("handout-image-input");
  const handoutImageHint = document.getElementById("handout-image-hint");
  const handoutDialogCancel = document.getElementById("handout-dialog-cancel");

  const trackDialog = document.getElementById("track-dialog");
  const trackForm = document.getElementById("track-form");
  const trackDialogTitle = document.getElementById("track-dialog-title");
  const trackNameInput = document.getElementById("track-name-input");
  const trackAudioInput = document.getElementById("track-audio-input");
  const trackAudioHint = document.getElementById("track-audio-hint");
  const trackDialogCancel = document.getElementById("track-dialog-cancel");

  const confirmDialog = document.getElementById("confirm-dialog");
  const confirmDialogMessage = document.getElementById("confirm-dialog-message");
  const confirmDialogCancel = document.getElementById("confirm-dialog-cancel");

  let publicState = sync.getState();
  let selectedHandoutId = publicState.handout ? publicState.handout.id : null;
  let customHandouts = [];   // raw records from storage: { id, title, category, blob }
  let customTracks = [];     // raw records from storage: { id, name, blob }
  let diceCount = 1;
  let isRolling = false;
  let diceVisibility = "private";
  let lastRoll = null; // { dice, results } — kept privately regardless of visibility
  const history = [];
  let editingHandoutId = null;
  let editingTrackId = null;
  let volumeDebounce = null;

  // ---- Combined content lists (built-in + custom) ------------------------

  function combinedHandouts() {
    const builtIn = handouts.map((handout) => ({ ...handout, kind: "builtin" }));
    const custom = customHandouts.map((record) => ({
      id: record.id, name: record.title, category: record.category, kind: "custom"
    }));
    return builtIn.concat(custom);
  }

  function combinedTracks() {
    const builtIn = tracks.map((track) => ({ ...track, kind: "builtin" }));
    const custom = customTracks.map((record) => ({ id: record.id, name: record.name, kind: "custom" }));
    return builtIn.concat(custom);
  }

  function handoutById(id) {
    return combinedHandouts().find((handout) => handout.id === id) || null;
  }

  function trackById(id) {
    return combinedTracks().find((track) => track.id === id) || null;
  }

  function refreshCustomHandouts() {
    if (!storage) return Promise.resolve();
    return storage.getAllHandouts().then((records) => { customHandouts = records; renderHandouts(); });
  }

  function refreshCustomTracks() {
    if (!storage) return Promise.resolve();
    return storage.getAllTracks().then((records) => { customTracks = records; renderTracks(); });
  }

  // ---- Public state helpers ----------------------------------------------

  function currentHandoutData() {
    return handoutById(selectedHandoutId) || (publicState.handout && handoutById(publicState.handout.id));
  }

  function publicHandoutPayload(handout) {
    if (!handout) return null;
    return handout.kind === "custom"
      ? { id: handout.id, kind: "custom" }
      : { id: handout.id, kind: "builtin", image: handout.image };
  }

  function publishPublicState(partial) {
    publicState = sync.publish(partial);
    renderPublicStatus();
    renderMusicUI();
  }

  function publishMusic(partial) {
    publishPublicState({ music: { ...publicState.music, ...partial } });
  }

  function renderPublicStatus() {
    const activeHandout = publicState.handout ? handoutById(publicState.handout.id) : null;
    const handoutName = activeHandout ? activeHandout.name : "The Outsider opening screen";
    const isHidden = publicState.mode === "hidden";
    const isShowingHandout = publicState.mode === "showing" && activeHandout;

    publicStatus.textContent = isHidden ? "● HIDDEN" : "● ON";
    publicStatus.classList.toggle("status-hidden", isHidden);
    publicStatus.classList.toggle("status-showing", !isHidden);
    statusCopy.textContent = isHidden
      ? "The public window is completely dark."
      : isShowingHandout
        ? `Showing ${activeHandout.name}.`
        : "The opening screen is visible.";
    currentHandout.textContent = isHidden && activeHandout ? `${handoutName} (held)` : handoutName;
    overviewScreenStatus.textContent = isHidden ? "🔴 Hidden" : "🟢 Showing";
    renderHandouts();
  }

  function prepareHandout(id) {
    selectedHandoutId = id;
    renderHandouts();
  }

  function showHandout(id) {
    const handout = handoutById(id || selectedHandoutId);
    if (!handout) {
      publishPublicState({ mode: "idle", handout: null });
      return;
    }
    selectedHandoutId = handout.id;
    publishPublicState({ mode: "showing", handout: publicHandoutPayload(handout) });
  }

  function showPublicScreen() {
    const handout = currentHandoutData();
    publishPublicState({ mode: handout ? "showing" : "idle", handout: publicHandoutPayload(handout) });
  }

  function hidePublicScreen() {
    const handout = currentHandoutData();
    publishPublicState({ mode: "hidden", handout: publicHandoutPayload(handout) });
  }

  // ---- Handouts: rendering ------------------------------------------------

  function renderHandouts() {
    const list = combinedHandouts();
    handoutGrid.innerHTML = list.map((handout) => {
      const isSelected = handout.id === selectedHandoutId;
      const isVisible = publicState.mode === "showing" && publicState.handout && publicState.handout.id === handout.id;
      const isCustom = handout.kind === "custom";
      return `
        <article class="handout-card${isSelected ? " is-selected" : ""}${isVisible ? " is-visible" : ""}" data-handout-id="${handout.id}">
          <button class="handout-preview" type="button" data-prepare-handout="${handout.id}" aria-label="Prepare ${handout.name}">
            ${isCustom
              ? `<img data-custom-image="${handout.id}" alt="" loading="lazy" hidden><span class="handout-image-fallback" aria-hidden="true">✦</span>`
              : `<img src="${handout.image}" alt="" loading="lazy"><span class="handout-image-fallback" aria-hidden="true">✦</span>`}
            ${isVisible ? '<span class="live-badge">LIVE</span>' : ""}
          </button>
          <div class="handout-card-body">
            <span class="category-tag">${handout.category}<span class="kind-tag ${isCustom ? "kind-tag-custom" : "kind-tag-builtin"}">${isCustom ? "CUSTOM" : "BUILT-IN"}</span></span>
            <h3>${handout.name}</h3>
            <div class="handout-actions">
              <button class="button button-small button-primary" type="button" data-show-handout="${handout.id}">Show</button>
              <button class="button button-small button-dark" type="button" data-hide-handout="${handout.id}">Hide</button>
              <button class="button button-small button-dark" type="button" data-preview-handout="${handout.id}">Preview</button>
              ${isCustom ? `<button class="button button-small button-dark" type="button" data-edit-handout="${handout.id}">Edit</button>` : ""}
              ${isCustom ? `<button class="button button-small button-danger" type="button" data-delete-handout="${handout.id}">Delete</button>` : ""}
            </div>
          </div>
        </article>`;
    }).join("");

    handoutGrid.querySelectorAll("img[src]").forEach((image) => {
      image.addEventListener("error", () => image.closest(".handout-preview").classList.add("image-unavailable"), { once: true });
    });
    if (storage) {
      handoutGrid.querySelectorAll("img[data-custom-image]").forEach((image) => {
        const id = image.dataset.customImage;
        storage.getHandoutObjectURL(id).then((url) => {
          if (!url) { image.closest(".handout-preview").classList.add("image-unavailable"); return; }
          image.src = url;
          image.hidden = false;
        }).catch(() => image.closest(".handout-preview").classList.add("image-unavailable"));
      });
    }
  }

  // ---- Handouts: GM-only preview pop-up ------------------------------------
  // Purely local to this window: it never touches publicState or sync.publish(),
  // so it can never affect what the Public Screen is showing.

  function openHandoutPreview(id) {
    const handout = handoutById(id);
    if (!handout) return;
    handoutPreviewImage.removeAttribute("src");
    handoutPreviewImage.alt = handout.name;
    if (handout.kind === "custom") {
      if (!storage) return;
      storage.getHandoutObjectURL(handout.id).then((url) => {
        if (url) handoutPreviewImage.src = url;
      });
    } else {
      handoutPreviewImage.src = handout.image;
    }
    handoutPreviewDialog.showModal();
  }

  handoutPreviewClose.addEventListener("click", () => handoutPreviewDialog.close());
  handoutPreviewDialog.addEventListener("click", (event) => {
    // A click landing on the <dialog> element itself (not its inner content)
    // is a click on the native ::backdrop — close on it, same as Cancel.
    if (event.target === handoutPreviewDialog) handoutPreviewDialog.close();
  });

  // ---- Handouts: create / edit / delete dialog ---------------------------

  function openHandoutDialog(existing) {
    editingHandoutId = existing ? existing.id : null;
    handoutDialogTitle.textContent = existing ? "Edit handout" : "New handout";
    handoutTitleInput.value = existing ? existing.title : "";
    handoutCategoryInput.value = existing ? existing.category : "";
    handoutImageInput.value = "";
    handoutImageHint.textContent = existing
      ? "Leave empty to keep the current image. PNG, JPG, WEBP, or SVG."
      : "PNG, JPG, WEBP, or SVG.";
    handoutDialog.showModal();
  }

  newHandoutButton.addEventListener("click", () => openHandoutDialog(null));
  handoutDialogCancel.addEventListener("click", () => handoutDialog.close());

  handoutForm.addEventListener("submit", (event) => {
    const title = handoutTitleInput.value.trim();
    const category = handoutCategoryInput.value.trim();
    const file = handoutImageInput.files[0] || null;
    if (!title || !category) { event.preventDefault(); handoutImageHint.textContent = "Title and category are required."; return; }
    if (!editingHandoutId && !file) { event.preventDefault(); handoutImageHint.textContent = "Please choose an image."; return; }
    if (!storage) { event.preventDefault(); handoutImageHint.textContent = "Local storage is unavailable in this browser."; return; }

    const save = editingHandoutId
      ? storage.updateHandout(editingHandoutId, { title, category, blob: file || undefined })
      : storage.addHandout({ title, category, blob: file });
    save.then(refreshCustomHandouts);
    // No preventDefault: the <dialog> closes immediately; the save above finishes shortly after.
  });

  function deleteHandout(id) {
    const record = customHandouts.find((item) => item.id === id);
    if (!record) return;
    askConfirm(`Delete "${record.title}"?`).then((confirmed) => {
      if (!confirmed) return;
      const isCurrentlyPublic = publicState.mode === "showing" && publicState.handout && publicState.handout.id === id;
      const afterHide = isCurrentlyPublic ? Promise.resolve(hidePublicScreen()) : Promise.resolve();
      Promise.resolve(afterHide).then(() => storage.deleteHandout(id)).then(() => {
        if (selectedHandoutId === id) selectedHandoutId = null;
        return refreshCustomHandouts();
      });
    });
  }

  // ---- Music: rendering ---------------------------------------------------

  function renderMusicUI() {
    const music = publicState.music;
    const label = music.track ? music.track.label : "No track selected";
    nowPlaying.textContent = label;
    overviewMusic.textContent = label;
    musicMessage.textContent = !music.track
      ? "Choose a track, then press Play."
      : music.playing ? `Playing ${label} on the public screen.` : `Ready: ${label}.`;
    musicLoopToggle.checked = music.loop;
    renderTracks();
  }

  function renderTracks() {
    const list = combinedTracks();
    if (!list.length) {
      trackList.innerHTML = '<p class="empty-track-list">No music tracks configured.</p>';
      return;
    }
    const activeId = publicState.music.track ? publicState.music.track.id : null;
    trackList.innerHTML = list.map((track, index) => {
      const isCustom = track.kind === "custom";
      const isSelected = track.id === activeId;
      return `
        <div class="track-row${isSelected ? " is-selected" : ""}" data-track-id="${track.id}">
          <span class="track-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="track-name-cell">
            <span>${track.name}</span>
            <span class="kind-tag ${isCustom ? "kind-tag-custom" : "kind-tag-builtin"}">${isCustom ? "CUSTOM" : "BUILT-IN"}</span>
          </span>
          <span class="track-row-actions">
            <button class="button button-small button-primary" type="button" data-play-track="${track.id}">Play</button>
            ${isCustom ? `<button class="button button-small button-dark" type="button" data-edit-track="${track.id}">Edit</button>` : ""}
            ${isCustom ? `<button class="button button-small button-danger" type="button" data-delete-track="${track.id}">Delete</button>` : ""}
          </span>
        </div>`;
    }).join("");
  }

  function buildTrackRef(track) {
    return track.kind === "builtin"
      ? { id: track.id, kind: "builtin", file: track.file, label: track.name }
      : { id: track.id, kind: "custom", label: track.name };
  }

  function playTrack(id) {
    const track = trackById(id);
    if (!track) return;
    publishMusic({ track: buildTrackRef(track), playing: true });
  }

  function playMusic() {
    const list = combinedTracks();
    if (!list.length) { musicMessage.textContent = "No music tracks configured in data.js."; return; }
    const track = publicState.music.track ? trackById(publicState.music.track.id) : list[0];
    if (!track) { musicMessage.textContent = "No music tracks configured in data.js."; return; }
    publishMusic({ track: buildTrackRef(track), playing: true });
  }

  function pauseMusic() {
    publishMusic({ playing: false });
  }

  function stopMusic() {
    publishMusic({ playing: false, resetToken: (publicState.music.resetToken || 0) + 1 });
  }

  function changeTrack(direction) {
    const list = combinedTracks();
    if (!list.length) return;
    const currentId = publicState.music.track ? publicState.music.track.id : null;
    const currentIndex = list.findIndex((track) => track.id === currentId);
    const nextIndex = ((currentIndex === -1 ? 0 : currentIndex) + direction + list.length) % list.length;
    publishMusic({ track: buildTrackRef(list[nextIndex]), playing: publicState.music.playing });
  }

  // ---- Music: create / edit / delete dialog -------------------------------

  function openTrackDialog(existing) {
    editingTrackId = existing ? existing.id : null;
    trackDialogTitle.textContent = existing ? "Edit track" : "New track";
    trackNameInput.value = existing ? existing.name : "";
    trackAudioInput.value = "";
    trackAudioHint.textContent = existing
      ? "Leave empty to keep the current audio file. MP3, WAV, OGG, or M4A."
      : "MP3, WAV, OGG, or M4A (if supported by your browser).";
    trackDialog.showModal();
  }

  newTrackButton.addEventListener("click", () => openTrackDialog(null));
  trackDialogCancel.addEventListener("click", () => trackDialog.close());

  trackForm.addEventListener("submit", (event) => {
    const name = trackNameInput.value.trim();
    const file = trackAudioInput.files[0] || null;
    if (!name) { event.preventDefault(); trackAudioHint.textContent = "Track name is required."; return; }
    if (!editingTrackId && !file) { event.preventDefault(); trackAudioHint.textContent = "Please choose an audio file."; return; }
    if (!storage) { event.preventDefault(); trackAudioHint.textContent = "Local storage is unavailable in this browser."; return; }

    const save = editingTrackId
      ? storage.updateTrack(editingTrackId, { name, blob: file || undefined })
      : storage.addTrack({ name, blob: file });
    save.then(refreshCustomTracks);
  });

  function deleteTrack(id) {
    const record = customTracks.find((item) => item.id === id);
    if (!record) return;
    askConfirm(`Delete "${record.name}"?`).then((confirmed) => {
      if (!confirmed) return;
      const isCurrentlyActive = publicState.music.track && publicState.music.track.id === id;
      const afterStop = isCurrentlyActive
        ? Promise.resolve(publishMusic({ track: null, playing: false, resetToken: (publicState.music.resetToken || 0) + 1 }))
        : Promise.resolve();
      Promise.resolve(afterStop).then(() => storage.deleteTrack(id)).then(refreshCustomTracks);
    });
  }

  // ---- Generic confirm dialog ---------------------------------------------

  function askConfirm(message) {
    confirmDialogMessage.textContent = message;
    return new Promise((resolve) => {
      const onClose = () => {
        confirmDialog.removeEventListener("close", onClose);
        resolve(confirmDialog.returnValue === "confirm");
      };
      confirmDialog.addEventListener("close", onClose);
      confirmDialog.showModal();
    });
  }

  confirmDialogCancel.addEventListener("click", () => confirmDialog.close());

  // ---- Dice ----------------------------------------------------------------

  function setDiceVisibility(visibility) {
    diceVisibility = visibility;
    diceVisibilityPrivate.classList.toggle("is-selected", visibility === "private");
    diceVisibilityPublic.classList.toggle("is-selected", visibility === "public");
  }

  function setDiceCount(count) {
    diceCount = count;
    document.querySelectorAll(".dice-choice").forEach((button) => {
      button.classList.toggle("is-selected", Number(button.dataset.diceCount) === count);
    });
    rollButton.textContent = `Roll ${count}d6`;
    diceResults.forEach((die, index) => {
      die.classList.toggle("is-empty", index >= count);
      if (index >= count) die.textContent = "–";
    });
  }

  function drawDice(values, rolling) {
    diceResults.forEach((die, index) => {
      if (index >= diceCount) return;
      die.textContent = values[index];
      die.classList.toggle("is-rolling", rolling);
    });
  }

  function appendHistory(values) {
    const label = `${diceCount}d6 → ${values.join(" + ")}`;
    history.unshift(label);
    history.splice(6);
    rollHistory.innerHTML = history.map((item) => `<li>${item}</li>`).join("");
    diceTotal.textContent = "";
    lastRollLabel.textContent = label;
    return values;
}
  

  function publishRoll(roll) {
    publishPublicState({ roll: { dice: roll.dice, results: roll.results, revealedAt: Date.now(), visible: true } });
  }

  function showLastRoll() {
    if (!lastRoll) return;
    publishRoll(lastRoll);
  }

  function hideRoll() {
    publishPublicState({ roll: null });
  }

  function rollDice(count = diceCount) {
    if (isRolling) return;
    setDiceCount(count);
    isRolling = true;
    rollButton.disabled = true;
    const interval = window.setInterval(() => {
      drawDice(Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1), true);
    }, 65);
    window.setTimeout(() => {
      window.clearInterval(interval);
      const values = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);
      drawDice(values, false);
      const total = appendHistory(values);
      lastRoll = { dice: diceCount, results: values };
      if (diceVisibility === "public") publishRoll(lastRoll);
      rollButton.disabled = false;
      isRolling = false;
    }, 310);
  }

  // ---- Event wiring ----------------------------------------------------------

  document.getElementById("show-public-button").addEventListener("click", showPublicScreen);
  document.getElementById("hide-public-button").addEventListener("click", hidePublicScreen);
  document.getElementById("black-screen-button").addEventListener("click", hidePublicScreen);
  document.getElementById("quick-show-handout").addEventListener("click", showPublicScreen);
  document.getElementById("quick-hide-public").addEventListener("click", hidePublicScreen);
  document.getElementById("play-track").addEventListener("click", playMusic);
  document.getElementById("pause-track").addEventListener("click", pauseMusic);
  document.getElementById("stop-track").addEventListener("click", stopMusic);
  document.getElementById("previous-track").addEventListener("click", () => changeTrack(-1));
  document.getElementById("next-track").addEventListener("click", () => changeTrack(1));
  document.getElementById("quick-play-music").addEventListener("click", playMusic);
  document.getElementById("quick-pause-music").addEventListener("click", pauseMusic);
  volumeSlider.addEventListener("input", () => {
    if (volumeDebounce) clearTimeout(volumeDebounce);
    const value = Number(volumeSlider.value);
    volumeDebounce = setTimeout(() => publishMusic({ volume: value }), 120);
  });
  musicIndicatorToggle.addEventListener("change", () => publishMusic({ indicatorEnabled: musicIndicatorToggle.checked }));
  musicLoopToggle.addEventListener("change", () => publishMusic({ loop: musicLoopToggle.checked }));
  rollButton.addEventListener("click", () => rollDice());
  showLastRollButton.addEventListener("click", showLastRoll);
  hideRollButton.addEventListener("click", hideRoll);
  diceVisibilityPrivate.addEventListener("click", () => setDiceVisibility("private"));
  diceVisibilityPublic.addEventListener("click", () => setDiceVisibility("public"));

  handoutGrid.addEventListener("click", (event) => {
    const show = event.target.closest("[data-show-handout]");
    const hide = event.target.closest("[data-hide-handout]");
    const preview = event.target.closest("[data-preview-handout]");
    const edit = event.target.closest("[data-edit-handout]");
    const del = event.target.closest("[data-delete-handout]");
    const prepare = event.target.closest("[data-prepare-handout]");
    if (show) showHandout(show.dataset.showHandout);
    else if (preview) openHandoutPreview(preview.dataset.previewHandout);
    else if (edit) openHandoutDialog(customHandouts.find((item) => item.id === edit.dataset.editHandout));
    else if (del) deleteHandout(del.dataset.deleteHandout);
    else if (hide) {
      prepareHandout(hide.dataset.hideHandout);
      hidePublicScreen();
    } else if (prepare) prepareHandout(prepare.dataset.prepareHandout);
  });

  trackList.addEventListener("click", (event) => {
    const play = event.target.closest("[data-play-track]");
    const edit = event.target.closest("[data-edit-track]");
    const del = event.target.closest("[data-delete-track]");
    if (play) playTrack(play.dataset.playTrack);
    else if (edit) openTrackDialog(customTracks.find((item) => item.id === edit.dataset.editTrack));
    else if (del) deleteTrack(del.dataset.deleteTrack);
  });

  document.querySelectorAll(".dice-choice").forEach((button) => {
    button.addEventListener("click", () => setDiceCount(Number(button.dataset.diceCount)));
  });
  document.querySelectorAll("[data-quick-roll]").forEach((button) => {
    button.addEventListener("click", () => rollDice(Number(button.dataset.quickRoll)));
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches("input, textarea, select")) return;
    if (document.querySelector("dialog[open]")) return; // let the open dialog handle its own Escape/keys
    if (event.key === "Escape" || event.key.toLowerCase() === "h") {
      event.preventDefault();
      hidePublicScreen();
    } else if (event.key === " ") {
      event.preventDefault();
      if (publicState.music.playing) pauseMusic(); else playMusic();
    } else if (["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      rollDice(Number(event.key));
    }
  });

  sync.subscribe((state) => {
    publicState = state;
    if (state.handout) selectedHandoutId = state.handout.id;
    renderPublicStatus();
    renderMusicUI();
  });

  musicIndicatorToggle.checked = publicState.music.indicatorEnabled;
  musicLoopToggle.checked = publicState.music.loop;
  volumeSlider.value = String(publicState.music.volume);
  renderHandouts();
  renderPublicStatus();
  renderMusicUI();
  setDiceCount(1);
  setDiceVisibility("private");
  refreshCustomHandouts();
  refreshCustomTracks();
})();
