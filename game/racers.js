// Sistema: racers. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.makeRacer = function makeRacer(id, name, carModelId, isPlayer, aiStyle, colorOverride) {
    const def = app.getCarDef(carModelId);
    const bodyColor = colorOverride
      ? colorOverride.body
      : BABYLON.Color3.FromArray(def.bodyColor);
    const accentColor = colorOverride
      ? colorOverride.accent
      : BABYLON.Color3.FromArray(def.accentColor);
    return {
      id,
      name,
      isPlayer,
      carModelId: carModelId,
      mesh: app.createCarByModel(
        world.scene,
        def.model,
        id,
        bodyColor,
        accentColor
      ),
      speed: 0,
      progress: 0,
      distAlong: 0,
      lapsCompleted: 0,
      lapArmed: false,
      pathHint: 0,
      wallHitCooldown: 0,
      againstWall: false,
      collisionBlinkT: 0,
      collisionFlashOn: false,
      flashMats: null,
      finished: false,
      finishTime: null,
      finishTimeEstimated: false,
      prevFinishSide: -1,
      preferredLane: aiStyle ? aiStyle.preferredLane : 0,
      lookAhead: aiStyle ? aiStyle.lookAhead : 0,
      steerDeadzone: aiStyle ? aiStyle.steerDeadzone : 0.08,
      curveCaution: aiStyle ? aiStyle.curveCaution : 0,
      wobbleAmount: aiStyle ? aiStyle.wobbleAmount : 0,
      wobbleSpeed: aiStyle ? aiStyle.wobbleSpeed : 0,
      wobblePhase: aiStyle ? aiStyle.wobblePhase : 0,
      mistakeTimer: 0,
      mistakeChance: aiStyle ? aiStyle.mistakeChance : 0,
    };
  };

  world.getTrackBotCount = function getTrackBotCount() {
    const feat = world.track.data && world.track.data.features;
    if (feat && typeof feat.botCount === "number" && feat.botCount > 0) {
      return Math.min(world.rivals.length, Math.floor(feat.botCount));
    }
    return 2;
  };

  world.getActiveRivals = function getActiveRivals() {
    return world.rivals.slice(0, world.getTrackBotCount());
  };

  world.syncActiveRacers = function syncActiveRacers() {
    const active = world.getActiveRivals();
    world.racers = [world.player].concat(active);
    world.rivals.forEach(function (rival, i) {
      const on = i < active.length;
      if (!on) {
        rival.mesh.setEnabled(false);
        rival.speed = 0;
      }
    });
    return active;
  };

  world.getFieldSize = function getFieldSize() {
    return 1 + world.getTrackBotCount();
  };

  world.pickBotCarId = function pickBotCarId(excludeIds) {
    const exclude = excludeIds || [];
    const byRarity = { common: [], epic: [], legendary: [] };
    Object.keys(window.NEON_RUSH_CARS || {}).forEach(function (id) {
      if (exclude.indexOf(id) !== -1) return;
      const car = window.NEON_RUSH_CARS[id];
      if (byRarity[car.rarity]) byRarity[car.rarity].push(id);
    });

    const options = Object.keys(world.BOT_RARITY_WEIGHTS)
      .map(function (rarity) {
        return {
          rarity: rarity,
          weight: world.BOT_RARITY_WEIGHTS[rarity],
          pool: byRarity[rarity],
        };
      })
      .filter(function (row) {
        return row.pool.length > 0;
      });

    if (!options.length) {
      return window.NEON_RUSH_DEFAULT_CAR || "starter";
    }

    let total = 0;
    options.forEach(function (row) {
      total += row.weight;
    });
    let roll = Math.random() * total;
    let chosen = options[0];
    for (let i = 0; i < options.length; i++) {
      roll -= options[i].weight;
      if (roll <= 0) {
        chosen = options[i];
        break;
      }
    }
    return chosen.pool[Math.floor(Math.random() * chosen.pool.length)];
  };

  world.rebuildRivalCar = function rebuildRivalCar(racer, carId) {
    const old = racer.mesh;
    const wasEnabled = old.isEnabled();
    const rotY = old.rotation.y;
    const pos = old.position.clone();
    old.dispose();
    const def = app.getCarDef(carId);
    racer.carModelId = carId;
    racer.mesh = app.createCarByModel(
      world.scene,
      def.model,
      racer.id,
      BABYLON.Color3.FromArray(def.bodyColor),
      BABYLON.Color3.FromArray(def.accentColor)
    );
    racer.mesh.position.copyFrom(pos);
    racer.mesh.rotation.y = rotY;
    racer.mesh.setEnabled(wasEnabled);
  };

  world.assignBotCarsForRace = function assignBotCarsForRace() {
    const active = world.syncActiveRacers();
    // Benchmark: carro fixo (starter) para medir personalidade, não o modelo
    if (app.botBench.active) {
      active.forEach(function (rival) {
        world.rebuildRivalCar(rival, "starter");
      });
      return;
    }
    const used = [];
    active.forEach(function (rival) {
      let carId = world.pickBotCarId(used);
      if (!carId) carId = world.pickBotCarId();
      used.push(carId);
      world.rebuildRivalCar(rival, carId);
    });
  };
}

export function initializeRacers(app, world) {
  world.equippedCarId = app.loadEquippedCarId();
  app.refreshEquippedCarLabel();
  world.player = world.makeRacer(
    "player",
    "Você",
    world.equippedCarId,
    true,
    null
  );
  world.RIVAL_DEFS = [
    {
      id: "rivalA",
      name: "Nova",
      preferredLane: -2.4,
      lookAhead: 16,
      steerDeadzone: 0.16,
      curveCaution: 0.12,
      wobbleAmount: 1.4,
      wobbleSpeed: 1.7,
      wobblePhase: 0.4,
      mistakeChance: 0.012,
    },
    {
      id: "rivalB",
      name: "Echo",
      preferredLane: 2.4,
      lookAhead: 20,
      steerDeadzone: 0.14,
      curveCaution: 0.2,
      wobbleAmount: 0.9,
      wobbleSpeed: 1.2,
      wobblePhase: 2.1,
      mistakeChance: 0.008,
    },
    {
      id: "rivalC",
      name: "Blaze",
      preferredLane: -5.5,
      lookAhead: 18,
      steerDeadzone: 0.15,
      curveCaution: 0.16,
      wobbleAmount: 1.1,
      wobbleSpeed: 1.4,
      wobblePhase: 1.1,
      mistakeChance: 0.01,
    },
    {
      id: "rivalD",
      name: "Volt",
      preferredLane: 5.5,
      lookAhead: 17,
      steerDeadzone: 0.15,
      curveCaution: 0.14,
      wobbleAmount: 1.2,
      wobbleSpeed: 1.5,
      wobblePhase: 2.8,
      mistakeChance: 0.011,
    },
    {
      id: "rivalE",
      name: "Ghost",
      preferredLane: -8.5,
      lookAhead: 19,
      steerDeadzone: 0.13,
      curveCaution: 0.18,
      wobbleAmount: 0.8,
      wobbleSpeed: 1.1,
      wobblePhase: 0.7,
      mistakeChance: 0.009,
    },
    {
      id: "rivalF",
      name: "Spark",
      preferredLane: 8.5,
      lookAhead: 15,
      steerDeadzone: 0.17,
      curveCaution: 0.11,
      wobbleAmount: 1.5,
      wobbleSpeed: 1.8,
      wobblePhase: 3.3,
      mistakeChance: 0.013,
    },
  ];
  world.rivals = world.RIVAL_DEFS.map(function (def) {
    return world.makeRacer(def.id, def.name, "starter", false, def);
  });
  world.rivals.forEach(function (rival) {
    rival.mesh.setEnabled(false);
  });
  world.racers = [world.player].concat(world.rivals.slice(0, 2));
  world.BOT_RARITY_WEIGHTS = {
    common: 70,
    epic: 22,
    legendary: 8,
  };
}
