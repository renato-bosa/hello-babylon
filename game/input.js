// Sistema: input. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.getVirtualControls = function getVirtualControls() {
    return (
      window.virtualControls || {
        left: false,
        right: false,
        up: false,
        down: false,
        confirmJustPressed: false,
        backJustPressed: false,
      }
    );
  };

  app.mergeDriveInput = function mergeDriveInput(base) {
    const vc = app.getVirtualControls();
    return {
      up: !!(base.up || vc.up),
      down: !!(base.down || vc.down),
      left: !!(base.left || vc.left),
      right: !!(base.right || vc.right),
    };
  };

  app.consumeVirtualConfirm = function consumeVirtualConfirm() {
    const vc = app.getVirtualControls();
    if (!vc.confirmJustPressed) return false;
    vc.confirmJustPressed = false;
    return true;
  };

  app.consumeVirtualBack = function consumeVirtualBack() {
    const vc = app.getVirtualControls();
    if (!vc.backJustPressed) return false;
    vc.backJustPressed = false;
    return true;
  };
}

export function installScene(app, world) {
  world.syncMobileControlsVisibility = function syncMobileControlsVisibility() {
    const touch =
      typeof window.isNeonRushTouchDevice === "function" &&
      window.isNeonRushTouchDevice();
    const hint = document.getElementById("hudControlsHint");
    if (hint) {
      hint.textContent = touch
        ? "▲ acelerar · ▼ frear · ← → virar"
        : "↑ acelerar · ↓ frear · ← → virar";
    }
    const show =
      touch &&
      !app.botBench.active &&
      !app.perfTestRunning &&
      (!world.inMenu ||
        world.garageOpen ||
        world.shopOpen ||
        world.missionsOpen ||
        world.raceOver);
    if (typeof window.setMobileControlsVisible === "function") {
      window.setMobileControlsVisible(show);
    }
  };

  world.pollVirtualEdge = function pollVirtualEdge(side) {
    const vc = app.getVirtualControls();
    const now = !!vc[side];
    const pressed = now && !world.virtualEdgePrev[side];
    world.virtualEdgePrev[side] = now;
    return pressed;
  };

  world.handleVirtualMenuActions = function handleVirtualMenuActions() {
    const leftPressed = world.pollVirtualEdge("left");
    const rightPressed = world.pollVirtualEdge("right");

    if (world.raceOver && !app.botBench.active && app.consumeVirtualConfirm()) {
      world.showMainMenu();
      return;
    }
    if (world.canConcludeRace() && app.consumeVirtualConfirm()) {
      world.concludeRaceWithEstimates();
      return;
    }
    if (!world.inMenu) {
      app.consumeVirtualConfirm();
      app.consumeVirtualBack();
      return;
    }
    if (world.shopOpen) {
      if (leftPressed) world.stepShop(-1);
      if (rightPressed) world.stepShop(1);
      if (app.consumeVirtualConfirm()) world.buyShopOffer();
      if (app.consumeVirtualBack()) world.closeShop();
      return;
    }
    if (world.garageOpen) {
      if (leftPressed) world.stepGarage(-1);
      if (rightPressed) world.stepGarage(1);
      if (app.consumeVirtualConfirm()) world.equipGarageCar();
      if (app.consumeVirtualBack()) world.closeGarage();
      return;
    }
    if (world.missionsOpen) {
      if (app.consumeVirtualBack()) world.closeMissions();
      app.consumeVirtualConfirm();
      return;
    }
    app.consumeVirtualConfirm();
    app.consumeVirtualBack();
  };
}

export function bindDriveControls(app) {
  app.keys = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") app.keys.up = true;
    if (e.code === "ArrowDown" || e.code === "KeyS") app.keys.down = true;
    if (e.code === "ArrowLeft" || e.code === "KeyA") app.keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") app.keys.right = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowUp" || e.code === "KeyW") app.keys.up = false;
    if (e.code === "ArrowDown" || e.code === "KeyS") app.keys.down = false;
    if (e.code === "ArrowLeft" || e.code === "KeyA") app.keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") app.keys.right = false;
  });
}

export function initializeMenuInput(app, world) {
  world.virtualEdgePrev = { left: false, right: false };
}
