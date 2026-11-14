// Sistema: loop. Dependências compartilhadas recebidas explicitamente.

export function startRenderLoop(app) {
  app.engine.runRenderLoop(function () {
    app.scene.render();
    if (app.debugEnabled) {
      app.debugFpsFrame += 1;
      // Atualiza o DOM de tempos em tempos para não pesar o FPS
      if (app.debugFpsFrame % 15 === 0) {
        app.debugFps.textContent = Math.round(app.engine.getFps()) + " FPS";
      }
    }
  });
  window.addEventListener("resize", function () {
    app.engine.resize();
  });
}

export function startRaceLoop(app, world) {
  world.scene.onBeforeRenderObservable.add(() => {
    const dt = app.engine.getDeltaTime() / 1000;
    world.handleVirtualMenuActions();

    // Hub: carro/item no centro girando + câmera orbitando
    if (world.inMenu) {
      GameAudio.stopEngines();
      if (!app.perfTestRunning) {
        const spinMesh = world.shopItemPreview || world.player.mesh;
        spinMesh.rotation.y += dt * 0.55;
        world.menuCamera.alpha += dt * 0.22;
      }
      return;
    }

    // Contagem: ninguém anda
    if (world.countdownActive) {
      world.countdownTimer += dt;
      if (world.countdownTimer >= 1) {
        world.countdownTimer = 0;
        world.countdownStep += 1;
        if (world.countdownStep >= world.countdownLabels.length) {
          world.countdownActive = false;
          app.countdownNumber.textContent = "VAI!";
          world.goDisplayTimer = 0.7;
          GameAudio.playCountdownBeep(true);
        } else {
          app.countdownNumber.textContent = world.countdownLabels[world.countdownStep];
          GameAudio.playCountdownBeep(false);
        }
      }
      return;
    }

    if (world.goDisplayTimer > 0) {
      world.goDisplayTimer -= dt;
      if (world.goDisplayTimer <= 0) {
        app.countdownOverlay.classList.remove("show");
      }
    }

    const simDt = app.botBench.active ? dt * app.botBench.simSpeed : dt;

    if (!world.raceOver) {
      world.raceTime += simDt;
    }

    if (app.botBench.active) {
      world.racers.forEach(function (rival) {
        if (!rival.finished) {
          world.applyDrive(rival, world.getAIInput(rival, simDt), simDt);
        } else {
          world.applyDrive(
            rival,
            { up: false, down: false, left: false, right: false },
            simDt
          );
        }
      });
      world.forceFinishStragglers();
      // Failsafe: corrida travada demais
      if (!world.raceOver && world.raceTime > 240) {
        world.racers.forEach(function (rival) {
          if (!rival.finished) {
            world.markRacerFinished(rival, world.raceTime);
          }
        });
      }
      if (world.racers[0] && !world.raceOver) {
        world.camera.lockedTarget = world.racers[0].mesh;
      }
      return;
    }

    // Depois da chegada o jogador só desacelera (ainda pode virar)
    const playerInput = app.mergeDriveInput(
      world.player.finished
        ? { up: false, down: false, left: app.keys.left, right: app.keys.right }
        : app.keys
    );

    world.applyDrive(world.player, playerInput, dt);
    world.getActiveRivals().forEach(function (rival) {
      world.applyDrive(rival, world.getAIInput(rival, dt), dt);
    });
    world.updatePostRaceView();

    GameAudio.setEngineSpeed(
      "player",
      world.player.speed,
      app.getRacerMaxSpeed(world.player)
    );
    world.getActiveRivals().forEach(function (rival) {
      GameAudio.setEngineSpeed(
        rival.id,
        rival.speed,
        app.getRacerMaxSpeed(rival),
        BABYLON.Vector3.Distance(
          (world.spectatorTarget || world.player).mesh.position,
          rival.mesh.position
        )
      );
    });

    const place = world.getPlayerPlace();
    app.placeLabel.textContent =
      world.spectatorTarget
        ? "Assistindo: " + world.spectatorTarget.name
        : "Posição: " + world.placeText(place) + " / " + world.getFieldSize();
    const hudRacer = world.spectatorTarget || world.player;
    app.setSpeedHud(hudRacer.speed, app.getRacerMaxSpeed(hudRacer));

    if (!hudRacer.finished) {
      const progressRatio = Math.max(0, Math.min(1, hudRacer.progress || 0));
      const stepped = app.snapProgressRatio(progressRatio);
      const shown = Math.min(90, Math.round(stepped * 100));
      if (world.track.totalLaps > 1) {
        const lapShow = Math.min(
          world.track.totalLaps,
          hudRacer.lapsCompleted + 1
        );
        app.setProgressHud(
          stepped,
          shown + "%",
          "Volta " + lapShow + "/" + world.track.totalLaps
        );
      } else {
        app.setProgressHud(stepped, shown + "%", "Progresso");
      }
    } else if (!world.raceOver) {
      app.setProgressHud(1, "100%", "Chegou!");
    }
  });
}
