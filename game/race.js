// Sistema: race. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.placeRacer = function placeRacer(racer, distance, lateral) {
    const sample = app.samplePath(world.path3D, Math.max(0, distance));
    const pos = sample.position.add(sample.binormal.scale(lateral));
    racer.mesh.position.copyFrom(pos);
    racer.mesh.rotation.y = app.yawFromTangent(sample.tangent);
    racer.mesh.rotation.x = app.pitchFromTangent(sample.tangent);
    racer.mesh.rotation.z = 0;
    racer.speed = 0;
    racer.distAlong = app.distanceAlongPath(world.path3D, racer.mesh.position);
    racer.lapsCompleted = 0;
    racer.lapBacktracks = 0;
    racer.closedPathDistance = world.track.closedPath3D
      ? app.distanceAlongPath(world.track.closedPath3D, racer.mesh.position)
      : null;
    if (racer.closedPathDistance != null) {
      racer.distAlong = world.track.startDist + Math.min(racer.closedPathDistance, world.track.lapLength);
    }
    racer.lapArmed = false;
    racer.pathHint = racer.distAlong;
    racer.progress =
      world.track.totalLaps > 1
        ? app.raceProgressFromLaps(racer, world.track)
        : app.raceProgressFromDistance(racer.distAlong, world.track);
    racer.finished = false;
    racer.finishTime = null;
    racer.finishTimeEstimated = false;
    racer.againstWall = false;
    racer.wallHitCooldown = 0;
    racer.collisionBlinkT = 0;
    world.setRacerCollisionFlash(racer, false);
    if (racer.mesh) racer.mesh.setEnabled(true);
    racer.bench = {
      wallHits: 0,
      scrapeTime: 0,
      stuckTime: 0,
      distTraveled: 0,
    };
    // Ainda "antes" da linha de chegada
    racer.prevFinishSide = -1;
  };

  world.wrapRacerToLapStart = function wrapRacerToLapStart(racer) {
    const sampleNow = app.samplePath(
      world.path3D,
      racer.pathHint != null ? racer.pathHint : racer.distAlong
    );
    const lateral = BABYLON.Vector3.Dot(
      racer.mesh.position.subtract(sampleNow.position),
      sampleNow.binormal
    );
    const sample = app.samplePath(world.path3D, world.track.startDist + 3);
    racer.mesh.position.copyFrom(
      sample.position.add(sample.binormal.scale(lateral))
    );
    racer.mesh.rotation.y = app.yawFromTangent(sample.tangent);
    racer.mesh.rotation.x = app.pitchFromTangent(sample.tangent);
    racer.distAlong = world.track.startDist + 3;
    racer.pathHint = world.track.startDist + 3;
    if (world.track.closedPath3D) {
      racer.closedPathDistance = app.distanceAlongPath(world.track.closedPath3D, racer.mesh.position);
    }
    racer.lapArmed = false;
    racer.prevFinishSide = 1;
  };

  world.placeGrid = function placeGrid() {
    world.placeRacer(world.player, world.track.startDist, 0);
    world.getActiveRivals().forEach(function (rival) {
      world.placeRacer(rival, world.track.startDist, rival.preferredLane || 0);
    });
  };

  world.showMainMenu = function showMainMenu() {
    world.resetPostRaceView();
    world.inMenu = true;
    world.raceOver = false;
    world.countdownActive = false;
    world.goDisplayTimer = 0;
    GameAudio.stopEngines();
    world.player.maxSpeed = app.PHYSICS.maxSpeed;
    world.finishOrder.length = 0;
    app.rankingPanel.classList.remove("show", "centered", "racing");
    app.rankingHint.classList.remove("show");
    app.rankingList.innerHTML = "";
    app.countdownOverlay.classList.remove("show");
    app.hud.classList.remove("show");
    app.mainMenu.classList.add("show");
    app.setCanvasInteractive(false);
    app.setProgressHud(0, "0%", "Progresso");
    app.placeLabel.textContent = "Posição: 1º / " + world.getFieldSize();
    app.setSpeedHud(0, app.PHYSICS.maxSpeed);
    app.refreshAccountStats();
    world.enterMenuCamera();
    if (typeof world.closeMissions === "function") world.closeMissions();
    if (typeof world.closeAccount === "function") world.closeAccount();
    world.syncMobileControlsVisibility();
    if (typeof app.playPendingRewardCelebrations === "function") {
      requestAnimationFrame(function () {
        app.playPendingRewardCelebrations();
      });
    } else if (typeof app.refreshMoneyLabel === "function") {
      app.refreshMoneyLabel();
    }
  };

  world.startCountdown = function startCountdown() {
    world.countdownActive = true;
    world.countdownTimer = 0;
    world.countdownStep = 0;
    world.goDisplayTimer = 0;
    app.countdownNumber.textContent = world.countdownLabels[0];
    app.countdownOverlay.classList.add("show");
    GameAudio.unlock();
    GameAudio.playCountdownBeep(false);
  };

  world.startRaceFromMenu = function startRaceFromMenu() {
    if (world.multiplayer?.open || world.multiplayer?.racing) return;
    if (typeof world.closeMissions === "function") world.closeMissions();
    const ticketCost =
      typeof app.getTrackTicketCost === "function"
        ? app.getTrackTicketCost()
        : 0;
    if (ticketCost > 0) {
      if (!app.hasOvalTickets(ticketCost)) {
        window.alert(
          "Neon Oval precisa de ticket!\nCompre um Ticket Oval na Loja."
        );
        if (typeof app.refreshPlayButton === "function") {
          app.refreshPlayButton();
        }
        return;
      }
      if (!app.consumeOvalTickets(ticketCost)) {
        window.alert("Não foi possível usar o ticket. Tente de novo.");
        return;
      }
      app.refreshMoneyLabel();
      if (typeof app.refreshTrackLabel === "function") {
        app.refreshTrackLabel();
      }
    }

    world.resetPostRaceView();
    world.closeGarage();
    world.closeShop();
    // Garante que a corrida usa o carro equipado (não o preview bloqueado)
    if (world.player.carModelId !== world.equippedCarId) {
      world.rebuildPlayerCar(world.equippedCarId, { saveEquip: true });
    }
    // Nova e Echo escolhem carro do catálogo (comuns mais comuns)
    world.assignBotCarsForRace();

    // Pneu calibrado: só o jogador, só nesta corrida (bônus relativo)
    if (app.hasPendingCalibratedTire()) {
      world.player.maxSpeed = app.PHYSICS.maxSpeed * app.CALIBRATED_TIRE_SPEED_MULT;
      app.consumeCalibratedTire();
      app.refreshMoneyLabel();
    } else {
      world.player.maxSpeed = app.PHYSICS.maxSpeed;
    }
    world.getActiveRivals().forEach(function (rival) {
      rival.maxSpeed = app.PHYSICS.maxSpeed;
    });

    world.inMenu = false;
    world.raceTime = 0;
    world.raceOver = false;
    app.mainMenu.classList.remove("show");
    app.hud.classList.add("show");
    app.setCanvasInteractive(true);
    world.placeGrid();
    world.enterRaceCamera();
    world.finishOrder.length = 0;
    app.rankingPanel.classList.remove("show", "centered", "racing");
    app.rankingHint.classList.remove("show");
    app.rankingList.innerHTML = "";
    app.setProgressHud(0, "0%", "Progresso");
    app.placeLabel.textContent = "Posição: 1º / " + world.getFieldSize();
    app.setSpeedHud(0, app.getRacerMaxSpeed(world.player));
    world.startCountdown();
    world.syncMobileControlsVisibility();
  };
}

export function bindRaceControls(app, world) {
  app.btnStartRace.addEventListener("click", function () {
    world.startRaceFromMenu();
  });
  app.btnFinishRace.addEventListener("click", world.concludeRaceWithEstimates);
  document
    .getElementById("btnGarage")
    .addEventListener("click", function () {
      world.openGarage();
    });
  document
    .getElementById("btnGaragePrev")
    .addEventListener("click", function () {
      world.stepGarage(-1);
    });
  document
    .getElementById("btnGarageNext")
    .addEventListener("click", function () {
      world.stepGarage(1);
    });
  document
    .getElementById("btnGarageEquip")
    .addEventListener("click", function () {
      world.equipGarageCar();
    });
  document
    .getElementById("btnShop")
    .addEventListener("click", function () {
      world.openShop();
    });
  document
    .getElementById("btnShopPrev")
    .addEventListener("click", function () {
      world.stepShop(-1);
    });
  document
    .getElementById("btnShopNext")
    .addEventListener("click", function () {
      world.stepShop(1);
    });
  document
    .getElementById("btnShopBuy")
    .addEventListener("click", function () {
      world.buyShopOffer();
    });
  window.addEventListener("keydown", (e) => {
    if (world.multiplayer?.open || world.multiplayer?.racing) return;
    if (
      !app.botBench.active &&
      (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")
    ) {
      if (world.raceOver || world.canConcludeRace()) {
        e.preventDefault();
        if (e.repeat) return;
        if (world.raceOver) world.showMainMenu();
        else world.concludeRaceWithEstimates();
        return;
      }
    }
    if (!world.inMenu) return;
    if (world.shopOpen) {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        world.stepShop(-1);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        world.stepShop(1);
      } else if (e.code === "Enter" || e.code === "KeyE") {
        e.preventDefault();
        world.buyShopOffer();
      } else if (e.code === "Escape") {
        e.preventDefault();
        world.closeShop();
      }
      return;
    }
    if (world.missionsOpen) {
      if (e.code === "Escape") {
        e.preventDefault();
        world.closeMissions();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        app.stepMissionsCarousel(-1);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        app.stepMissionsCarousel(1);
      }
      return;
    }
    if (world.accountOpen) {
      if (e.code === "Escape") {
        e.preventDefault();
        world.closeAccount();
      }
      return;
    }
    if (!world.garageOpen) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      world.stepGarage(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      world.stepGarage(1);
    } else if (e.code === "Enter" || e.code === "KeyE") {
      e.preventDefault();
      world.equipGarageCar();
    } else if (e.code === "Escape") {
      e.preventDefault();
      world.closeGarage();
    }
  });
  world.syncActiveRacers();
  world.showMainMenu();
}
