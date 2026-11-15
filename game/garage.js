// Sistema: garage. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.getGarageCarIds = function getGarageCarIds() {
    return Object.keys(window.NEON_RUSH_CARS || {});
  };

  world.rebuildPlayerCar = function rebuildPlayerCar(carId, options) {
    const opts = options || {};
    const saveEquip = opts.saveEquip !== false;
    const old = world.player.mesh;
    const wasEnabled = old.isEnabled();
    const rotY = old.rotation.y;
    const pos = old.position.clone();
    old.dispose();
    const def = app.getCarDef(carId);
    world.player.carModelId = carId;
    world.player.mesh = app.createCarByModel(
      world.scene,
      def.model,
      "player",
      BABYLON.Color3.FromArray(def.bodyColor),
      BABYLON.Color3.FromArray(def.accentColor)
    );
    world.player.mesh.position.copyFrom(pos);
    world.player.mesh.rotation.y = rotY;
    world.player.mesh.setEnabled(wasEnabled);
    world.player.flashMats = null;
    world.player.collisionFlashOn = false;
    world.player.collisionBlinkT = 0;
    world.camera.lockedTarget = world.player.mesh;
    if (saveEquip) {
      world.equippedCarId = carId;
      app.saveEquippedCarId(carId);
      world.garagePreviewId = null;
    }
    if (!world.garageOpen && !world.shopOpen && !world.missionsOpen) {
      app.refreshEquippedCarLabel();
    }
  };

  world.updateGarageHud = function updateGarageHud() {
    const ids = world.getGarageCarIds();
    const carId = ids[world.garageIndex];
    if (!carId) return;
    const def = app.getCarDef(carId);
    const rarity =
      window.NEON_RUSH_RARITIES &&
      window.NEON_RUSH_RARITIES[def.rarity];
    const owned = app.loadOwnedCars();
    const isOwned = owned.indexOf(carId) !== -1;
    const isEquipped = carId === world.equippedCarId && !world.garagePreviewId;

    const nameEl = document.getElementById("garageCarName");
    const rarityEl = document.getElementById("garageCarRarity");
    const statusEl = document.getElementById("garageCarStatus");
    const indexEl = document.getElementById("garageCarIndex");
    const equipBtn = document.getElementById("btnGarageEquip");

    nameEl.textContent = def.name;
    rarityEl.textContent = rarity ? rarity.name : "";
    rarityEl.style.color = rarity ? rarity.color : "#b8f3ff";
    indexEl.textContent = world.garageIndex + 1 + " / " + ids.length;

    statusEl.classList.remove("locked", "equipped");
    if (!isOwned) {
      statusEl.textContent = "BLOQUEADO";
      statusEl.classList.add("locked");
      equipBtn.disabled = true;
      equipBtn.textContent = "Bloqueado";
    } else if (isEquipped || carId === world.equippedCarId) {
      statusEl.textContent = "EQUIPADO";
      statusEl.classList.add("equipped");
      equipBtn.disabled = true;
      equipBtn.textContent = "Equipado";
    } else {
      statusEl.textContent = "Disponível";
      equipBtn.disabled = false;
      equipBtn.textContent = "Equipar";
    }
  };

  world.showGarageCarAt = function showGarageCarAt(index, options) {
    if (!world.inMenu || app.perfTestRunning) return;
    const opts = options || {};
    const ids = world.getGarageCarIds();
    if (!ids.length) return;
    const spinY = world.getHubSpinY();
    world.garageIndex = ((index % ids.length) + ids.length) % ids.length;
    const carId = ids[world.garageIndex];
    const owned = app.loadOwnedCars();
    const isOwned = owned.indexOf(carId) !== -1;

    if (isOwned && opts.equip) {
      world.rebuildPlayerCar(carId, { saveEquip: true });
    } else if (isOwned && carId === world.equippedCarId) {
      world.garagePreviewId = null;
      if (world.player.carModelId !== carId) {
        world.rebuildPlayerCar(carId, { saveEquip: true });
      }
    } else if (isOwned) {
      // Preview de carro próprio sem equipar ainda
      world.garagePreviewId = carId;
      world.rebuildPlayerCar(carId, { saveEquip: false });
    } else {
      world.garagePreviewId = carId;
      world.rebuildPlayerCar(carId, { saveEquip: false });
    }

    world.refreshMenuDisplay({
      resetView: !!opts.resetView,
      spinY: spinY,
    });
    world.updateGarageHud();
  };

  world.stepGarage = function stepGarage(delta) {
    if (!world.garageOpen) return;
    world.showGarageCarAt(world.garageIndex + delta);
  };

  world.equipGarageCar = function equipGarageCar() {
    if (!world.garageOpen || !world.inMenu || app.perfTestRunning) return;
    const ids = world.getGarageCarIds();
    const carId = ids[world.garageIndex];
    if (!carId) return;
    const owned = app.loadOwnedCars();
    if (owned.indexOf(carId) === -1) return;
    const spinY = world.getHubSpinY();
    world.rebuildPlayerCar(carId, { saveEquip: true });
    world.refreshMenuDisplay({ resetView: false, spinY: spinY });
    world.updateGarageHud();
  };

  world.openGarage = function openGarage() {
    if (!world.inMenu || app.perfTestRunning) return;
    if (typeof world.closeMissions === "function") world.closeMissions();
    world.closeShop({ restoreCar: false });
    world.garagePreviewId = null;
    const ids = world.getGarageCarIds();
    const idx = ids.indexOf(world.equippedCarId);
    world.garageIndex = idx >= 0 ? idx : 0;
    world.garageOpen = true;
    document.getElementById("mainMenu").classList.add("garage-open");
    const panel = document.getElementById("garagePanel");
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    world.showGarageCarAt(world.garageIndex, { resetView: false });
    world.syncMobileControlsVisibility();
  };

  world.closeGarage = function closeGarage(options) {
    const opts = options || {};
    const restoreCar = opts.restoreCar !== false;
    const panel = document.getElementById("garagePanel");
    if (restoreCar && world.garagePreviewId) {
      world.rebuildPlayerCar(world.equippedCarId, { saveEquip: true });
      world.placeGrid();
      world.enterMenuCamera();
      world.garagePreviewId = null;
    }
    world.garageOpen = false;
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    document.getElementById("mainMenu").classList.remove("garage-open");
    if (restoreCar) app.refreshEquippedCarLabel();
    world.syncMobileControlsVisibility();
  };
}

export function initializeGarage(app, world) {
  world.garagePreviewId = null;
  world.garageOpen = false;
  world.garageIndex = 0;
  world.shopOpen = false;
}
