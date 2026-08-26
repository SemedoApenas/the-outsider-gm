(function () {
  const sync = window.OutsiderPublicSync;
  const publicStatus = document.getElementById("public-status");
  const statusCopy = document.getElementById("screen-status-copy");
  const currentHandout = document.getElementById("current-handout");
  const overviewScreenStatus = document.getElementById("overview-screen-status");
  const handoutGrid = document.getElementById("handout-grid");
  const nowPlaying = document.getElementById("now-playing");
  const overviewMusic = document.getElementById("overview-music");
  const musicMessage = document.getElementById("music-message");
  const trackList = document.getElementById("track-list");
  const volumeSlider = document.getElementById("volume-slider");
  const diceResults = Array.from(document.querySelectorAll(".die-result"));
  const diceTotal = document.getElementById("dice-total");
  const rollButton = document.getElementById("roll-button");
  const rollHistory = document.getElementById("roll-history");
  const lastRoll = document.getElementById("last-roll");

  const audio = new Audio();
  audio.preload = "metadata";
  audio.volume = Number(volumeSlider.value);
  let publicState = sync.getState();
  let selectedHandoutId = publicState.handout ? publicState.handout.id : null;
  let trackIndex = 0;
  let diceCount = 1;
  let isRolling = false;
  const history = [];

  function handoutById(id) {
    return handouts.find((handout) => handout.id === id) || null;
  }

  function currentHandoutData() {
    return handoutById(selectedHandoutId) || (publicState.handout && handoutById(publicState.handout.id));
  }

  function publicHandoutPayload(handout) {
    return handout ? { id: handout.id, image: handout.image } : null;
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

  function publishPublicState(next) {
    publicState = sync.publish(next);
    renderPublicStatus();
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

  function renderHandouts() {
    handoutGrid.innerHTML = handouts.map((handout) => {
      const isSelected = handout.id === selectedHandoutId;
      const isVisible = publicState.mode === "showing" && publicState.handout && publicState.handout.id === handout.id;
      return `
        <article class="handout-card${isSelected ? " is-selected" : ""}${isVisible ? " is-visible" : ""}" data-handout-id="${handout.id}">
          <button class="handout-preview" type="button" data-prepare-handout="${handout.id}" aria-label="Prepare ${handout.name}">
            <img src="${handout.image}" alt="" loading="lazy">
            <span class="handout-image-fallback" aria-hidden="true">✦</span>
            ${isVisible ? '<span class="live-badge">LIVE</span>' : ""}
          </button>
          <div class="handout-card-body">
            <span class="category-tag">${handout.category}</span>
            <h3>${handout.name}</h3>
            <div class="handout-actions">
              <button class="button button-small button-primary" type="button" data-show-handout="${handout.id}">Show</button>
              <button class="button button-small button-dark" type="button" data-hide-handout="${handout.id}">Hide</button>
            </div>
          </div>
        </article>`;
    }).join("");

    handoutGrid.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => image.closest(".handout-preview").classList.add("image-unavailable"), { once: true });
    });
  }

  function renderTracks() {
    if (!tracks.length) {
      trackList.innerHTML = '<p class="empty-track-list">No music tracks configured.</p>';
      return;
    }
    trackList.innerHTML = tracks.map((track, index) => `
      <button type="button" class="track-row${index === trackIndex ? " is-selected" : ""}" data-track-index="${index}">
        <span class="track-number">${String(index + 1).padStart(2, "0")}</span><span>${track.name}</span>
      </button>`).join("");
  }

  function renderMusic() {
    const currentTrack = tracks[trackIndex];
    const label = currentTrack ? currentTrack.name : "No track selected";
    nowPlaying.textContent = label;
    overviewMusic.textContent = label;
    renderTracks();
  }

  function selectTrack(index) {
    if (!tracks.length) {
      musicMessage.textContent = "No music tracks configured in data.js.";
      return false;
    }
    trackIndex = (index + tracks.length) % tracks.length;
    const track = tracks[trackIndex];
    audio.src = track.file;
    audio.load();
    musicMessage.textContent = `Ready: ${track.name}.`;
    renderMusic();
    return true;
  }

  async function playMusic() {
    if (!tracks.length) {
      musicMessage.textContent = "No music tracks configured in data.js.";
      return;
    }
    if (!audio.src) selectTrack(trackIndex);
    try {
      await audio.play();
      musicMessage.textContent = `Playing ${tracks[trackIndex].name}.`;
    } catch (error) {
      musicMessage.textContent = "Audio file unavailable. Check its path in data.js.";
    }
  }

  function pauseMusic() {
    audio.pause();
    musicMessage.textContent = audio.src ? "Music paused." : "No music is playing.";
  }

  function stopMusic() {
    audio.pause();
    try { audio.currentTime = 0; } catch (error) { /* no source has been loaded yet */ }
    musicMessage.textContent = audio.src ? "Music stopped." : "No music is playing.";
  }

  function changeTrack(direction) {
    const shouldContinue = !audio.paused;
    if (selectTrack(trackIndex + direction) && shouldContinue) playMusic();
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
    const total = values.reduce((sum, value) => sum + value, 0);
    const label = `${diceCount}d6 → ${values.join(" + ")} = ${total}`;
    history.unshift(label);
    history.splice(6);
    rollHistory.innerHTML = history.map((item) => `<li>${item}</li>`).join("");
    diceTotal.textContent = `Total: ${total}`;
    lastRoll.textContent = label;
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
      appendHistory(values);
      rollButton.disabled = false;
      isRolling = false;
    }, 310);
  }

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
  volumeSlider.addEventListener("input", () => { audio.volume = Number(volumeSlider.value); });
  rollButton.addEventListener("click", () => rollDice());

  handoutGrid.addEventListener("click", (event) => {
    const show = event.target.closest("[data-show-handout]");
    const hide = event.target.closest("[data-hide-handout]");
    const prepare = event.target.closest("[data-prepare-handout]");
    if (show) showHandout(show.dataset.showHandout);
    else if (hide) {
      prepareHandout(hide.dataset.hideHandout);
      hidePublicScreen();
    } else if (prepare) prepareHandout(prepare.dataset.prepareHandout);
  });

  trackList.addEventListener("click", (event) => {
    const trackButton = event.target.closest("[data-track-index]");
    if (!trackButton) return;
    const wasPlaying = !audio.paused;
    if (selectTrack(Number(trackButton.dataset.trackIndex)) && wasPlaying) playMusic();
  });

  document.querySelectorAll(".dice-choice").forEach((button) => {
    button.addEventListener("click", () => setDiceCount(Number(button.dataset.diceCount)));
  });
  document.querySelectorAll("[data-quick-roll]").forEach((button) => {
    button.addEventListener("click", () => rollDice(Number(button.dataset.quickRoll)));
  });

  audio.addEventListener("error", () => {
    musicMessage.textContent = "Audio file unavailable. Check its path in data.js.";
  });
  audio.addEventListener("ended", () => {
    musicMessage.textContent = "Track finished.";
  });

  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.target.matches("input, textarea, select")) return;
    if (event.key === "Escape" || event.key.toLowerCase() === "h") {
      event.preventDefault();
      hidePublicScreen();
    } else if (event.key === " ") {
      event.preventDefault();
      if (audio.paused) playMusic(); else pauseMusic();
    } else if (["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      rollDice(Number(event.key));
    }
  });

  sync.subscribe((state) => {
    publicState = state;
    if (state.handout) selectedHandoutId = state.handout.id;
    renderPublicStatus();
  });

  renderHandouts();
  renderPublicStatus();
  renderMusic();
  setDiceCount(1);
})();
