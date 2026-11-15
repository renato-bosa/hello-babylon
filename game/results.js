// Sistema: results. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.markRacerFinished = function markRacerFinished(racer, finishTime, estimated = false) {
    if (racer.finished) return;
    racer.finished = true;
    racer.finishTime = finishTime;
    racer.finishTimeEstimated = estimated;
    racer.progress = 1;
    world.finishOrder.push(racer);
    if (!app.botBench.active && !estimated) {
      GameAudio.playFinish(racer.isPlayer);
    }
    world.updateRankingPanel();
  };

  world.forceFinishStragglers = function forceFinishStragglers() {
    if (!app.botBench.active || world.raceOver || world.finishOrder.length === 0) return;
    const firstFinish = world.finishOrder[0].finishTime;
    // Só o diagnóstico de bots encerra atrasados automaticamente após 14s.
    if (world.raceTime < firstFinish + 14) return;
    const pending = world.racers
      .filter(function (racer) {
        return !racer.isPlayer && !racer.finished;
      })
      .sort(function (a, b) {
        return b.distAlong - a.distAlong;
      });
    pending.forEach(function (racer, i) {
      world.markRacerFinished(racer, world.raceTime + (i + 1) * 0.05);
    });
  };

  world.getPlayerPlace = function getPlayerPlace() {
    let place = 1;
    for (const other of world.racers) {
      if (other === world.player) continue;
      if (other.finished && world.player.finished) {
        if (other.finishTime < world.player.finishTime) place += 1;
      } else if (other.finished && !world.player.finished) {
        place += 1;
      } else if (!other.finished && !world.player.finished) {
        if (other.progress > world.player.progress + 0.001) place += 1;
      }
    }
    return place;
  };

  world.allRacersFinished = function allRacersFinished() {
    return world.racers.every(function (racer) {
      return racer.finished;
    });
  };

  world.placeText = function placeText(place) {
    return place + "º";
  };

  world.updateRankingPanel = function updateRankingPanel() {
    app.rankingPanel.classList.add("show");
    if (!world.raceOver && !world.allRacersFinished()) {
      app.rankingPanel.classList.add("racing");
    }
    app.rankingList.innerHTML = "";

    world.finishOrder.forEach(function (racer, index) {
      const row = document.createElement("div");
      row.className = "ranking-row" + (racer.isPlayer ? " you" : "");
      row.innerHTML =
        '<span class="pos">' +
        world.placeText(index + 1) +
        "</span>" +
        "<span>" +
        racer.name +
        "</span>" +
        '<span class="time"' +
        (racer.finishTimeEstimated ? ' title="Tempo estimado">≈' : '>') +
        racer.finishTime.toFixed(1) +
        "s</span>";
      app.rankingList.appendChild(row);
    });

    world.racers.forEach(function (racer) {
      if (racer.finished) return;
      const row = document.createElement("div");
      row.className =
        "ranking-row pending" + (racer.isPlayer ? " you" : "");
      row.innerHTML =
        '<span class="pos">—</span>' +
        "<span>" +
        racer.name +
        "</span>" +
        '<span class="time">...</span>';
      app.rankingList.appendChild(row);
    });

    app.rankingEstimateNote.hidden = !world.finishOrder.some(function (racer) {
      return racer.finishTimeEstimated;
    });

    if (world.allRacersFinished() && !world.raceOver) {
      world.raceOver = true;
      app.postRaceControls.hidden = true;
      app.rankingPanel.classList.remove("racing", "spectating");

      if (app.botBench.active && app.botBench.resolveRace) {
        const rows = world.finishOrder.map(function (racer, index) {
          const bench = racer.bench || {
            wallHits: 0,
            scrapeTime: 0,
            stuckTime: 0,
            distTraveled: 0,
          };
          const finishTime = racer.finishTime || world.raceTime;
          return {
            trackId: app.botBench.trackId,
            trackName:
              (world.track.data && world.track.data.name) || app.botBench.trackId,
            run: app.botBench.runIndex,
            botId: racer.id,
            botName: racer.name,
            carId: racer.carModelId,
            place: index + 1,
            finishTime: finishTime,
            avgSpeed:
              finishTime > 0.1 ? bench.distTraveled / finishTime : 0,
            wallHits: bench.wallHits,
            scrapeTime: bench.scrapeTime,
            stuckTime: bench.stuckTime,
            distTraveled: bench.distTraveled,
          };
        });
        app.botBench.rows.push.apply(app.botBench.rows, rows);
        const resolve = app.botBench.resolveRace;
        app.botBench.resolveRace = null;
        setTimeout(function () {
          resolve(rows);
        }, 30);
        return;
      }

      const finalPlace = world.getPlayerPlace();
      const didWin = app.registerWinIfFirst(finalPlace);
      if (typeof app.recordMissionRaceResult === "function") {
        app.recordMissionRaceResult({
          place: finalPlace,
          trackId: window.NEON_RUSH_ACTIVE_TRACK,
          carId: world.player && world.player.carModelId,
        });
      }
      const reward = app.rewardCoinsForPlace(finalPlace);
      app.setProgressHud(1, "100%", "Progresso");
      app.placeLabel.textContent =
        "Posição: " + world.placeText(finalPlace) + " / " + world.getFieldSize();
      let hint = "";
      if (didWin) {
        hint = "Vitória! ";
      }
      if (reward.gained > 0) {
        hint +=
          "+" +
          reward.gained +
          " moedas" +
          (reward.multiplier > 1 ? " (×" + reward.multiplier + ")" : "") +
          "! ";
      } else if (!didWin) {
        hint = "Sem moedas desta vez. ";
      }
      const touchHint =
        typeof window.isNeonRushTouchDevice === "function" &&
        window.isNeonRushTouchDevice()
          ? "Toque em ▲ para voltar ao menu"
          : "Pressione Enter ou Espaço para voltar ao menu";
      app.rankingHint.innerHTML = hint.trim() + "<br>" + touchHint;
      app.rankingHint.classList.add("show");
      // Desliza o quadro do canto para o centro
      requestAnimationFrame(function () {
        app.rankingPanel.classList.add("centered");
      });
      world.syncMobileControlsVisibility();
    }
  };
}

