// Sistema: diagnostics. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.formatPerfResults = function formatPerfResults(results) {
    let text = "DIAGNÓSTICO FPS (sem otimizar)\n";
    text += "Cada etapa ~2s no hub\n\n";
    results.forEach(function (row) {
      text +=
        row.label +
        "\n  avg " +
        row.avg.toFixed(1) +
        " | min " +
        row.min.toFixed(1) +
        " | max " +
        row.max.toFixed(1) +
        " | meshes " +
        row.meshes +
        "\n\n";
    });
    if (results.length >= 2) {
      const base = results[0].avg;
      text += "Comparação com o baseline:\n";
      results.slice(1).forEach(function (row) {
        const delta = row.avg - base;
        const sign = delta >= 0 ? "+" : "";
        text +=
          "  " +
          row.label +
          " → " +
          sign +
          delta.toFixed(1) +
          " FPS\n";
      });
    }
    return text;
  };

  app.runFpsDiagnostic = async function runFpsDiagnostic() {
    if (!app.debugEnabled || !app.perfSceneApi || app.perfTestRunning) return;
    app.perfTestRunning = true;
    app.debugPerfBtn.disabled = true;
    app.btnStartRace.disabled = true;
    app.debugPerfReport.classList.add("show");
    app.debugPerfReport.textContent =
      "Iniciando diagnóstico...\nOlhe o console (F12) também.";

    try {
      const results = await app.perfSceneApi.runDiagnostic(function (msg) {
        if (typeof msg === "string") {
          app.debugPerfReport.textContent = msg;
        } else {
          app.debugPerfReport.textContent = app.formatPerfResults(msg);
        }
      });
      const finalText = app.formatPerfResults(results);
      app.debugPerfReport.textContent =
        finalText + "\nConcluído. Nada foi otimizado — só medição.";
      console.log("[FPS TEST] Relatório final\n" + finalText);
    } catch (err) {
      console.error("[FPS TEST] Erro", err);
      app.debugPerfReport.textContent =
        "Erro no diagnóstico. Veja o console.\n" + String(err);
    } finally {
      app.perfTestRunning = false;
      app.debugPerfBtn.disabled = false;
      app.btnStartRace.disabled = false;
    }
  };

  app.downloadTextFile = function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  app.botBenchRowsToCsv = function botBenchRowsToCsv(rows) {
    const headers = [
      "trackId",
      "trackName",
      "run",
      "botId",
      "botName",
      "carId",
      "place",
      "finishTime",
      "avgSpeed",
      "wallHits",
      "scrapeTime",
      "stuckTime",
      "distTraveled",
    ];
    const lines = [headers.join(",")];
    rows.forEach(function (row) {
      lines.push(
        headers
          .map(function (key) {
            const val = row[key];
            if (typeof val === "number") {
              return Number.isInteger(val) ? String(val) : val.toFixed(3);
            }
            return '"' + String(val).replace(/"/g, '""') + '"';
          })
          .join(",")
      );
    });
    return lines.join("\n");
  };

  app.formatBotBenchSummary = function formatBotBenchSummary(rows) {
    let text = "TESTE BOTS — 4× por pista (carro starter, sim ×5)\n\n";
    const byKey = {};
    rows.forEach(function (row) {
      const key = row.trackId + "|" + row.botName;
      if (!byKey[key]) {
        byKey[key] = {
          trackName: row.trackName,
          botName: row.botName,
          times: [],
          places: [],
          wallHits: [],
          scrape: [],
          stuck: [],
        };
      }
      byKey[key].times.push(row.finishTime);
      byKey[key].places.push(row.place);
      byKey[key].wallHits.push(row.wallHits);
      byKey[key].scrape.push(row.scrapeTime);
      byKey[key].stuck.push(row.stuckTime);
    });

    function avg(arr) {
      if (!arr.length) return 0;
      return (
        arr.reduce(function (a, b) {
          return a + b;
        }, 0) / arr.length
      );
    }

    const keys = Object.keys(byKey).sort();
    let currentTrack = "";
    keys.forEach(function (key) {
      const g = byKey[key];
      if (g.trackName !== currentTrack) {
        currentTrack = g.trackName;
        text += "— " + currentTrack + " —\n";
      }
      text +=
        "  " +
        g.botName +
        ": tempo " +
        avg(g.times).toFixed(1) +
        "s | lugar " +
        avg(g.places).toFixed(2) +
        " | paredes " +
        avg(g.wallHits).toFixed(1) +
        " | raspa " +
        avg(g.scrape).toFixed(1) +
        "s | stuck " +
        avg(g.stuck).toFixed(1) +
        "s\n";
    });
    text += "\nCSV baixado. Use para fine-tuning (lookAhead, curveCaution, mistakes...).";
    return text;
  };

  app.runBotBenchmark = async function runBotBenchmark() {
    if (!app.debugEnabled || !app.botBenchApi || app.perfTestRunning) return;
    app.perfTestRunning = true;
    app.botBench.active = true;
    app.botBench.rows = [];
    if (app.debugPerfBtn) app.debugPerfBtn.disabled = true;
    if (app.debugBotBenchBtn) app.debugBotBenchBtn.disabled = true;
    app.btnStartRace.disabled = true;
    app.debugPerfReport.classList.add("show");
    app.debugPerfReport.textContent = "Iniciando teste de bots...\n";

    const savedTrack = app.botBenchApi.getActiveTrackId();
    const trackIds = Object.keys(window.NEON_RUSH_TRACKS || {});

    try {
      for (let t = 0; t < trackIds.length; t++) {
        const trackId = trackIds[t];
        app.botBench.trackId = trackId;
        app.botBenchApi.switchTrack(trackId);
        await new Promise(function (r) {
          setTimeout(r, 200);
        });

        for (let run = 1; run <= app.botBench.runsPerTrack; run++) {
          app.botBench.runIndex = run;
          app.debugPerfReport.textContent =
            "Bench: " +
            trackId +
            " · corrida " +
            run +
            "/" +
            app.botBench.runsPerTrack +
            "\n(aguarde — simulação acelerada ×" +
            app.botBench.simSpeed +
            ")";

          await new Promise(function (resolve) {
            app.botBench.resolveRace = resolve;
            app.botBenchApi.beginRace();
          });

          await new Promise(function (r) {
            setTimeout(r, 80);
          });
        }
      }

      const csv = app.botBenchRowsToCsv(app.botBench.rows);
      app.downloadTextFile(
        "neon-rush-bot-bench-" + Date.now() + ".csv",
        csv
      );
      const summary = app.formatBotBenchSummary(app.botBench.rows);
      app.debugPerfReport.textContent = summary;
      console.log("[BOT BENCH]\n" + summary);
      console.log("[BOT BENCH] CSV rows", app.botBench.rows);
    } catch (err) {
      console.error("[BOT BENCH] Erro", err);
      app.debugPerfReport.textContent =
        "Erro no teste de bots.\n" + String(err);
    } finally {
      app.botBench.active = false;
      app.botBench.resolveRace = null;
      if (savedTrack) app.botBenchApi.switchTrack(savedTrack);
      app.botBenchApi.restoreHub();
      app.perfTestRunning = false;
      if (app.debugPerfBtn) app.debugPerfBtn.disabled = false;
      if (app.debugBotBenchBtn) app.debugBotBenchBtn.disabled = false;
      app.btnStartRace.disabled = false;
    }
  };
}

export function installScene(app, world) {
  world.setNodesEnabled = function setNodesEnabled(nodes, enabled) {
    nodes.forEach(function (node) {
      node.setEnabled(enabled);
    });
  };

  world.setHalfBuildingsEnabled = function setHalfBuildingsEnabled() {
    world.buildingGroups.forEach(function (group, index) {
      group.setEnabled(index % 2 === 0);
    });
  };

  world.restorePerfScene = function restorePerfScene() {
    world.setNodesEnabled(world.roadPieces, true);
    world.setNodesEnabled(world.buildingGroups, true);
    world.setNodesEnabled(world.tunnelRings, true);
    world.setNodesEnabled(world.beachProps, true);
    if (world.finishGate) world.finishGate.setEnabled(true);
    world.player.mesh.setEnabled(true);
    world.rivals.forEach(function (rival) {
      rival.mesh.setEnabled(false);
    });
    world.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    world.scene.fogDensity = 0.006;
  };

  world.countActiveMeshes = function countActiveMeshes() {
    return world.scene.meshes.filter(function (mesh) {
      return mesh.isEnabled() && mesh.isVisible;
    }).length;
  };

  world.waitMs = function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  };

  world.sampleFpsAverage = async function sampleFpsAverage(durationMs) {
    const samples = [];
    const endAt = performance.now() + durationMs;
    while (performance.now() < endAt) {
      samples.push(app.engine.getFps());
      await world.waitMs(50);
    }
    const sum = samples.reduce(function (a, b) {
      return a + b;
    }, 0);
    return {
      avg: sum / samples.length,
      min: Math.min.apply(null, samples),
      max: Math.max.apply(null, samples),
      samples: samples.length,
    };
  };

  world.beginBotBenchRace = function beginBotBenchRace() {
    world.resetPostRaceView();
    world.closeGarage({ restoreCar: false });
    world.closeShop({ restoreCar: false });
    GameAudio.stopEngines();
    world.assignBotCarsForRace();
    world.syncActiveRacers();
    // Só bots — jogador fora da disputa
    world.racers = world.getActiveRivals().slice();
    world.player.mesh.setEnabled(false);
    world.rivals.forEach(function (rival) {
      rival.mesh.setEnabled(world.racers.indexOf(rival) !== -1);
      rival.maxSpeed = app.PHYSICS.maxSpeed;
    });

    world.inMenu = false;
    world.raceTime = 0;
    world.raceOver = false;
    world.countdownActive = false;
    world.goDisplayTimer = 0;
    app.countdownOverlay.classList.remove("show");
    app.mainMenu.classList.remove("show");
    app.hud.classList.add("show");
    app.setCanvasInteractive(false);
    world.finishOrder.length = 0;
    app.rankingPanel.classList.remove("show", "centered", "racing");
    app.rankingHint.classList.remove("show");
    app.rankingList.innerHTML = "";

    world.placeGrid();
    if (world.racers.length) {
      world.camera.lockedTarget = world.racers[0].mesh;
      world.unlockCameraFollow();
      world.camera.lockedTarget = world.racers[0].mesh;
      world.scene.activeCamera = world.camera;
      world.setRivalVisibility(true);
      world.player.mesh.setEnabled(false);
    }
    app.setProgressHud(
      (app.botBench.runIndex - 1) / Math.max(1, app.botBench.runsPerTrack),
      app.botBench.runIndex + "/" + app.botBench.runsPerTrack,
      "Bench " + (app.botBench.trackId || "")
    );
    app.placeLabel.textContent = "Bots: " + world.racers.length;
    app.setSpeedHud(0, app.PHYSICS.maxSpeed);
    app.speedLabel.textContent = "×" + app.botBench.simSpeed;
  };
}

export function initializeDiagnostics(app) {
  app.debugEnabled = new URLSearchParams(window.location.search).get("debug") === "true";
  app.debugBotBenchBtn = document.getElementById("debugBotBenchBtn");
  if (app.debugEnabled) {
    app.debugFps.classList.add("show");
    app.debugPerfBtn.classList.add("show");
    if (app.debugBotBenchBtn) app.debugBotBenchBtn.classList.add("show");
  }
  app.debugFpsFrame = 0;
  app.perfTestRunning = false;
  app.perfSceneApi = null;
  app.botBenchApi = null;
  app.botBench = {
    active: false,
    simSpeed: 5,
    runsPerTrack: 4,
    resolveRace: null,
    trackId: null,
    runIndex: 0,
    rows: [],
  };
}

export function bindDiagnosticsControls(app) {
  if (app.debugEnabled) {
    app.debugPerfBtn.addEventListener("click", function () {
      app.runFpsDiagnostic();
    });
    if (app.debugBotBenchBtn) {
      app.debugBotBenchBtn.addEventListener("click", function () {
        app.runBotBenchmark();
      });
    }
  }
}

export function initializePerformanceDiagnostics(app, world) {
  app.perfSceneApi = {
    runDiagnostic: async function (onProgress) {
      const results = [];
      const sampleMs = 2000;

      async function measure(label, setupFn) {
        world.restorePerfScene();
        setupFn();
        await world.waitMs(400);
        if (onProgress) {
          onProgress("Medindo: " + label + " ...");
        }
        const stats = await world.sampleFpsAverage(sampleMs);
        const row = {
          label: label,
          avg: stats.avg,
          min: stats.min,
          max: stats.max,
          meshes: world.countActiveMeshes(),
        };
        results.push(row);
        console.log(
          "[FPS TEST]",
          label,
          "| avg",
          stats.avg.toFixed(1),
          "| min",
          stats.min.toFixed(1),
          "| max",
          stats.max.toFixed(1),
          "| meshes",
          row.meshes
        );
        if (onProgress) {
          onProgress(results.slice());
        }
      }

      await measure("1) Baseline (hub como está)", function () {});
      await measure("2) Sem prédios", function () {
        world.setNodesEnabled(world.buildingGroups, false);
      });
      await measure("3) Metade dos prédios", function () {
        world.setHalfBuildingsEnabled();
      });
      await measure("4) Sem pedaços da pista", function () {
        world.setNodesEnabled(world.roadPieces, false);
      });
      await measure("5) Sem linha de chegada", function () {
        if (world.finishGate) world.finishGate.setEnabled(false);
      });
      await measure("6) Sem neblina (fog)", function () {
        world.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
      });
      await measure("7) Sem carro do jogador", function () {
        world.player.mesh.setEnabled(false);
      });
      await measure("8) Quase vazio (só céu)", function () {
        world.setNodesEnabled(world.roadPieces, false);
        world.setNodesEnabled(world.buildingGroups, false);
        world.setNodesEnabled(world.tunnelRings, false);
        world.setNodesEnabled(world.beachProps, false);
        if (world.finishGate) world.finishGate.setEnabled(false);
        world.player.mesh.setEnabled(false);
        world.scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
      });

      world.restorePerfScene();
      return results;
    },
  };
}

export function initializeBotBenchmark(app, world) {
  app.botBenchApi = {
    beginRace: world.beginBotBenchRace,
    switchTrack: function (trackId) {
      window.NEON_RUSH_ACTIVE_TRACK = trackId;
      return app.switchTrackInScene(trackId, { force: true });
    },
    getActiveTrackId: function () {
      return window.NEON_RUSH_ACTIVE_TRACK;
    },
    restoreHub: function () {
      world.racers = [world.player].concat(world.getActiveRivals());
      world.player.mesh.setEnabled(true);
      world.rivals.forEach(function (rival) {
        rival.mesh.setEnabled(false);
      });
      world.unlockCameraFollow();
      world.showMainMenu();
    },
  };
}
