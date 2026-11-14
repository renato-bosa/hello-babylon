// Sistema: track-selection. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.getTrackIds = function getTrackIds() {
    return Object.keys(window.NEON_RUSH_TRACKS || {});
  };

  app.applySavedTrack = function applySavedTrack() {
    const saved = localStorage.getItem(app.TRACK_STORAGE_KEY);
    if (saved && window.NEON_RUSH_TRACKS && window.NEON_RUSH_TRACKS[saved]) {
      window.NEON_RUSH_ACTIVE_TRACK = saved;
    } else if (!window.NEON_RUSH_ACTIVE_TRACK) {
      const ids = app.getTrackIds();
      window.NEON_RUSH_ACTIVE_TRACK = ids[0] || "neon-circuit-1";
    }
    localStorage.setItem(
      app.TRACK_STORAGE_KEY,
      window.NEON_RUSH_ACTIVE_TRACK
    );
  };

  app.refreshTrackLabel = function refreshTrackLabel() {
    const label = document.getElementById("trackNameLabel");
    if (!label) return;
    const ids = app.getTrackIds();
    const id = window.NEON_RUSH_ACTIVE_TRACK;
    const data =
      window.NEON_RUSH_TRACKS && window.NEON_RUSH_TRACKS[id];
    const name = data ? data.name : id || "—";
    const idx = Math.max(0, ids.indexOf(id));
    label.textContent =
      ids.length > 1
        ? name + "  (" + (idx + 1) + "/" + ids.length + ")"
        : name;
  };

  app.stepActiveTrack = function stepActiveTrack(delta) {
    const ids = app.getTrackIds();
    if (ids.length < 2) {
      window.alert(
        "Só existe 1 pista carregada. Confira se o arquivo tracks/sunset-rush.js abriu no navegador."
      );
      return;
    }
    const current = window.NEON_RUSH_ACTIVE_TRACK;
    let idx = ids.indexOf(current);
    if (idx < 0) idx = 0;
    idx = (idx + delta + ids.length) % ids.length;
    const nextId = ids[idx];
    localStorage.setItem(app.TRACK_STORAGE_KEY, nextId);
    window.NEON_RUSH_ACTIVE_TRACK = nextId;

    if (typeof app.switchTrackInScene === "function") {
      const ok = app.switchTrackInScene(nextId);
      if (ok) {
        app.refreshTrackLabel();
        return;
      }
    }

    // Fallback se a cena ainda não estiver pronta
    try {
      window.location.reload();
    } catch (err) {
      app.refreshTrackLabel();
    }
  };

  app.setCanvasInteractive = function setCanvasInteractive(enabled) {
    app.canvas.classList.toggle("racing", !!enabled);
  };
}

export function initializeTrackSelection(app) {
  app.TRACK_STORAGE_KEY = "neonRush.activeTrack";
  app.switchTrackInScene = null;
  app.applySavedTrack();
  app.refreshTrackLabel();
  app.setCanvasInteractive(false);
  document
    .getElementById("btnTrackSwitch")
    .addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      app.stepActiveTrack(1);
    });
}
