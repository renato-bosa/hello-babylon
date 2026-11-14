// Sistema: post-race. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.resetPostRaceView = function resetPostRaceView() {
    world.spectatorTarget = null;
    app.postRaceControls.hidden = true;
    app.spectatorLabel.textContent = "";
    app.rankingEstimateNote.hidden = true;
    app.rankingPanel.classList.remove("spectating");
  };

  world.canConcludeRace = function canConcludeRace() {
    return (
      !world.inMenu &&
      !app.botBench.active &&
      !world.raceOver &&
      world.player.finished &&
      world.raceTime - world.player.finishTime >= world.POST_RACE_WAIT_SECONDS
    );
  };

  world.getPendingBots = function getPendingBots() {
    return world.racers
      .filter(function (racer) {
        return !racer.isPlayer && !racer.finished;
      })
      .sort(function (a, b) {
        // O progresso total inclui as voltas já completadas no oval.
        return b.progress - a.progress;
      });
  };

  world.updatePostRaceView = function updatePostRaceView() {
    if (!world.player.finished || app.botBench.active) return;
    if (world.raceOver) {
      world.lockCameraAtFinish(world.spectatorTarget || world.player);
      world.spectatorTarget = null;
      return;
    }
    if (!world.canConcludeRace()) {
      world.lockCameraAtFinish();
      return;
    }
    if (!world.spectatorTarget || world.spectatorTarget.finished) {
      world.spectatorTarget = world.getPendingBots()[0] || null;
      if (!world.spectatorTarget) return;
      world.unlockCameraFollow();
      world.camera.lockedTarget = world.spectatorTarget.mesh;
      app.spectatorLabel.textContent = "Assistindo: " + world.spectatorTarget.name;
    }
    app.postRaceControls.hidden = false;
    app.rankingPanel.classList.add("spectating");
  };

  world.estimateFinishTime = function estimateFinishTime(racer) {
    const progress = Math.max(0, Math.min(1, racer.progress || 0));
    // Mantém o ritmo médio observado: tempo total = tempo decorrido / progresso.
    // Sem progresso, usa o tempo do jogador como referência para o trecho restante.
    const estimate = progress > 0
      ? world.raceTime / progress
      : world.raceTime + world.player.finishTime;
    return Math.max(world.raceTime + 0.1, estimate);
  };

  world.concludeRaceWithEstimates = function concludeRaceWithEstimates() {
    if (!world.canConcludeRace()) return;
    let previousTime = world.raceTime;
    const estimates = world.getPendingBots().map(function (racer) {
      // Preserva a ordem por progresso, inclusive para bots ainda sem avanço.
      const time = Math.max(previousTime + 0.1, world.estimateFinishTime(racer));
      previousTime = time;
      return { racer: racer, time: time };
    });
    estimates.forEach(function (entry) {
      world.markRacerFinished(entry.racer, entry.time, true);
    });
  };
}

export function initializeRaceState(app, world) {
  world.raceTime = 0;
  world.raceOver = false;
  world.finishOrder = [];
  world.inMenu = true;
  world.countdownActive = false;
  world.countdownTimer = 0;
  world.countdownStep = 0;
  world.goDisplayTimer = 0;
  world.countdownLabels = ["3", "2", "1"];
  world.POST_RACE_WAIT_SECONDS = 5;
}
