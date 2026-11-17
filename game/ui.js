// Sistema: ui. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.setMeterFill = function setMeterFill(el, ratio) {
    if (!el) return;
    const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
    el.style.width = pct.toFixed(1) + "%";
  };

  app.setSpeedHud = function setSpeedHud(speed, maxSpeed) {
    const abs = Math.abs(speed || 0);
    const cap = Math.max(1, maxSpeed || 1);
    app.speedLabel.textContent = String(Math.round(abs));
    app.setMeterFill(app.speedFill, abs / cap);
    if (app.speedFill) {
      app.speedFill.classList.toggle("flash", abs / cap > 0.92);
    }
  };

  app.snapProgressRatio = function snapProgressRatio(ratio) {
    const clamped = Math.max(0, Math.min(1, ratio || 0));
    // Visual em degraus de 10% para não distrair
    return Math.floor(clamped * 10 + 1e-6) / 10;
  };

  app.setProgressHud = function setProgressHud(ratio, label, title) {
    if (title && app.progressTitle) app.progressTitle.textContent = title;
    app.progressLabel.textContent = label;
    app.setMeterFill(app.progressFill, app.snapProgressRatio(ratio));
  };
}

export function initializeInterface(app) {
  app.canvas = document.getElementById("renderCanvas");
  app.speedLabel = document.getElementById("speedLabel");
  app.progressLabel = document.getElementById("progressLabel");
  app.progressTitle = document.getElementById("progressTitle");
  app.speedFill = document.getElementById("speedFill");
  app.progressFill = document.getElementById("progressFill");
  app.placeLabel = document.getElementById("placeLabel");
  app.mainMenu = document.getElementById("mainMenu");
  app.btnStartRace = document.getElementById("btnStartRace");
  app.hud = document.getElementById("hud");
  app.rankingPanel = document.getElementById("rankingPanel");
  app.rankingList = document.getElementById("rankingList");
  app.rankingHint = document.getElementById("rankingHint");
  app.postRaceControls = document.getElementById("postRaceControls");
  app.spectatorLabel = document.getElementById("spectatorLabel");
  app.btnFinishRace = document.getElementById("btnFinishRace");
  app.rankingEstimateNote = document.getElementById("rankingEstimateNote");
  app.countdownOverlay = document.getElementById("countdownOverlay");
  app.countdownNumber = document.getElementById("countdownNumber");
  app.moneyLabel = document.getElementById("moneyLabel");
  app.fichaLabel = document.getElementById("fichaLabel");
  app.debugFps = document.getElementById("debugFps");
  app.debugPerfBtn = document.getElementById("debugPerfBtn");
  app.debugPerfReport = document.getElementById("debugPerfReport");
  app.engine = new BABYLON.Engine(app.canvas, true);
}
