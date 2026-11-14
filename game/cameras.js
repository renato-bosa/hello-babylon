// Sistema: cameras. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.lockCameraAtFinish = function lockCameraAtFinish(racer = world.player) {
    if (world.finishCameraLocked) return;
    world.finishCameraLocked = true;
    // Fixa onde o carro estava ao cruzar — a câmera ainda "chega" com suavidade
    world.cameraAnchor.position.copyFrom(racer.mesh.position);
    world.cameraAnchor.rotation.y = racer.mesh.rotation.y;
    world.camera.lockedTarget = world.cameraAnchor;
    world.camera.cameraAcceleration = 0.025;
    world.camera.maxCameraSpeed = 6;
  };

  world.unlockCameraFollow = function unlockCameraFollow() {
    world.finishCameraLocked = false;
    world.camera.lockedTarget = world.player.mesh;
    world.camera.cameraAcceleration = 0.05;
    world.camera.maxCameraSpeed = 20;
    world.camera.radius = 14;
    world.camera.heightOffset = 10;
    world.camera.rotationOffset = 180;
  };

  world.setRivalVisibility = function setRivalVisibility(visible) {
    world.getActiveRivals().forEach(function (rival) {
      rival.mesh.setEnabled(visible);
    });
    world.rivals.slice(world.getTrackBotCount()).forEach(function (rival) {
      rival.mesh.setEnabled(false);
    });
  };

  world.getHubSpinY = function getHubSpinY() {
    if (world.shopItemPreview) return world.shopItemPreview.rotation.y;
    if (world.player && world.player.mesh) return world.player.mesh.rotation.y;
    return 0;
  };

  world.refreshMenuDisplay = function refreshMenuDisplay(options) {
    const opts = options || {};
    const resetView = !!opts.resetView;
    const spinY =
      opts.spinY != null ? opts.spinY : world.getHubSpinY();

    world.placeGrid();
    world.setRivalVisibility(false);

    if (world.shopItemPreview) {
      world.placeShopItemPreview();
      world.player.mesh.setEnabled(false);
      world.shopItemPreview.rotation.y = spinY;
    } else if (world.player && world.player.mesh) {
      world.player.mesh.setEnabled(true);
      world.player.mesh.rotation.z = 0;
      world.player.mesh.rotation.y = spinY;
    }

    // O enquadramento usa a base da vitrine, independente da prévia.
    // A altura do item não deve mover a câmera ao alternar ofertas.
    world.menuCamera.setTarget(
      world.player.mesh.position.add(new BABYLON.Vector3(0, 0.6, 0))
    );
    if (resetView) {
      world.menuCamera.alpha = -Math.PI / 2;
      world.menuCamera.beta = 1.15;
      world.menuCamera.radius = 8.5;
    }
    world.scene.activeCamera = world.menuCamera;
  };

  world.enterMenuCamera = function enterMenuCamera() {
    world.refreshMenuDisplay({ resetView: true });
  };

  world.enterRaceCamera = function enterRaceCamera() {
    world.setRivalVisibility(true);
    world.unlockCameraFollow();
    world.scene.activeCamera = world.camera;
  };
}

export function initializeCameras(app, world) {
  world.camera = new BABYLON.FollowCamera(
    "marioKartCam",
    new BABYLON.Vector3(0, 12, -16),
    world.scene,
    world.player.mesh
  );
  world.camera.radius = 14;
  world.camera.heightOffset = 10;
  world.camera.rotationOffset = 180;
  world.camera.cameraAcceleration = 0.05;
  world.camera.maxCameraSpeed = 20;
  world.camera.inputs.clear();
  world.menuCamera = new BABYLON.ArcRotateCamera(
    "menuCam",
    -Math.PI / 2,
    1.15,
    8.5,
    world.player.mesh.position,
    world.scene
  );
  world.menuCamera.lowerRadiusLimit = 7;
  world.menuCamera.upperRadiusLimit = 11;
  world.menuCamera.wheelPrecision = 40;
  world.menuCamera.panningSensibility = 0;
  world.menuCamera.inputs.clear();
  world.cameraAnchor = new BABYLON.TransformNode("cameraAnchor", world.scene);
  world.finishCameraLocked = false;
  world.spectatorTarget = null;
}
