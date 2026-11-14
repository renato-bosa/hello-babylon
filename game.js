const canvas = document.getElementById("renderCanvas");
const speedLabel = document.getElementById("speedLabel");
const progressLabel = document.getElementById("progressLabel");
const progressTitle = document.getElementById("progressTitle");
const speedFill = document.getElementById("speedFill");
const progressFill = document.getElementById("progressFill");
const placeLabel = document.getElementById("placeLabel");

function setMeterFill(el, ratio) {
  if (!el) return;
  const pct = Math.max(0, Math.min(1, ratio || 0)) * 100;
  el.style.width = pct.toFixed(1) + "%";
}

function setSpeedHud(speed, maxSpeed) {
  const abs = Math.abs(speed || 0);
  const cap = Math.max(1, maxSpeed || 1);
  speedLabel.textContent = String(Math.round(abs));
  setMeterFill(speedFill, abs / cap);
  if (speedFill) {
    speedFill.classList.toggle("flash", abs / cap > 0.92);
  }
}

function snapProgressRatio(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio || 0));
  // Visual em degraus de 10% para não distrair
  return Math.floor(clamped * 10 + 1e-6) / 10;
}

function setProgressHud(ratio, label, title) {
  if (title && progressTitle) progressTitle.textContent = title;
  progressLabel.textContent = label;
  setMeterFill(progressFill, snapProgressRatio(ratio));
}
const mainMenu = document.getElementById("mainMenu");
const btnStartRace = document.getElementById("btnStartRace");
const hud = document.getElementById("hud");
const rankingPanel = document.getElementById("rankingPanel");
const rankingList = document.getElementById("rankingList");
const rankingHint = document.getElementById("rankingHint");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumber = document.getElementById("countdownNumber");
const moneyLabel = document.getElementById("moneyLabel");
const debugFps = document.getElementById("debugFps");
const debugPerfBtn = document.getElementById("debugPerfBtn");
const debugPerfReport = document.getElementById("debugPerfReport");
const engine = new BABYLON.Engine(canvas, true);

const TRACK_STORAGE_KEY = "neonRush.activeTrack";

function getTrackIds() {
  return Object.keys(window.NEON_RUSH_TRACKS || {});
}

function applySavedTrack() {
  const saved = localStorage.getItem(TRACK_STORAGE_KEY);
  if (saved && window.NEON_RUSH_TRACKS && window.NEON_RUSH_TRACKS[saved]) {
    window.NEON_RUSH_ACTIVE_TRACK = saved;
  } else if (!window.NEON_RUSH_ACTIVE_TRACK) {
    const ids = getTrackIds();
    window.NEON_RUSH_ACTIVE_TRACK = ids[0] || "neon-circuit-1";
  }
  localStorage.setItem(
    TRACK_STORAGE_KEY,
    window.NEON_RUSH_ACTIVE_TRACK
  );
}

function refreshTrackLabel() {
  const label = document.getElementById("trackNameLabel");
  if (!label) return;
  const ids = getTrackIds();
  const id = window.NEON_RUSH_ACTIVE_TRACK;
  const data =
    window.NEON_RUSH_TRACKS && window.NEON_RUSH_TRACKS[id];
  const name = data ? data.name : id || "—";
  const idx = Math.max(0, ids.indexOf(id));
  label.textContent =
    ids.length > 1
      ? name + "  (" + (idx + 1) + "/" + ids.length + ")"
      : name;
}

// Preenchido por createScene — troca a pista sem reload (Simple Browser do Cursor)
let switchTrackInScene = null;

function stepActiveTrack(delta) {
  const ids = getTrackIds();
  if (ids.length < 2) {
    window.alert(
      "Só existe 1 pista carregada. Confira se o arquivo tracks/sunset-rush.js abriu no navegador."
    );
    return;
  }
  const current = window.NEON_RUSH_ACTIVE_TRACK;
  let idx = ids.indexOf(current);
  if (idx < 0) idx = 0;
  idx = (idx + delta + ids.length) % ids.length;
  const nextId = ids[idx];
  localStorage.setItem(TRACK_STORAGE_KEY, nextId);
  window.NEON_RUSH_ACTIVE_TRACK = nextId;

  if (typeof switchTrackInScene === "function") {
    const ok = switchTrackInScene(nextId);
    if (ok) {
      refreshTrackLabel();
      return;
    }
  }

  // Fallback se a cena ainda não estiver pronta
  try {
    window.location.reload();
  } catch (err) {
    refreshTrackLabel();
  }
}

function setCanvasInteractive(enabled) {
  canvas.classList.toggle("racing", !!enabled);
}

applySavedTrack();
refreshTrackLabel();
setCanvasInteractive(false);

document
  .getElementById("btnTrackSwitch")
  .addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    stepActiveTrack(1);
  });

const debugEnabled =
  new URLSearchParams(window.location.search).get("debug") === "true";
const debugBotBenchBtn = document.getElementById("debugBotBenchBtn");
if (debugEnabled) {
  debugFps.classList.add("show");
  debugPerfBtn.classList.add("show");
  if (debugBotBenchBtn) debugBotBenchBtn.classList.add("show");
}
let debugFpsFrame = 0;
let perfTestRunning = false;
// Preenchido dentro de createScene (raízes para ligar/desligar no teste)
let perfSceneApi = null;
let botBenchApi = null;
const botBench = {
  active: false,
  simSpeed: 5,
  runsPerTrack: 4,
  resolveRace: null,
  trackId: null,
  runIndex: 0,
  rows: [],
};

// Economia: começa em 0; 1º=+11, 2º=+7, 3º=+0
const COIN_REWARDS = { 1: 11, 2: 7, 3: 0 };
const COINS_STORAGE_KEY = "neonRush.coins";
const COIN_MULTIPLIER_KEY = "neonRush.coinMultiplierNext";
const COIN_MULTIPLIER_PRICE = 11;
const COIN_MULTIPLIER_VALUE = 3;
const CALIBRATED_TIRE_KEY = "neonRush.calibratedTireNext";
const CALIBRATED_TIRE_PRICE_MIN = 30;
const CALIBRATED_TIRE_PRICE_MAX = 50;
const CALIBRATED_TIRE_SPEED_MULT = 1.25;
const CALIBRATED_TIRE_BONUS_PCT = Math.round(
  (CALIBRATED_TIRE_SPEED_MULT - 1) * 100
);

function loadCoins() {
  const saved = localStorage.getItem(COINS_STORAGE_KEY);
  const value = saved === null ? 0 : parseInt(saved, 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function saveCoins(amount) {
  localStorage.setItem(COINS_STORAGE_KEY, String(amount));
}

function loadPendingCoinMultiplier() {
  const saved = parseInt(
    localStorage.getItem(COIN_MULTIPLIER_KEY) || "1",
    10
  );
  return saved > 1 ? saved : 1;
}

function savePendingCoinMultiplier(mult) {
  if (mult > 1) {
    localStorage.setItem(COIN_MULTIPLIER_KEY, String(mult));
  } else {
    localStorage.removeItem(COIN_MULTIPLIER_KEY);
  }
}

function hasPendingCoinMultiplier() {
  return loadPendingCoinMultiplier() > 1;
}

function activateCoinMultiplier() {
  savePendingCoinMultiplier(COIN_MULTIPLIER_VALUE);
}

function hasPendingCalibratedTire() {
  return localStorage.getItem(CALIBRATED_TIRE_KEY) === "1";
}

function activateCalibratedTire() {
  localStorage.setItem(CALIBRATED_TIRE_KEY, "1");
}

function consumeCalibratedTire() {
  localStorage.removeItem(CALIBRATED_TIRE_KEY);
}

function rollPriceBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

let coins = loadCoins();

function refreshMoneyLabel() {
  moneyLabel.textContent = String(coins);
  const multBadge = document.getElementById("multiplierBadge");
  if (multBadge) {
    multBadge.hidden = !hasPendingCoinMultiplier();
  }
  const tireBadge = document.getElementById("tireBadge");
  if (tireBadge) {
    tireBadge.textContent = "Pneu +" + CALIBRATED_TIRE_BONUS_PCT + "%";
    tireBadge.hidden = !hasPendingCalibratedTire();
  }
}

function rewardCoinsForPlace(place) {
  const base = COIN_REWARDS[place] || 0;
  const multiplier = loadPendingCoinMultiplier();
  const gained = base * multiplier;
  if (multiplier > 1) {
    savePendingCoinMultiplier(1);
  }
  if (gained > 0) {
    coins += gained;
    saveCoins(coins);
  }
  refreshMoneyLabel();
  return { gained: gained, multiplier: multiplier, base: base };
}

refreshMoneyLabel();

// Física base; itens da loja podem buffar só o jogador na próxima corrida
const PHYSICS = {
  maxSpeed: 70,
  accel: 28,
  brake: 40,
  friction: 10,
  turnRate: 1.2,
  laneLimit: 5.5,
};

function getRacerMaxSpeed(racer) {
  return racer.maxSpeed != null ? racer.maxSpeed : PHYSICS.maxSpeed;
}

function getActiveLaneLimit() {
  const id = window.NEON_RUSH_ACTIVE_TRACK;
  const data =
    window.NEON_RUSH_TRACKS && id ? window.NEON_RUSH_TRACKS[id] : null;
  const feat = data && data.features;
  if (feat && typeof feat.laneLimit === "number") return feat.laneLimit;
  // Até perto da faixa neon da beira (metade da pista − folga do carro)
  if (feat && typeof feat.roadWidth === "number") {
    return feat.roadWidth * 0.5 - 1;
  }
  return PHYSICS.laneLimit;
}

const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
};

function getVirtualControls() {
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
}

function mergeDriveInput(base) {
  const vc = getVirtualControls();
  return {
    up: !!(base.up || vc.up),
    down: !!(base.down || vc.down),
    left: !!(base.left || vc.left),
    right: !!(base.right || vc.right),
  };
}

function consumeVirtualConfirm() {
  const vc = getVirtualControls();
  if (!vc.confirmJustPressed) return false;
  vc.confirmJustPressed = false;
  return true;
}

function consumeVirtualBack() {
  const vc = getVirtualControls();
  if (!vc.backJustPressed) return false;
  vc.backJustPressed = false;
  return true;
}

window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = true;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = true;
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

function makeNeonMaterial(name, scene, color, glow = 0.85) {
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = color.scale(0.25);
  mat.emissiveColor = color.scale(glow);
  mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.3);
  return mat;
}

const EQUIPPED_CAR_KEY = "neonRush.equippedCar";
const PURCHASED_CARS_KEY = "neonRush.purchasedCars";

function getCarDef(carId) {
  return (
    (window.NEON_RUSH_CARS && window.NEON_RUSH_CARS[carId]) ||
    window.NEON_RUSH_CARS.starter
  );
}

function loadPurchasedCars() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(PURCHASED_CARS_KEY)
    );
    if (Array.isArray(saved)) {
      return saved.filter(function (id) {
        return window.NEON_RUSH_CARS && window.NEON_RUSH_CARS[id];
      });
    }
  } catch (e) {}
  return [];
}

function savePurchasedCars(ids) {
  localStorage.setItem(PURCHASED_CARS_KEY, JSON.stringify(ids));
}

function purchaseCar(carId) {
  const purchased = loadPurchasedCars();
  if (purchased.indexOf(carId) === -1) {
    purchased.push(carId);
    savePurchasedCars(purchased);
    refreshAccountStats();
  }
}

function shuffleArray(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function loadOwnedCars() {
  // Só o que vem de graça + o que foi comprado na loja
  const owned = Object.keys(window.NEON_RUSH_CARS || {}).filter(
    function (id) {
      return window.NEON_RUSH_CARS[id].ownedByDefault;
    }
  );
  loadPurchasedCars().forEach(function (id) {
    if (owned.indexOf(id) === -1) owned.push(id);
  });
  // Limpa save antigo que liberava carros sem comprar
  localStorage.removeItem("neonRush.ownedCars");
  return owned;
}

const WINS_STORAGE_KEY = "neonRush.wins";

function getTotalCarsCount() {
  return Object.keys(window.NEON_RUSH_CARS || {}).length;
}

function loadWins() {
  const saved = parseInt(localStorage.getItem(WINS_STORAGE_KEY) || "0", 10);
  return Number.isFinite(saved) && saved >= 0 ? saved : 0;
}

function saveWins(amount) {
  localStorage.setItem(WINS_STORAGE_KEY, String(amount));
}

let wins = loadWins();

function refreshAccountStats() {
  const carsLabel = document.getElementById("carsCollectionLabel");
  const winsLabel = document.getElementById("winsLabel");
  if (carsLabel) {
    carsLabel.textContent =
      loadOwnedCars().length + "/" + getTotalCarsCount();
  }
  if (winsLabel) {
    winsLabel.textContent = String(wins);
  }
}

function registerWinIfFirst(place) {
  if (place !== 1) return false;
  wins += 1;
  saveWins(wins);
  refreshAccountStats();
  return true;
}

refreshAccountStats();

function loadEquippedCarId() {
  const owned = loadOwnedCars();
  const saved = localStorage.getItem(EQUIPPED_CAR_KEY);
  if (saved && owned.indexOf(saved) !== -1) return saved;
  const fallback = window.NEON_RUSH_DEFAULT_CAR || "starter";
  localStorage.setItem(EQUIPPED_CAR_KEY, fallback);
  return fallback;
}

function saveEquippedCarId(carId) {
  localStorage.setItem(EQUIPPED_CAR_KEY, carId);
}

function refreshEquippedCarLabel() {
  const label = document.getElementById("equippedCarLabel");
  if (!label) return;
  const def = getCarDef(loadEquippedCarId());
  const rarity =
    window.NEON_RUSH_RARITIES &&
    window.NEON_RUSH_RARITIES[def.rarity];
  label.textContent =
    def.name + (rarity ? " · " + rarity.name : "");
  label.style.color = rarity ? rarity.color : "#b8f3ff";
}

const createCarByModel =
  window.NeonRushCarModels.createFactory(makeNeonMaterial);

// Prévia 3D dos itens da loja (não são carros)
function createMultiplierItemPreview(scene, id) {
  const root = new BABYLON.TransformNode("shopItem_" + id, scene);

  const goldMat = new BABYLON.StandardMaterial("multGold_" + id, scene);
  goldMat.diffuseColor = new BABYLON.Color3(1, 0.78, 0.2);
  goldMat.emissiveColor = new BABYLON.Color3(0.55, 0.32, 0.05);
  goldMat.specularColor = new BABYLON.Color3(1, 0.9, 0.4);

  const neonMat = makeNeonMaterial(
    "multNeon_" + id,
    scene,
    new BABYLON.Color3(0.22, 1, 0.62),
    1
  );
  const darkMat = new BABYLON.StandardMaterial("multDark_" + id, scene);
  darkMat.diffuseColor = new BABYLON.Color3(0.07, 0.1, 0.12);
  darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.04);

  const pedestal = BABYLON.MeshBuilder.CreateCylinder(
    "multPed_" + id,
    { diameter: 2.1, height: 0.16, tessellation: 28 },
    scene
  );
  pedestal.position.y = 0.08;
  pedestal.material = darkMat;
  pedestal.parent = root;

  const ring = BABYLON.MeshBuilder.CreateTorus(
    "multRing_" + id,
    { diameter: 2.0, thickness: 0.09, tessellation: 40 },
    scene
  );
  ring.position.y = 0.16;
  ring.material = neonMat;
  ring.parent = root;

  for (let i = 0; i < 3; i++) {
    const coin = BABYLON.MeshBuilder.CreateCylinder(
      "multCoin_" + id + "_" + i,
      { diameter: 1.5 - i * 0.06, height: 0.18, tessellation: 36 },
      scene
    );
    coin.position.y = 0.35 + i * 0.22;
    coin.material = goldMat;
    coin.parent = root;

    const edge = BABYLON.MeshBuilder.CreateTorus(
      "multEdge_" + id + "_" + i,
      { diameter: 1.5 - i * 0.06, thickness: 0.06, tessellation: 36 },
      scene
    );
    edge.position.y = coin.position.y;
    edge.material = neonMat;
    edge.parent = root;
  }

  // Placa ×3 com texto (evita geometria espelhada ao girar)
  const badge = BABYLON.MeshBuilder.CreatePlane(
    "multBadge_" + id,
    { width: 1.5, height: 0.85 },
    scene
  );
  badge.position.y = 1.85;
  badge.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  const badgeMat = new BABYLON.StandardMaterial("multBadgeMat_" + id, scene);
  const badgeTex = new BABYLON.DynamicTexture(
    "multBadgeTex_" + id,
    { width: 256, height: 160 },
    scene,
    false
  );
  badgeTex.hasAlpha = true;
  const ctx = badgeTex.getContext();
  ctx.clearRect(0, 0, 256, 160);
  ctx.fillStyle = "rgba(6, 18, 14, 0.92)";
  ctx.strokeStyle = "#39ff9f";
  ctx.lineWidth = 10;
  ctx.fillRect(8, 8, 240, 144);
  ctx.strokeRect(8, 8, 240, 144);
  badgeTex.drawText(
    "×3",
    null,
    108,
    "bold 96px sans-serif",
    "#9dffc9",
    null,
    true,
    true
  );
  badgeMat.diffuseTexture = badgeTex;
  badgeMat.emissiveTexture = badgeTex;
  badgeMat.opacityTexture = badgeTex;
  badgeMat.backFaceCulling = false;
  badgeMat.disableLighting = true;
  badge.material = badgeMat;
  badge.parent = root;

  return root;
}

function createCalibratedTireItemPreview(scene, id) {
  const root = new BABYLON.TransformNode("shopItem_" + id, scene);

  const rubberMat = new BABYLON.StandardMaterial("tireRub_" + id, scene);
  rubberMat.diffuseColor = new BABYLON.Color3(0.16, 0.18, 0.22);
  rubberMat.emissiveColor = new BABYLON.Color3(0.05, 0.07, 0.1);
  rubberMat.specularColor = new BABYLON.Color3(0.25, 0.25, 0.3);

  const rimMat = new BABYLON.StandardMaterial("tireRim_" + id, scene);
  rimMat.diffuseColor = new BABYLON.Color3(0.7, 0.75, 0.85);
  rimMat.emissiveColor = new BABYLON.Color3(0.18, 0.22, 0.3);
  rimMat.specularColor = new BABYLON.Color3(0.85, 0.9, 1);

  const neonMat = makeNeonMaterial(
    "tireNeon_" + id,
    scene,
    new BABYLON.Color3(0.45, 0.82, 1),
    1
  );
  const darkMat = new BABYLON.StandardMaterial("tireDark_" + id, scene);
  darkMat.diffuseColor = new BABYLON.Color3(0.07, 0.09, 0.12);
  darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.05);

  const pedestal = BABYLON.MeshBuilder.CreateCylinder(
    "tirePed_" + id,
    { diameter: 2.0, height: 0.16, tessellation: 28 },
    scene
  );
  pedestal.position.y = 0.08;
  pedestal.material = darkMat;
  pedestal.parent = root;

  const padRing = BABYLON.MeshBuilder.CreateTorus(
    "tirePadRing_" + id,
    { diameter: 1.9, thickness: 0.09, tessellation: 40 },
    scene
  );
  padRing.position.y = 0.16;
  padRing.material = neonMat;
  padRing.parent = root;

  // Monta no eixo Y (torus padrão do Babylon fica deitado) e
  // depois levanta o conjunto inteiro — assim pneu e aro não dessincronizam
  const wheel = new BABYLON.TransformNode("tireWheel_" + id, scene);
  wheel.position.y = 1.15;
  wheel.rotation.x = Math.PI / 2;
  wheel.parent = root;

  const tire = BABYLON.MeshBuilder.CreateTorus(
    "tireBody_" + id,
    { diameter: 1.55, thickness: 0.48, tessellation: 36 },
    scene
  );
  tire.material = rubberMat;
  tire.parent = wheel;

  const rim = BABYLON.MeshBuilder.CreateCylinder(
    "tireRim_" + id,
    { diameter: 1.05, height: 0.28, tessellation: 28 },
    scene
  );
  rim.position.y = 0.06;
  rim.material = rimMat;
  rim.parent = wheel;

  const hub = BABYLON.MeshBuilder.CreateCylinder(
    "tireHub_" + id,
    { diameter: 0.38, height: 0.34, tessellation: 16 },
    scene
  );
  hub.position.y = 0.1;
  hub.material = neonMat;
  hub.parent = wheel;

  for (let i = 0; i < 6; i++) {
    const spoke = BABYLON.MeshBuilder.CreateBox(
      "tireSpoke_" + id + "_" + i,
      { width: 0.85, height: 0.1, depth: 0.11 },
      scene
    );
    spoke.rotation.y = (i * Math.PI) / 6;
    spoke.position.y = 0.08;
    spoke.material = rimMat;
    spoke.parent = wheel;
  }

  // Placa de bônus relativo à vel. máx.
  const badge = BABYLON.MeshBuilder.CreatePlane(
    "tireBadge_" + id,
    { width: 1.15, height: 0.7 },
    scene
  );
  badge.position.set(0, 2.4, 0);
  badge.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
  const badgeMat = new BABYLON.StandardMaterial("tireBadgeMat_" + id, scene);
  const badgeTex = new BABYLON.DynamicTexture(
    "tireBadgeTex_" + id,
    { width: 256, height: 160 },
    scene,
    false
  );
  badgeTex.hasAlpha = true;
  const ctx = badgeTex.getContext();
  ctx.clearRect(0, 0, 256, 160);
  ctx.fillStyle = "rgba(6, 14, 22, 0.92)";
  ctx.strokeStyle = "#74d2ff";
  ctx.lineWidth = 10;
  ctx.fillRect(8, 8, 240, 144);
  ctx.strokeRect(8, 8, 240, 144);
  badgeTex.drawText(
    "+" + CALIBRATED_TIRE_BONUS_PCT + "%",
    null,
    108,
    "bold 72px sans-serif",
    "#9fe3ff",
    null,
    true,
    true
  );
  badgeMat.diffuseTexture = badgeTex;
  badgeMat.emissiveTexture = badgeTex;
  badgeMat.opacityTexture = badgeTex;
  badgeMat.backFaceCulling = false;
  badgeMat.disableLighting = true;
  badge.material = badgeMat;
  badge.parent = root;

  return root;
}

function createShopItemPreview(scene, itemId) {
  if (itemId === "calibrated-tire") {
    return createCalibratedTireItemPreview(scene, itemId);
  }
  return createMultiplierItemPreview(scene, itemId || "multiplier");
}

function getActiveTrackData() {
  const id = window.NEON_RUSH_ACTIVE_TRACK;
  const data = window.NEON_RUSH_TRACKS && window.NEON_RUSH_TRACKS[id];
  if (!data) {
    throw new Error("Pista não encontrada: " + id);
  }
  return data;
}

// Em ovais o mesmo XZ aparece 2x; busca a partir de minDist (evita chegada de 1s)
function findDistNearPoint(path3D, target, minDist) {
  const total = path3D.length();
  const startAt = Math.max(0, Math.min(total - 1, minDist || 0));
  let bestD = startAt;
  let bestScore = Infinity;
  const step = Math.max(1, total / 400);
  for (let d = startAt; d <= total; d += step) {
    const p = path3D.getPointAt(Math.max(0, Math.min(1, d / total)));
    const score = BABYLON.Vector3.DistanceSquared(p, target);
    if (score < bestScore) {
      bestScore = score;
      bestD = d;
    }
  }
  return bestD;
}

function buildTrackFromData(trackData) {
  const controls = trackData.controlPoints.map(function (p) {
    return new BABYLON.Vector3(p[0], p[1], p[2]);
  });
  const curve = BABYLON.Curve3.CreateCatmullRomSpline(controls, 25, false);
  const path3D = new BABYLON.Path3D(
    curve.getPoints(),
    new BABYLON.Vector3(0, 1, 0)
  );

  const startPos = new BABYLON.Vector3(
    trackData.startPoint[0],
    trackData.startPoint[1],
    trackData.startPoint[2]
  );
  const finishPos = new BABYLON.Vector3(
    trackData.finishPoint[0],
    trackData.finishPoint[1],
    trackData.finishPoint[2]
  );

  const startDist = findDistNearPoint(path3D, startPos, 0);
  const finishDist = findDistNearPoint(
    path3D,
    finishPos,
    startDist + 80
  );
  const lapLength = Math.max(1, finishDist - startDist);
  const feats = trackData.features || {};
  const totalLaps =
    typeof feats.laps === "number" && feats.laps > 1
      ? Math.floor(feats.laps)
      : 1;

  return {
    data: trackData,
    path3D: path3D,
    trackLength: path3D.length(),
    startDist: startDist,
    finishDist: finishDist,
    lapLength: lapLength,
    totalLaps: totalLaps,
    raceLength: lapLength * totalLaps,
  };
}

// Lateral estável no plano XZ (Y-up). O binormal do Path3D pode
// flipar em retas longas (ex.: início da Natal Race) e empurrar o carro.
function lateralFromTangent(tangent) {
  const side = new BABYLON.Vector3(tangent.z, 0, -tangent.x);
  const len = side.length();
  if (len < 1e-5) return new BABYLON.Vector3(1, 0, 0);
  return side.scaleInPlace(1 / len);
}

function samplePath(path3D, distance) {
  const total = path3D.length();
  const t = Math.max(0, Math.min(1, distance / total));
  const tangent = path3D.getTangentAt(t).normalize();
  return {
    total,
    t,
    position: path3D.getPointAt(t),
    tangent: tangent,
    normal: path3D.getNormalAt(t).normalize(),
    binormal: lateralFromTangent(tangent),
  };
}

function yawFromTangent(tangent) {
  return Math.atan2(tangent.x, tangent.z);
}

// Inclinação suave do morro (CreateGround / carros no eixo local)
function pitchFromTangent(tangent) {
  const horiz = Math.sqrt(
    tangent.x * tangent.x + tangent.z * tangent.z
  );
  return -Math.atan2(tangent.y, Math.max(0.0001, horiz));
}

function distanceAlongPath(path3D, worldPos) {
  return path3D.getDistanceAt(path3D.getClosestPositionTo(worldPos));
}

// Oval: evita pular da largada para a chegada (mesmo XZ no loop)
function distanceAlongPathHinted(path3D, worldPos, hintDist, back, fwd) {
  const total = path3D.length();
  const hint = Math.max(0, Math.min(total, hintDist || 0));
  const lo = Math.max(0, hint - (back || 30));
  const hi = Math.min(total, hint + (fwd || 100));
  let bestD = hint;
  let best = Infinity;
  const step = 2;
  for (let d = lo; d <= hi; d += step) {
    const p = path3D.getPointAt(Math.max(0, Math.min(1, d / total)));
    const score = BABYLON.Vector3.DistanceSquared(p, worldPos);
    if (score < best) {
      best = score;
      bestD = d;
    }
  }
  return bestD;
}

function raceProgressFromDistance(distAlong, track) {
  return Math.max(
    0,
    Math.min(1, (distAlong - track.startDist) / track.raceLength)
  );
}

function raceProgressFromLaps(racer, track) {
  const local = Math.max(
    0,
    Math.min(
      0.999,
      (racer.distAlong - track.startDist) / track.lapLength
    )
  );
  return Math.max(
    0,
    Math.min(1, (racer.lapsCompleted + local) / track.totalLaps)
  );
}

function createRoadPiece(scene, sample, roadMat, edgeMat, index, roadWidth) {
  const pieceLength = 8;
  const width = roadWidth || 14;
  const half = width / 2;
  const group = new BABYLON.TransformNode("roadPiece_" + index, scene);
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);
  group.rotation.x = pitchFromTangent(sample.tangent);

  const road = BABYLON.MeshBuilder.CreateGround(
    "road_" + index,
    { width: width, height: pieceLength },
    scene
  );
  road.material = roadMat;
  road.parent = group;

  const leftEdge = BABYLON.MeshBuilder.CreateBox(
    "leftEdge_" + index,
    { width: 0.25, height: 0.2, depth: pieceLength },
    scene
  );
  leftEdge.position.set(-half, 0.1, 0);
  leftEdge.material = edgeMat;
  leftEdge.parent = group;

  const rightEdge = BABYLON.MeshBuilder.CreateBox(
    "rightEdge_" + index,
    { width: 0.25, height: 0.2, depth: pieceLength },
    scene
  );
  rightEdge.position.set(half, 0.1, 0);
  rightEdge.material = edgeMat;
  rightEdge.parent = group;

  const dash = BABYLON.MeshBuilder.CreateBox(
    "dash_" + index,
    { width: 0.2, height: 0.05, depth: 3 },
    scene
  );
  dash.position.set(0, 0.03, 0);
  dash.material = edgeMat;
  dash.parent = group;

  return group;
}

function createOvalGrandstand(scene, sample, dir, roadHalf, id, mats) {
  const group = new BABYLON.TransformNode("ovalStand_" + id, scene);
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);
  group.rotation.x = pitchFromTangent(sample.tangent);

  // Berma inclinada (só visual)
  const berm = BABYLON.MeshBuilder.CreateBox(
    "ovalBerm_" + id,
    { width: 7.5, height: 3.2, depth: 9 },
    scene
  );
  berm.position.set(dir * (roadHalf + 4.0), 1.2, 0);
  berm.rotation.z = dir * -0.42;
  berm.material = mats.berm;
  berm.parent = group;

  // Muro alto — tapa o horizonte
  const wall = BABYLON.MeshBuilder.CreateBox(
    "ovalWall_" + id,
    { width: 1.6, height: 10, depth: 9 },
    scene
  );
  wall.position.set(dir * (roadHalf + 8.8), 4.6, 0);
  wall.material = mats.wall;
  wall.parent = group;

  // Degraus de arquibancada
  const seat = BABYLON.MeshBuilder.CreateBox(
    "ovalSeat_" + id,
    { width: 4.5, height: 0.35, depth: 8.6 },
    scene
  );
  seat.position.set(dir * (roadHalf + 5.5), 2.6, 0);
  seat.material = mats.seat;
  seat.parent = group;

  const neon = BABYLON.MeshBuilder.CreateBox(
    "ovalNeon_" + id,
    { width: 0.35, height: 0.35, depth: 9 },
    scene
  );
  neon.position.set(dir * (roadHalf + 8.8), 9.7, 0);
  neon.material = mats.neon;
  neon.parent = group;

  return group;
}

function createOvalInnerCurb(scene, sample, dir, roadHalf, id, mats) {
  const group = new BABYLON.TransformNode("ovalCurb_" + id, scene);
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);
  group.rotation.x = pitchFromTangent(sample.tangent);

  const curb = BABYLON.MeshBuilder.CreateBox(
    "ovalCurbMesh_" + id,
    { width: 0.9, height: 0.4, depth: 8.5 },
    scene
  );
  curb.position.set(dir * (roadHalf + 0.55), 0.18, 0);
  curb.material = mats.neon;
  curb.parent = group;
  return group;
}

// Tapete contínuo de areia (evita “triângulos pretos” nas curvas)
function createBeachSandField(scene, path3D, trackLength, sandMat) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const sampleStep = Math.max(12, trackLength / 40);
  for (let d = 0; d <= trackLength; d += sampleStep) {
    const p = path3D.getPointAt(
      Math.max(0, Math.min(1, d / trackLength))
    );
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const margin = 140;
  const width = maxX - minX + margin * 2;
  const depth = maxZ - minZ + margin * 2;
  const sand = BABYLON.MeshBuilder.CreateGround(
    "beachSandField",
    { width: width, height: depth },
    scene
  );
  sand.position.set((minX + maxX) / 2, -0.04, (minZ + maxZ) / 2);
  sand.material = sandMat;
  return sand;
}

let beachTapeSerial = 0;

function createBeachTape(scene, sample, side, tapeA, tapeB) {
  const sid = beachTapeSerial++;
  const group = new BABYLON.TransformNode("beachTape_" + sid, scene);
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);
  group.rotation.x = pitchFromTangent(sample.tangent);

  const post = BABYLON.MeshBuilder.CreateBox(
    "tapePost_" + sid,
    { width: 0.08, height: 0.85, depth: 0.08 },
    scene
  );
  post.position.set(side * 7.1, 0.42, 0);
  post.material = tapeB;
  post.parent = group;

  const ribbon = BABYLON.MeshBuilder.CreateBox(
    "tapeRibbon_" + sid,
    { width: 0.06, height: 0.22, depth: 7.2 },
    scene
  );
  ribbon.position.set(side * 7.1, 0.72, 0);
  ribbon.material = sid % 2 === 0 ? tapeA : tapeB;
  ribbon.parent = group;

  return group;
}

// Faixa de mar: bem larga para os lados e comprida para o horizonte
function createOceanPlane(scene, sample, oceanMat) {
  const group = new BABYLON.TransformNode("oceanPad", scene);
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);

  const water = BABYLON.MeshBuilder.CreateGround(
    "oceanWater",
    { width: 520, height: 260 },
    scene
  );
  // Começa um pouco à frente e segue longe; y leve abaixo da areia
  water.position.set(0, -0.12, 110);
  water.material = oceanMat;
  water.parent = group;
  return group;
}

let tunnelRingSerial = 0;

function createTunnelRing(scene, sample, wallMat, neonMat) {
  const sid = tunnelRingSerial++;
  const group = new BABYLON.TransformNode("tunnelRing_" + sid, scene);
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);
  group.rotation.x = pitchFromTangent(sample.tangent);

  const left = BABYLON.MeshBuilder.CreateBox(
    "tunnelL_" + sid,
    { width: 0.45, height: 5.2, depth: 9.5 },
    scene
  );
  left.position.set(-7.6, 2.6, 0);
  left.material = wallMat;
  left.parent = group;

  const right = left.clone("tunnelR_" + sid);
  right.position.x = 7.6;
  right.parent = group;

  const roof = BABYLON.MeshBuilder.CreateBox(
    "tunnelRoof_" + sid,
    { width: 15.6, height: 0.4, depth: 9.5 },
    scene
  );
  roof.position.set(0, 5.2, 0);
  roof.material = wallMat;
  roof.parent = group;

  // Faixa neon no teto (barata: 1 caixa)
  const strip = BABYLON.MeshBuilder.CreateBox(
    "tunnelStrip_" + sid,
    { width: 0.35, height: 0.12, depth: 9.2 },
    scene
  );
  strip.position.set(0, 5.0, 0);
  strip.material = neonMat;
  strip.parent = group;

  return group;
}

let finishLineSerial = 0;

function createFinishLine(scene, sample, roadWidth) {
  const sid = finishLineSerial++;
  const width = roadWidth || 14;
  const half = width / 2;
  const gate = new BABYLON.TransformNode("finishGate_" + sid, scene);
  gate.position.copyFrom(sample.position);
  gate.rotation.y = yawFromTangent(sample.tangent);
  gate.rotation.x = pitchFromTangent(sample.tangent);

  const pink = makeNeonMaterial(
    "finishPink_" + sid,
    scene,
    new BABYLON.Color3(1, 0.2, 0.85),
    1
  );
  const cyan = makeNeonMaterial(
    "finishCyan_" + sid,
    scene,
    new BABYLON.Color3(0.2, 0.95, 1),
    1
  );
  const white = makeNeonMaterial(
    "finishWhite_" + sid,
    scene,
    new BABYLON.Color3(1, 1, 1),
    0.9
  );

  const leftPost = BABYLON.MeshBuilder.CreateBox(
    "leftPost_" + sid,
    { width: 0.4, height: 6, depth: 0.4 },
    scene
  );
  leftPost.position.set(-half, 3, 0);
  leftPost.material = pink;
  leftPost.parent = gate;

  const rightPost = BABYLON.MeshBuilder.CreateBox(
    "rightPost_" + sid,
    { width: 0.4, height: 6, depth: 0.4 },
    scene
  );
  rightPost.position.set(half, 3, 0);
  rightPost.material = cyan;
  rightPost.parent = gate;

  // Faixa com texto FINISH (frente e verso)
  const finishTex = new BABYLON.DynamicTexture(
    "finishText_" + sid,
    { width: 1024, height: 256 },
    scene,
    false
  );
  finishTex.hasAlpha = true;
  const ctx = finishTex.getContext();
  ctx.clearRect(0, 0, 1024, 256);
  ctx.fillStyle = "#1a0428";
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = "#ff4fd8";
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, 1000, 232);
  finishTex.update();
  finishTex.drawText(
    "FINISH",
    null,
    170,
    "bold 140px Segoe UI, Arial",
    "#b8f3ff",
    null,
    true
  );

  const bannerMat = new BABYLON.StandardMaterial(
    "finishBannerMat_" + sid,
    scene
  );
  bannerMat.diffuseTexture = finishTex;
  bannerMat.emissiveTexture = finishTex;
  bannerMat.emissiveColor = new BABYLON.Color3(0.7, 0.7, 0.7);
  // Sem segunda placa: evita flicker. Sem culling: continua visível na aproximação.
  bannerMat.backFaceCulling = false;

  const bannerWidth = Math.max(12, width - 2);
  const banner = BABYLON.MeshBuilder.CreatePlane(
    "finishBanner_" + sid,
    { width: bannerWidth, height: 1.6 },
    scene
  );
  banner.position.set(0, 5.4, 0);
  banner.material = bannerMat;
  banner.parent = gate;

  const stripeCount = Math.max(8, Math.round(width / 1.75));
  const stripeWidth = width / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const stripe = BABYLON.MeshBuilder.CreateBox(
      "finishStripe_" + sid + "_" + i,
      { width: stripeWidth * 0.92, height: 0.06, depth: 1.2 },
      scene
    );
    stripe.position.set(
      -half + stripeWidth * (i + 0.5),
      0.04,
      0
    );
    stripe.material = i % 2 === 0 ? white : pink;
    stripe.parent = gate;
  }

  return gate;
}

// Cache: altura × cor (paredes pretas, janelas já na cor neon)
const facadeTextureCache = {};

function colorToRgb(color, brightness) {
  const r = Math.round(Math.min(1, color.r * brightness) * 255);
  const g = Math.round(Math.min(1, color.g * brightness) * 255);
  const b = Math.round(Math.min(1, color.b * brightness) * 255);
  return "rgb(" + r + "," + g + "," + b + ")";
}

function getFacadeTexture(scene, bucket, colorIndex, color) {
  const key = bucket + "_" + colorIndex;
  if (facadeTextureCache[key]) return facadeTextureCache[key];

  const rowsByBucket = { short: 4, mid: 7, tall: 10 };
  const rows = rowsByBucket[bucket] || 7;
  const cols = 3;
  const sizeW = 256;
  const sizeH = 512;
  const tex = new BABYLON.DynamicTexture(
    "facade_" + key,
    { width: sizeW, height: sizeH },
    scene,
    true
  );
  const ctx = tex.getContext();

  // Fundo preto sólido (parede)
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#03030a";
  ctx.fillRect(0, 0, sizeW, sizeH);

  // Porta de vidro na cor neon
  const doorW = sizeW * 0.28;
  const doorH = sizeH * 0.11;
  ctx.fillStyle = colorToRgb(color, 0.9);
  ctx.fillRect((sizeW - doorW) / 2, sizeH - doorH - 8, doorW, doorH);
  ctx.strokeStyle = colorToRgb(color, 1);
  ctx.lineWidth = 3;
  ctx.strokeRect((sizeW - doorW) / 2, sizeH - doorH - 8, doorW, doorH);

  // Janelas coloridas (acesas / apagadas)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 1) continue;
      const lit = Math.random() > 0.22;
      ctx.fillStyle = lit
        ? colorToRgb(color, 0.75 + Math.random() * 0.35)
        : "#0c0c14";
      const cellW = sizeW / cols;
      const cellH = (sizeH * 0.82) / rows;
      const ww = cellW * 0.58;
      const wh = cellH * 0.48;
      const x = c * cellW + (cellW - ww) / 2;
      const y = 12 + r * cellH + (cellH - wh) / 2;
      ctx.fillRect(x, y, ww, wh);
    }
  }

  tex.hasAlpha = false;
  tex.update(true);
  facadeTextureCache[key] = tex;
  return tex;
}

function createBuilding(scene, position, neonColors, id) {
  const height = 6 + Math.random() * 18;
  const width = 3 + Math.random() * 3;
  const depth = 3 + Math.random() * 3;
  const group = new BABYLON.TransformNode("buildingGroup_" + id, scene);
  group.position.copyFrom(position);

  const colorIndex = Math.floor(Math.random() * neonColors.length);
  const color = neonColors[colorIndex];
  const bucket = height < 10 ? "short" : height < 16 ? "mid" : "tall";
  const facadeTex = getFacadeTexture(scene, bucket, colorIndex, color);

  const building = BABYLON.MeshBuilder.CreateBox(
    "building_" + id,
    { width: width, height: height, depth: depth },
    scene
  );
  building.position.y = height / 2;
  building.parent = group;

  const mat = new BABYLON.StandardMaterial("buildMat_" + id, scene);
  // Textura na diffuse (paredes pretas + janelas coloridas)
  // e um pouco na emissive (brilho neon só onde a textura é clara)
  mat.diffuseTexture = facadeTex;
  mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
  mat.emissiveTexture = facadeTex;
  mat.emissiveColor = new BABYLON.Color3(0.55, 0.55, 0.55);
  mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.08);
  mat.disableLighting = false;
  building.material = mat;

  return group;
}

function createPineTree(scene, position, id) {
  const group = new BABYLON.TransformNode("pine_" + id, scene);
  group.position.copyFrom(position);

  const trunkMat = new BABYLON.StandardMaterial("pineTrunk_" + id, scene);
  trunkMat.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.08);
  trunkMat.emissiveColor = new BABYLON.Color3(0.06, 0.03, 0.02);

  const leafMat = makeNeonMaterial(
    "pineLeaf_" + id,
    scene,
    new BABYLON.Color3(0.12, 0.55, 0.22),
    0.45
  );
  const ornamentMat = makeNeonMaterial(
    "pineOrnament_" + id,
    scene,
    id % 2 === 0
      ? new BABYLON.Color3(1, 0.2, 0.25)
      : new BABYLON.Color3(1, 0.85, 0.2),
    0.9
  );

  const trunk = BABYLON.MeshBuilder.CreateCylinder(
    "pineTrunkMesh_" + id,
    { diameter: 0.35, height: 1.4, tessellation: 8 },
    scene
  );
  trunk.position.y = 0.7;
  trunk.material = trunkMat;
  trunk.parent = group;

  // Copas em camadas (barato e legível)
  const layers = [
    { y: 2.0, d: 2.4 },
    { y: 3.1, d: 1.8 },
    { y: 4.0, d: 1.2 },
  ];
  layers.forEach(function (layer, i) {
    const cone = BABYLON.MeshBuilder.CreateCylinder(
      "pineCone_" + id + "_" + i,
      {
        diameterTop: 0.05,
        diameterBottom: layer.d,
        height: 1.35,
        tessellation: 10,
      },
      scene
    );
    cone.position.y = layer.y;
    cone.material = leafMat;
    cone.parent = group;
  });

  const star = BABYLON.MeshBuilder.CreateSphere(
    "pineStar_" + id,
    { diameter: 0.28, segments: 6 },
    scene
  );
  star.position.y = 4.75;
  star.material = ornamentMat;
  star.parent = group;

  return group;
}

function createSnowSidewalk(scene, sample, side, snowMat, index) {
  const group = new BABYLON.TransformNode(
    "snowWalk_" + index,
    scene
  );
  group.position.copyFrom(sample.position);
  group.rotation.y = yawFromTangent(sample.tangent);
  group.rotation.x = pitchFromTangent(sample.tangent);

  const snow = BABYLON.MeshBuilder.CreateGround(
    "snowPad_" + index,
    { width: 5.5, height: 8 },
    scene
  );
  // Fora da pista, perto dos prédios/pinheiros
  snow.position.set(side * 10.2, 0.02, 0);
  snow.material = snowMat;
  snow.parent = group;
  return group;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

const createScene = function () {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.02, 0.01, 0.08, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.006;
  scene.fogColor = new BABYLON.Color3(0.04, 0.02, 0.1);

  const hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  hemi.intensity = 0.35;
  hemi.groundColor = new BABYLON.Color3(0.05, 0.02, 0.1);

  const neonColors = [
    new BABYLON.Color3(1, 0.2, 0.85),
    new BABYLON.Color3(0.2, 0.9, 1),
    new BABYLON.Color3(0.5, 0.3, 1),
    new BABYLON.Color3(1, 0.5, 0.2),
  ];

  const roadMat = new BABYLON.StandardMaterial("roadMat", scene);
  roadMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.08);
  roadMat.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.07);

  const sandMat = new BABYLON.StandardMaterial("sandMat", scene);
  sandMat.diffuseColor = new BABYLON.Color3(0.72, 0.58, 0.32);
  sandMat.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.06);
  sandMat.specularColor = new BABYLON.Color3(0.08, 0.07, 0.04);

  const snowMat = new BABYLON.StandardMaterial("snowMat", scene);
  snowMat.diffuseColor = new BABYLON.Color3(0.85, 0.9, 0.98);
  snowMat.emissiveColor = new BABYLON.Color3(0.35, 0.4, 0.5);
  snowMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.25);

  const tapeMatA = makeNeonMaterial(
    "tapeMatA",
    scene,
    new BABYLON.Color3(1, 0.85, 0.15),
    0.75
  );
  const tapeMatB = makeNeonMaterial(
    "tapeMatB",
    scene,
    new BABYLON.Color3(1, 0.25, 0.2),
    0.7
  );

  const oceanMat = new BABYLON.StandardMaterial("oceanMat", scene);
  oceanMat.diffuseColor = new BABYLON.Color3(0.08, 0.35, 0.65);
  oceanMat.emissiveColor = new BABYLON.Color3(0.05, 0.28, 0.55);
  oceanMat.alpha = 0.88;
  oceanMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
  oceanMat.backFaceCulling = false;

  // Carrega o pacote de dados da pista ativa (mutável p/ trocar sem reload)
  let track = buildTrackFromData(getActiveTrackData());
  let path3D = track.path3D;
  let trackLength = track.trackLength;
  let finishSample = samplePath(path3D, track.finishDist);

  const themeEdge = track.data.theme.edgeColor;
  const edgeMat = makeNeonMaterial(
    "edgeMat",
    scene,
    new BABYLON.Color3(themeEdge[0], themeEdge[1], themeEdge[2]),
    1
  );

  const themeRoad = track.data.theme.roadEmissive;
  roadMat.emissiveColor = new BABYLON.Color3(
    themeRoad[0],
    themeRoad[1],
    themeRoad[2]
  );

  const roadPieces = [];
  const buildingGroups = [];
  const tunnelRings = [];
  const beachProps = [];
  let finishGate = null;
  let tunnelWallMat = null;
  let tunnelNeonMat = null;

  function getTunnelRange() {
    const feat =
      track.data.features && track.data.features.tunnel
        ? track.data.features.tunnel
        : null;
    if (!feat || !feat.startPoint || !feat.endPoint) return null;
    const startPos = BABYLON.Vector3.FromArray(feat.startPoint);
    const endPos = BABYLON.Vector3.FromArray(feat.endPoint);
    const startDist = path3D.getDistanceAt(
      path3D.getClosestPositionTo(startPos)
    );
    const endDist = path3D.getDistanceAt(
      path3D.getClosestPositionTo(endPos)
    );
    return {
      startDist: Math.min(startDist, endDist),
      endDist: Math.max(startDist, endDist),
    };
  }

  function clearTrackWorld() {
    while (roadPieces.length) {
      const piece = roadPieces.pop();
      if (piece) piece.dispose();
    }
    while (buildingGroups.length) {
      const group = buildingGroups.pop();
      if (group) group.dispose();
    }
    while (tunnelRings.length) {
      const ring = tunnelRings.pop();
      if (ring) ring.dispose();
    }
    while (beachProps.length) {
      const prop = beachProps.pop();
      if (prop) prop.dispose();
    }
    if (finishGate) {
      finishGate.dispose();
      finishGate = null;
    }
  }

  function buildTrackWorld() {
    const features = track.data.features || {};
    const isBeach = !!features.beach;
    const step = 7;
    let pieceIndex = 0;

    if (isBeach) {
      // Um único chão de areia — sem fendas pretas entre pedaços
      beachProps.push(
        createBeachSandField(scene, path3D, trackLength, sandMat)
      );
      for (let d = 0; d < trackLength; d += step) {
        if (d < track.startDist - 5 || d > track.finishDist + 20) {
          continue;
        }
        const sample = samplePath(path3D, d);
        beachProps.push(
          createBeachTape(scene, sample, -1, tapeMatA, tapeMatB)
        );
        beachProps.push(
          createBeachTape(scene, sample, 1, tapeMatA, tapeMatB)
        );
      }
    } else {
      const roadWidth = features.roadWidth || 14;
      for (let d = 0; d < trackLength; d += step) {
        roadPieces.push(
          createRoadPiece(
            scene,
            samplePath(path3D, d),
            roadMat,
            edgeMat,
            pieceIndex++,
            roadWidth
          )
        );
      }
    }

    finishSample = samplePath(path3D, track.finishDist);
    finishGate = createFinishLine(
      scene,
      finishSample,
      features.roadWidth || 14
    );

    const tunnel = getTunnelRange();

    // Túnel: anéis espaçados (leve — sem prédios dentro)
    if (tunnel) {
      if (!tunnelWallMat) {
        tunnelWallMat = new BABYLON.StandardMaterial(
          "tunnelWallMat",
          scene
        );
        tunnelWallMat.diffuseColor = new BABYLON.Color3(0.06, 0.08, 0.12);
        tunnelWallMat.emissiveColor = new BABYLON.Color3(0.03, 0.05, 0.08);
      }
      if (!tunnelNeonMat) {
        tunnelNeonMat = makeNeonMaterial(
          "tunnelNeonMat",
          scene,
          new BABYLON.Color3(0.2, 1, 0.85),
          0.95
        );
      }
      for (
        let d = tunnel.startDist;
        d <= tunnel.endDist;
        d += step * 1.4
      ) {
        tunnelRings.push(
          createTunnelRing(
            scene,
            samplePath(path3D, d),
            tunnelWallMat,
            tunnelNeonMat
          )
        );
      }
    }

    // Mar logo após a chegada (praia): faixa larga, não um “quadrado”
    if (typeof features.oceanAfterFinish === "number") {
      const oceanDist =
        track.finishDist + Math.max(10, features.oceanAfterFinish);
      beachProps.push(
        createOceanPlane(
          scene,
          samplePath(path3D, Math.min(trackLength - 1, oceanDist)),
          oceanMat
        )
      );
    }

    // Oval speedway: arquibancada/muro visual + gramado interno
    if (features.ovalArena) {
      const roadWidth = features.roadWidth || 28;
      const roadHalf = roadWidth / 2;
      const bermMat = new BABYLON.StandardMaterial("ovalBermMat", scene);
      bermMat.diffuseColor = new BABYLON.Color3(0.22, 0.14, 0.1);
      bermMat.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.03);
      const wallMat = new BABYLON.StandardMaterial("ovalWallMat", scene);
      wallMat.diffuseColor = new BABYLON.Color3(0.08, 0.09, 0.14);
      wallMat.emissiveColor = new BABYLON.Color3(0.05, 0.06, 0.1);
      const seatMat = new BABYLON.StandardMaterial("ovalSeatMat", scene);
      seatMat.diffuseColor = new BABYLON.Color3(0.35, 0.12, 0.1);
      seatMat.emissiveColor = new BABYLON.Color3(0.18, 0.05, 0.04);
      const ovalMats = {
        berm: bermMat,
        wall: wallMat,
        seat: seatMat,
        neon: edgeMat,
      };

      let cx = 0;
      let cz = 0;
      let samples = 0;
      for (let d = 0; d < trackLength; d += 18) {
        const p = path3D.getPointAt(
          Math.max(0, Math.min(1, d / trackLength))
        );
        cx += p.x;
        cz += p.z;
        samples += 1;
      }
      cx /= Math.max(1, samples);
      cz /= Math.max(1, samples);
      const center = new BABYLON.Vector3(cx, 0, cz);

      const infieldMat = new BABYLON.StandardMaterial(
        "ovalInfieldMat",
        scene
      );
      infieldMat.diffuseColor = new BABYLON.Color3(0.08, 0.16, 0.1);
      infieldMat.emissiveColor = new BABYLON.Color3(0.03, 0.08, 0.04);
      const infield = BABYLON.MeshBuilder.CreateGround(
        "ovalInfield",
        { width: 150, height: 240 },
        scene
      );
      infield.position.set(cx, -0.05, cz);
      infield.material = infieldMat;
      beachProps.push(infield);

      let standId = 0;
      // Arquibancada nos dois lados (bowl) — sempre visível
      for (let d = 0; d < trackLength; d += step) {
        const sample = samplePath(path3D, d);
        [-1, 1].forEach(function (dir) {
          beachProps.push(
            createOvalGrandstand(
              scene,
              sample,
              dir,
              roadHalf,
              standId++,
              ovalMats
            )
          );
        });
      }

      // Prédios atrás do muro (fora do bowl)
      let buildingId = 0;
      for (let d = 20; d < trackLength; d += 28) {
        const sample = samplePath(path3D, d);
        const side = sample.binormal;
        [-1, 1].forEach(function (dir) {
          const pos = sample.position.add(
            side.scale(dir * (roadHalf + 18 + (buildingId % 3)))
          );
          buildingGroups.push(
            createBuilding(scene, pos, neonColors, buildingId++)
          );
        });
      }
      return;
    }

    if (features.noBuildings) {
      return;
    }

    const isChristmas = !!features.christmas;
    // Natal: menos props e mais espaçados (prédio / pinheiro)
    const sceneryStep = isChristmas ? 20 : 14;
    let buildingId = 0;
    let sceneryIndex = 0;

    for (let d = 10; d < trackLength; d += sceneryStep) {
      if (
        tunnel &&
        d >= tunnel.startDist - 6 &&
        d <= tunnel.endDist + 6
      ) {
        continue;
      }
      const sample = samplePath(path3D, d);
      const side = sample.binormal;

      if (isChristmas) {
        beachProps.push(
          createSnowSidewalk(scene, sample, -1, snowMat, sceneryIndex)
        );
        beachProps.push(
          createSnowSidewalk(scene, sample, 1, snowMat, sceneryIndex + 10000)
        );
      }

      // Ao longo da pista: prédio, pinheiro, prédio, pinheiro...
      const usePine =
        isChristmas &&
        Math.floor((d - 10) / sceneryStep) % 2 === 1;

      [-1, 1].forEach(function (dir) {
        const pos = sample.position.add(
          side.scale(dir * (12 + Math.random() * 6))
        );
        if (usePine) {
          buildingGroups.push(createPineTree(scene, pos, buildingId++));
        } else {
          buildingGroups.push(
            createBuilding(scene, pos, neonColors, buildingId++)
          );
        }
      });
      sceneryIndex += 1;
    }
  }

  function applyTrackTheme(trackData) {
    const edge = trackData.theme.edgeColor;
    const edgeColor = new BABYLON.Color3(edge[0], edge[1], edge[2]);
    edgeMat.diffuseColor = edgeColor.scale(0.25);
    edgeMat.emissiveColor = edgeColor.scale(1);
    const road = trackData.theme.roadEmissive;
    roadMat.emissiveColor = new BABYLON.Color3(road[0], road[1], road[2]);
    if (trackData.features && trackData.features.beach) {
      sandMat.emissiveColor = new BABYLON.Color3(
        road[0],
        road[1],
        road[2]
      );
    }
    scene.fogDensity = 0.006;
  }

  buildTrackWorld();

  // --- Pilotos ---
  // Opção C: mesma física, mas IA humana (alivia curva + erra direção)
  function makeRacer(id, name, carModelId, isPlayer, aiStyle, colorOverride) {
    const def = getCarDef(carModelId);
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
      mesh: createCarByModel(
        scene,
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
  }

  let equippedCarId = loadEquippedCarId();
  refreshEquippedCarLabel();

  const player = makeRacer(
    "player",
    "Você",
    equippedCarId,
    true,
    null
  );

  const RIVAL_DEFS = [
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

  const rivals = RIVAL_DEFS.map(function (def) {
    return makeRacer(def.id, def.name, "starter", false, def);
  });
  rivals.forEach(function (rival) {
    rival.mesh.setEnabled(false);
  });

  let racers = [player].concat(rivals.slice(0, 2));

  function getTrackBotCount() {
    const feat = track.data && track.data.features;
    if (feat && typeof feat.botCount === "number" && feat.botCount > 0) {
      return Math.min(rivals.length, Math.floor(feat.botCount));
    }
    return 2;
  }

  function getActiveRivals() {
    return rivals.slice(0, getTrackBotCount());
  }

  function syncActiveRacers() {
    const active = getActiveRivals();
    racers = [player].concat(active);
    rivals.forEach(function (rival, i) {
      const on = i < active.length;
      if (!on) {
        rival.mesh.setEnabled(false);
        rival.speed = 0;
      }
    });
    return active;
  }

  function getFieldSize() {
    return 1 + getTrackBotCount();
  }

  // Bots: qualquer carro do catálogo, com peso por raridade
  const BOT_RARITY_WEIGHTS = {
    common: 70,
    epic: 22,
    legendary: 8,
  };

  function pickBotCarId(excludeIds) {
    const exclude = excludeIds || [];
    const byRarity = { common: [], epic: [], legendary: [] };
    Object.keys(window.NEON_RUSH_CARS || {}).forEach(function (id) {
      if (exclude.indexOf(id) !== -1) return;
      const car = window.NEON_RUSH_CARS[id];
      if (byRarity[car.rarity]) byRarity[car.rarity].push(id);
    });

    const options = Object.keys(BOT_RARITY_WEIGHTS)
      .map(function (rarity) {
        return {
          rarity: rarity,
          weight: BOT_RARITY_WEIGHTS[rarity],
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
  }

  function rebuildRivalCar(racer, carId) {
    const old = racer.mesh;
    const wasEnabled = old.isEnabled();
    const rotY = old.rotation.y;
    const pos = old.position.clone();
    old.dispose();
    const def = getCarDef(carId);
    racer.carModelId = carId;
    racer.mesh = createCarByModel(
      scene,
      def.model,
      racer.id,
      BABYLON.Color3.FromArray(def.bodyColor),
      BABYLON.Color3.FromArray(def.accentColor)
    );
    racer.mesh.position.copyFrom(pos);
    racer.mesh.rotation.y = rotY;
    racer.mesh.setEnabled(wasEnabled);
  }

  function assignBotCarsForRace() {
    const active = syncActiveRacers();
    // Benchmark: carro fixo (starter) para medir personalidade, não o modelo
    if (botBench.active) {
      active.forEach(function (rival) {
        rebuildRivalCar(rival, "starter");
      });
      return;
    }
    const used = [];
    active.forEach(function (rival) {
      let carId = pickBotCarId(used);
      if (!carId) carId = pickBotCarId();
      used.push(carId);
      rebuildRivalCar(rival, carId);
    });
  }

  let garagePreviewId = null;
  let garageOpen = false;
  let garageIndex = 0;
  let shopOpen = false;

  function getGarageCarIds() {
    return Object.keys(window.NEON_RUSH_CARS || {});
  }

  function rebuildPlayerCar(carId, options) {
    const opts = options || {};
    const saveEquip = opts.saveEquip !== false;
    const old = player.mesh;
    const wasEnabled = old.isEnabled();
    const rotY = old.rotation.y;
    const pos = old.position.clone();
    old.dispose();
    const def = getCarDef(carId);
    player.carModelId = carId;
    player.mesh = createCarByModel(
      scene,
      def.model,
      "player",
      BABYLON.Color3.FromArray(def.bodyColor),
      BABYLON.Color3.FromArray(def.accentColor)
    );
    player.mesh.position.copyFrom(pos);
    player.mesh.rotation.y = rotY;
    player.mesh.setEnabled(wasEnabled);
    player.flashMats = null;
    player.collisionFlashOn = false;
    player.collisionBlinkT = 0;
    camera.lockedTarget = player.mesh;
    if (saveEquip) {
      equippedCarId = carId;
      saveEquippedCarId(carId);
      garagePreviewId = null;
    }
    if (!garageOpen && !shopOpen) refreshEquippedCarLabel();
  }

  function updateGarageHud() {
    const ids = getGarageCarIds();
    const carId = ids[garageIndex];
    if (!carId) return;
    const def = getCarDef(carId);
    const rarity =
      window.NEON_RUSH_RARITIES &&
      window.NEON_RUSH_RARITIES[def.rarity];
    const owned = loadOwnedCars();
    const isOwned = owned.indexOf(carId) !== -1;
    const isEquipped = carId === equippedCarId && !garagePreviewId;

    const nameEl = document.getElementById("garageCarName");
    const rarityEl = document.getElementById("garageCarRarity");
    const statusEl = document.getElementById("garageCarStatus");
    const indexEl = document.getElementById("garageCarIndex");
    const equipBtn = document.getElementById("btnGarageEquip");

    nameEl.textContent = def.name;
    rarityEl.textContent = rarity ? rarity.name : "";
    rarityEl.style.color = rarity ? rarity.color : "#b8f3ff";
    indexEl.textContent = garageIndex + 1 + " / " + ids.length;

    statusEl.classList.remove("locked", "equipped");
    if (!isOwned) {
      statusEl.textContent = "BLOQUEADO";
      statusEl.classList.add("locked");
      equipBtn.disabled = true;
      equipBtn.textContent = "Bloqueado";
    } else if (isEquipped || carId === equippedCarId) {
      statusEl.textContent = "EQUIPADO";
      statusEl.classList.add("equipped");
      equipBtn.disabled = true;
      equipBtn.textContent = "Equipado";
    } else {
      statusEl.textContent = "Disponível";
      equipBtn.disabled = false;
      equipBtn.textContent = "Equipar";
    }
  }

  function showGarageCarAt(index, options) {
    if (!inMenu || perfTestRunning) return;
    const opts = options || {};
    const ids = getGarageCarIds();
    if (!ids.length) return;
    const spinY = getHubSpinY();
    garageIndex = ((index % ids.length) + ids.length) % ids.length;
    const carId = ids[garageIndex];
    const owned = loadOwnedCars();
    const isOwned = owned.indexOf(carId) !== -1;

    if (isOwned && opts.equip) {
      rebuildPlayerCar(carId, { saveEquip: true });
    } else if (isOwned && carId === equippedCarId) {
      garagePreviewId = null;
      if (player.carModelId !== carId) {
        rebuildPlayerCar(carId, { saveEquip: true });
      }
    } else if (isOwned) {
      // Preview de carro próprio sem equipar ainda
      garagePreviewId = carId;
      rebuildPlayerCar(carId, { saveEquip: false });
    } else {
      garagePreviewId = carId;
      rebuildPlayerCar(carId, { saveEquip: false });
    }

    refreshMenuDisplay({
      resetView: !!opts.resetView,
      spinY: spinY,
    });
    updateGarageHud();
  }

  function stepGarage(delta) {
    if (!garageOpen) return;
    showGarageCarAt(garageIndex + delta);
  }

  function equipGarageCar() {
    if (!garageOpen || !inMenu || perfTestRunning) return;
    const ids = getGarageCarIds();
    const carId = ids[garageIndex];
    if (!carId) return;
    const owned = loadOwnedCars();
    if (owned.indexOf(carId) === -1) return;
    const spinY = getHubSpinY();
    rebuildPlayerCar(carId, { saveEquip: true });
    refreshMenuDisplay({ resetView: false, spinY: spinY });
    updateGarageHud();
  }

  function openGarage() {
    if (!inMenu || perfTestRunning) return;
    closeShop({ restoreCar: false });
    garagePreviewId = null;
    const ids = getGarageCarIds();
    const idx = ids.indexOf(equippedCarId);
    garageIndex = idx >= 0 ? idx : 0;
    garageOpen = true;
    document.getElementById("mainMenu").classList.add("garage-open");
    const panel = document.getElementById("garagePanel");
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    showGarageCarAt(garageIndex, { resetView: false });
    syncMobileControlsVisibility();
  }

  function closeGarage(options) {
    const opts = options || {};
    const restoreCar = opts.restoreCar !== false;
    const panel = document.getElementById("garagePanel");
    if (restoreCar && garagePreviewId) {
      rebuildPlayerCar(equippedCarId, { saveEquip: true });
      placeGrid();
      enterMenuCamera();
      garagePreviewId = null;
    }
    garageOpen = false;
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    document.getElementById("mainMenu").classList.remove("garage-open");
    if (restoreCar) refreshEquippedCarLabel();
    syncMobileControlsVisibility();
  }

  // —— Loja: 5 ofertas; itens preenchem quando faltam carros ——
  const SHOP_OFFER_COUNT = 5;
  let shopOffers = []; // car | item
  let shopIndex = 0;
  let shopPreviewId = null;
  let shopItemPreview = null;
  let shopItemPreviewId = null;

  function disposeShopItemPreview() {
    if (shopItemPreview) {
      shopItemPreview.dispose();
      shopItemPreview = null;
    }
    shopItemPreviewId = null;
  }

  function hideShopItemPreview() {
    disposeShopItemPreview();
    if (player && player.mesh) player.mesh.setEnabled(true);
  }

  function placeShopItemPreview() {
    if (!shopItemPreview || !player || !player.mesh) return;
    shopItemPreview.position.copyFrom(player.mesh.position);
    shopItemPreview.position.y += 0.02;
  }

  function showShopItemPreview(itemId) {
    try {
      if (shopItemPreviewId !== itemId || !shopItemPreview) {
        disposeShopItemPreview();
        shopItemPreview = createShopItemPreview(scene, itemId);
        shopItemPreviewId = itemId;
      }
      placeShopItemPreview();
    } catch (err) {
      console.error("Falha na prévia do item:", itemId, err);
      disposeShopItemPreview();
    }
    // Sempre esconde o carro na oferta de item
    if (player && player.mesh) player.mesh.setEnabled(false);
  }

  const SHOP_FILLER_ITEMS = {
    multiplier: {
      id: "multiplier",
      name: "Multiplicador ×3",
      color: "#39ff9f",
      blurb: "Próxima corrida: moedas ×3",
      rollPrice: function () {
        return COIN_MULTIPLIER_PRICE;
      },
      canOffer: function () {
        return !hasPendingCoinMultiplier();
      },
      activate: activateCoinMultiplier,
    },
    "calibrated-tire": {
      id: "calibrated-tire",
      name: "Pneu calibrado",
      color: "#7ec8ff",
      blurb:
        "Próxima corrida: vel. máx. +" + CALIBRATED_TIRE_BONUS_PCT + "%",
      rollPrice: function () {
        return rollPriceBetween(
          CALIBRATED_TIRE_PRICE_MIN,
          CALIBRATED_TIRE_PRICE_MAX
        );
      },
      canOffer: function () {
        return !hasPendingCalibratedTire();
      },
      activate: activateCalibratedTire,
    },
  };

  function getUnownedCarIds(excludeIds) {
    const owned = loadOwnedCars();
    const blocked = excludeIds || [];
    return Object.keys(window.NEON_RUSH_CARS || {}).filter(function (id) {
      return owned.indexOf(id) === -1 && blocked.indexOf(id) === -1;
    });
  }

  function makeCarOffer(carId) {
    return {
      kind: "car",
      carId: carId,
      price: window.neonRushRollCarPrice
        ? window.neonRushRollCarPrice(carId)
        : 100,
    };
  }

  function makeItemOffer(itemId) {
    const item = SHOP_FILLER_ITEMS[itemId];
    return {
      kind: "item",
      itemId: itemId,
      price: item.rollPrice(),
    };
  }

  function getOfferableFillerIds() {
    return Object.keys(SHOP_FILLER_ITEMS).filter(function (id) {
      return SHOP_FILLER_ITEMS[id].canOffer();
    });
  }

  function pickRandomFillerOffer() {
    const ids = getOfferableFillerIds();
    if (!ids.length) return null;
    const itemId = ids[Math.floor(Math.random() * ids.length)];
    return makeItemOffer(itemId);
  }

  function padShopOffersWithItems() {
    while (shopOffers.length < SHOP_OFFER_COUNT) {
      const offer = pickRandomFillerOffer();
      if (!offer) break;
      shopOffers.push(offer);
    }
  }

  function rollShopOffers() {
    const pool = shuffleArray(getUnownedCarIds());
    const picked = pool.slice(0, SHOP_OFFER_COUNT);
    shopOffers = picked.map(makeCarOffer);
    padShopOffersWithItems();
    shopIndex = 0;
  }

  function pickReplacementOffer() {
    const inOffers = shopOffers
      .filter(function (o) {
        return o.kind === "car";
      })
      .map(function (o) {
        return o.carId;
      });
    const pool = shuffleArray(getUnownedCarIds(inOffers));
    if (pool.length) return makeCarOffer(pool[0]);
    return pickRandomFillerOffer();
  }

  function stripItemOffersOfType(itemId) {
    shopOffers = shopOffers.filter(function (o) {
      return !(o.kind === "item" && o.itemId === itemId);
    });
    if (shopIndex >= shopOffers.length) {
      shopIndex = Math.max(0, shopOffers.length - 1);
    }
  }

  function isItemOffer(offer) {
    return offer && offer.kind === "item";
  }

  function updateShopHud() {
    const nameEl = document.getElementById("shopCarName");
    const rarityEl = document.getElementById("shopCarRarity");
    const priceEl = document.getElementById("shopCarPrice");
    const indexEl = document.getElementById("shopOfferIndex");
    const emptyEl = document.getElementById("shopEmptyMsg");
    const buyBtn = document.getElementById("btnShopBuy");
    const prevBtn = document.getElementById("btnShopPrev");
    const nextBtn = document.getElementById("btnShopNext");
    const dots = document.getElementById("shopOfferDots");

    dots.innerHTML = "";

    if (!shopOffers.length) {
      nameEl.textContent = "Loja";
      rarityEl.textContent = "";
      priceEl.textContent = "";
      priceEl.classList.remove("cant-afford");
      indexEl.textContent = "";
      emptyEl.hidden = false;
      emptyEl.textContent =
        hasPendingCoinMultiplier() || hasPendingCalibratedTire()
          ? "Sem ofertas — use seus itens na próxima corrida!"
          : "Sem ofertas agora — você já tem todos!";
      buyBtn.disabled = true;
      buyBtn.textContent = "Comprar";
      prevBtn.style.visibility = "hidden";
      nextBtn.style.visibility = "hidden";
      return;
    }

    emptyEl.hidden = true;
    prevBtn.style.visibility = shopOffers.length > 1 ? "visible" : "hidden";
    nextBtn.style.visibility = shopOffers.length > 1 ? "visible" : "hidden";

    const offer = shopOffers[shopIndex];
    const canAfford = coins >= offer.price;

    if (isItemOffer(offer)) {
      const item = SHOP_FILLER_ITEMS[offer.itemId];
      nameEl.textContent = item.name;
      rarityEl.textContent = item.blurb;
      rarityEl.style.color = item.color;
    } else {
      const def = getCarDef(offer.carId);
      const rarity =
        window.NEON_RUSH_RARITIES &&
        window.NEON_RUSH_RARITIES[def.rarity];
      nameEl.textContent = def.name;
      rarityEl.textContent = rarity ? rarity.name : "";
      rarityEl.style.color = rarity ? rarity.color : "#b8f3ff";
    }

    priceEl.textContent = offer.price + " moedas";
    priceEl.classList.toggle("cant-afford", !canAfford);
    indexEl.textContent =
      "Oferta " + (shopIndex + 1) + " / " + shopOffers.length;

    buyBtn.disabled = !canAfford;
    buyBtn.textContent = canAfford ? "Comprar" : "Sem moedas";

    shopOffers.forEach(function (_offer, i) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className =
        "shop-offer-dot" + (i === shopIndex ? " active" : "");
      dot.setAttribute("aria-label", "Oferta " + (i + 1));
      dot.addEventListener("click", function () {
        showShopOfferAt(i);
      });
      dots.appendChild(dot);
    });
  }

  function showShopOfferAt(index, options) {
    if (!shopOpen || !inMenu || perfTestRunning) return;
    const opts = options || {};
    const spinY = getHubSpinY();
    if (!shopOffers.length) {
      shopPreviewId = null;
      hideShopItemPreview();
      rebuildPlayerCar(equippedCarId, { saveEquip: true });
      refreshMenuDisplay({
        resetView: !!opts.resetView,
        spinY: spinY,
      });
      updateShopHud();
      return;
    }
    shopIndex =
      ((index % shopOffers.length) + shopOffers.length) %
      shopOffers.length;
    const offer = shopOffers[shopIndex];

    if (isItemOffer(offer)) {
      shopPreviewId = null;
      if (player.carModelId !== equippedCarId) {
        rebuildPlayerCar(equippedCarId, { saveEquip: true });
      }
      showShopItemPreview(offer.itemId);
    } else {
      hideShopItemPreview();
      shopPreviewId = offer.carId;
      rebuildPlayerCar(offer.carId, { saveEquip: false });
    }

    refreshMenuDisplay({
      resetView: !!opts.resetView,
      spinY: spinY,
    });
    updateShopHud();
  }

  function stepShop(delta) {
    if (!shopOpen || shopOffers.length < 2) return;
    showShopOfferAt(shopIndex + delta);
  }

  function buyShopOffer() {
    if (!shopOpen || !inMenu || perfTestRunning) return;
    const offer = shopOffers[shopIndex];
    if (!offer) return;
    if (coins < offer.price) return;

    if (isItemOffer(offer)) {
      const item = SHOP_FILLER_ITEMS[offer.itemId];
      if (!item || !item.canOffer()) return;
      coins -= offer.price;
      saveCoins(coins);
      item.activate();
      refreshMoneyLabel();
    } else {
      if (loadOwnedCars().indexOf(offer.carId) !== -1) return;
      coins -= offer.price;
      saveCoins(coins);
      refreshMoneyLabel();
      purchaseCar(offer.carId);
    }

    const boughtItemId = isItemOffer(offer) ? offer.itemId : null;

    const replacement = pickReplacementOffer();
    if (replacement) {
      shopOffers[shopIndex] = replacement;
    } else {
      shopOffers.splice(shopIndex, 1);
      if (shopIndex >= shopOffers.length) {
        shopIndex = Math.max(0, shopOffers.length - 1);
      }
    }

    // Item ativado: remove cópias iguais da vitrine
    if (boughtItemId) {
      stripItemOffersOfType(boughtItemId);
    }

    showShopOfferAt(shopIndex);
  }

  function openShop() {
    if (!inMenu || perfTestRunning) return;
    closeGarage({ restoreCar: false });
    rollShopOffers();
    shopOpen = true;
    document.getElementById("mainMenu").classList.add("shop-open");
    const panel = document.getElementById("shopPanel");
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    showShopOfferAt(0, { resetView: false });
    syncMobileControlsVisibility();
  }

  function closeShop(options) {
    const opts = options || {};
    const restoreCar = opts.restoreCar !== false;
    const panel = document.getElementById("shopPanel");
    const hadItemPreview = !!shopItemPreview;
    hideShopItemPreview();
    if (restoreCar && (shopPreviewId || shopOpen || hadItemPreview)) {
      rebuildPlayerCar(equippedCarId, { saveEquip: true });
      placeGrid();
      enterMenuCamera();
    }
    shopPreviewId = null;
    shopOpen = false;
    shopOffers = [];
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    document.getElementById("mainMenu").classList.remove("shop-open");
    if (restoreCar) refreshEquippedCarLabel();
    syncMobileControlsVisibility();
  }

  const camera = new BABYLON.FollowCamera(
    "marioKartCam",
    new BABYLON.Vector3(0, 12, -16),
    scene,
    player.mesh
  );
  camera.radius = 14;
  camera.heightOffset = 10;
  camera.rotationOffset = 180;
  camera.cameraAcceleration = 0.05;
  camera.maxCameraSpeed = 20;
  camera.inputs.clear();

  // Câmera do hub: carro no centro, girando (estilo Brawl Stars)
  const menuCamera = new BABYLON.ArcRotateCamera(
    "menuCam",
    -Math.PI / 2,
    1.15,
    8.5,
    player.mesh.position,
    scene
  );
  menuCamera.lowerRadiusLimit = 7;
  menuCamera.upperRadiusLimit = 11;
  menuCamera.wheelPrecision = 40;
  menuCamera.panningSensibility = 0;
  menuCamera.inputs.clear();

  // Âncora fixa: a FollowCamera desacelera até ela (parada suave)
  const cameraAnchor = new BABYLON.TransformNode("cameraAnchor", scene);
  let finishCameraLocked = false;

  function lockCameraAtFinish() {
    if (finishCameraLocked) return;
    finishCameraLocked = true;
    // Fixa onde o carro estava ao cruzar — a câmera ainda "chega" com suavidade
    cameraAnchor.position.copyFrom(player.mesh.position);
    cameraAnchor.rotation.y = player.mesh.rotation.y;
    camera.lockedTarget = cameraAnchor;
    camera.cameraAcceleration = 0.025;
    camera.maxCameraSpeed = 6;
  }

  function unlockCameraFollow() {
    finishCameraLocked = false;
    camera.lockedTarget = player.mesh;
    camera.cameraAcceleration = 0.05;
    camera.maxCameraSpeed = 20;
    camera.radius = 14;
    camera.heightOffset = 10;
    camera.rotationOffset = 180;
  }

  function setRivalVisibility(visible) {
    getActiveRivals().forEach(function (rival) {
      rival.mesh.setEnabled(visible);
    });
    rivals.slice(getTrackBotCount()).forEach(function (rival) {
      rival.mesh.setEnabled(false);
    });
  }

  function getHubSpinY() {
    if (shopItemPreview) return shopItemPreview.rotation.y;
    if (player && player.mesh) return player.mesh.rotation.y;
    return 0;
  }

  function refreshMenuDisplay(options) {
    const opts = options || {};
    const resetView = !!opts.resetView;
    const spinY =
      opts.spinY != null ? opts.spinY : getHubSpinY();

    placeGrid();
    setRivalVisibility(false);

    if (shopItemPreview) {
      placeShopItemPreview();
      player.mesh.setEnabled(false);
      shopItemPreview.rotation.y = spinY;
    } else if (player && player.mesh) {
      player.mesh.setEnabled(true);
      player.mesh.rotation.z = 0;
      player.mesh.rotation.y = spinY;
    }

    // O enquadramento usa a base da vitrine, independente da prévia.
    // A altura do item não deve mover a câmera ao alternar ofertas.
    menuCamera.setTarget(
      player.mesh.position.add(new BABYLON.Vector3(0, 0.6, 0))
    );
    if (resetView) {
      menuCamera.alpha = -Math.PI / 2;
      menuCamera.beta = 1.15;
      menuCamera.radius = 8.5;
    }
    scene.activeCamera = menuCamera;
  }

  function enterMenuCamera() {
    refreshMenuDisplay({ resetView: true });
  }

  function enterRaceCamera() {
    setRivalVisibility(true);
    unlockCameraFollow();
    scene.activeCamera = camera;
  }

  let raceTime = 0;
  let raceOver = false;
  const finishOrder = [];
  let inMenu = true;
  let countdownActive = false;
  let countdownTimer = 0;
  let countdownStep = 0; // 0=3, 1=2, 2=1
  let goDisplayTimer = 0;
  const countdownLabels = ["3", "2", "1"];

  function placeRacer(racer, distance, lateral) {
    const sample = samplePath(path3D, Math.max(0, distance));
    const pos = sample.position.add(sample.binormal.scale(lateral));
    racer.mesh.position.copyFrom(pos);
    racer.mesh.rotation.y = yawFromTangent(sample.tangent);
    racer.mesh.rotation.x = pitchFromTangent(sample.tangent);
    racer.mesh.rotation.z = 0;
    racer.speed = 0;
    racer.distAlong = distanceAlongPath(path3D, racer.mesh.position);
    racer.lapsCompleted = 0;
    racer.lapArmed = false;
    racer.pathHint = racer.distAlong;
    racer.progress =
      track.totalLaps > 1
        ? raceProgressFromLaps(racer, track)
        : raceProgressFromDistance(racer.distAlong, track);
    racer.finished = false;
    racer.finishTime = null;
    racer.againstWall = false;
    racer.wallHitCooldown = 0;
    racer.collisionBlinkT = 0;
    setRacerCollisionFlash(racer, false);
    if (racer.mesh) racer.mesh.setEnabled(true);
    racer.bench = {
      wallHits: 0,
      scrapeTime: 0,
      stuckTime: 0,
      distTraveled: 0,
    };
    // Ainda "antes" da linha de chegada
    racer.prevFinishSide = -1;
  }

  function wrapRacerToLapStart(racer) {
    const sampleNow = samplePath(
      path3D,
      racer.pathHint != null ? racer.pathHint : racer.distAlong
    );
    const lateral = BABYLON.Vector3.Dot(
      racer.mesh.position.subtract(sampleNow.position),
      sampleNow.binormal
    );
    const sample = samplePath(path3D, track.startDist + 3);
    racer.mesh.position.copyFrom(
      sample.position.add(sample.binormal.scale(lateral))
    );
    racer.mesh.rotation.y = yawFromTangent(sample.tangent);
    racer.mesh.rotation.x = pitchFromTangent(sample.tangent);
    racer.distAlong = track.startDist + 3;
    racer.pathHint = track.startDist + 3;
    racer.lapArmed = false;
    racer.prevFinishSide = 1;
  }

  function placeGrid() {
    placeRacer(player, track.startDist, 0);
    getActiveRivals().forEach(function (rival) {
      placeRacer(rival, track.startDist, rival.preferredLane || 0);
    });
  }

  function syncMobileControlsVisibility() {
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
      !botBench.active &&
      !perfTestRunning &&
      (!inMenu || garageOpen || shopOpen || raceOver);
    if (typeof window.setMobileControlsVisible === "function") {
      window.setMobileControlsVisible(show);
    }
  }

  const virtualEdgePrev = { left: false, right: false };
  function pollVirtualEdge(side) {
    const vc = getVirtualControls();
    const now = !!vc[side];
    const pressed = now && !virtualEdgePrev[side];
    virtualEdgePrev[side] = now;
    return pressed;
  }

  function handleVirtualMenuActions() {
    const leftPressed = pollVirtualEdge("left");
    const rightPressed = pollVirtualEdge("right");

    if (raceOver && !botBench.active && consumeVirtualConfirm()) {
      showMainMenu();
      return;
    }
    if (!inMenu) {
      consumeVirtualConfirm();
      consumeVirtualBack();
      return;
    }
    if (shopOpen) {
      if (leftPressed) stepShop(-1);
      if (rightPressed) stepShop(1);
      if (consumeVirtualConfirm()) buyShopOffer();
      if (consumeVirtualBack()) closeShop();
      return;
    }
    if (garageOpen) {
      if (leftPressed) stepGarage(-1);
      if (rightPressed) stepGarage(1);
      if (consumeVirtualConfirm()) equipGarageCar();
      if (consumeVirtualBack()) closeGarage();
      return;
    }
    consumeVirtualConfirm();
    consumeVirtualBack();
  }

  function showMainMenu() {
    inMenu = true;
    raceOver = false;
    countdownActive = false;
    goDisplayTimer = 0;
    GameAudio.stopEngines();
    player.maxSpeed = PHYSICS.maxSpeed;
    finishOrder.length = 0;
    rankingPanel.classList.remove("show", "centered", "racing");
    rankingHint.classList.remove("show");
    rankingList.innerHTML = "";
    countdownOverlay.classList.remove("show");
    hud.classList.remove("show");
    mainMenu.classList.add("show");
    setCanvasInteractive(false);
    setProgressHud(0, "0%", "Progresso");
    placeLabel.textContent = "Posição: 1º / " + getFieldSize();
    setSpeedHud(0, PHYSICS.maxSpeed);
    refreshAccountStats();
    enterMenuCamera();
    syncMobileControlsVisibility();
  }

  function startCountdown() {
    countdownActive = true;
    countdownTimer = 0;
    countdownStep = 0;
    goDisplayTimer = 0;
    countdownNumber.textContent = countdownLabels[0];
    countdownOverlay.classList.add("show");
    GameAudio.unlock();
    GameAudio.playCountdownBeep(false);
  }

  function startRaceFromMenu() {
    closeGarage();
    closeShop();
    // Garante que a corrida usa o carro equipado (não o preview bloqueado)
    if (player.carModelId !== equippedCarId) {
      rebuildPlayerCar(equippedCarId, { saveEquip: true });
    }
    // Nova e Echo escolhem carro do catálogo (comuns mais comuns)
    assignBotCarsForRace();

    // Pneu calibrado: só o jogador, só nesta corrida (bônus relativo)
    if (hasPendingCalibratedTire()) {
      player.maxSpeed = PHYSICS.maxSpeed * CALIBRATED_TIRE_SPEED_MULT;
      consumeCalibratedTire();
      refreshMoneyLabel();
    } else {
      player.maxSpeed = PHYSICS.maxSpeed;
    }
    getActiveRivals().forEach(function (rival) {
      rival.maxSpeed = PHYSICS.maxSpeed;
    });

    inMenu = false;
    raceTime = 0;
    raceOver = false;
    mainMenu.classList.remove("show");
    hud.classList.add("show");
    setCanvasInteractive(true);
    placeGrid();
    enterRaceCamera();
    finishOrder.length = 0;
    rankingPanel.classList.remove("show", "centered", "racing");
    rankingHint.classList.remove("show");
    rankingList.innerHTML = "";
    setProgressHud(0, "0%", "Progresso");
    placeLabel.textContent = "Posição: 1º / " + getFieldSize();
    setSpeedHud(0, getRacerMaxSpeed(player));
    startCountdown();
    syncMobileControlsVisibility();
  }

  btnStartRace.addEventListener("click", function () {
    startRaceFromMenu();
  });

  document
    .getElementById("btnGarage")
    .addEventListener("click", function () {
      openGarage();
    });

  document
    .getElementById("btnGarageClose")
    .addEventListener("click", function () {
      closeGarage();
    });

  document
    .getElementById("btnGaragePrev")
    .addEventListener("click", function () {
      stepGarage(-1);
    });

  document
    .getElementById("btnGarageNext")
    .addEventListener("click", function () {
      stepGarage(1);
    });

  document
    .getElementById("btnGarageEquip")
    .addEventListener("click", function () {
      equipGarageCar();
    });

  document
    .getElementById("btnShop")
    .addEventListener("click", function () {
      openShop();
    });

  document
    .getElementById("btnShopClose")
    .addEventListener("click", function () {
      closeShop();
    });

  document
    .getElementById("btnShopPrev")
    .addEventListener("click", function () {
      stepShop(-1);
    });

  document
    .getElementById("btnShopNext")
    .addEventListener("click", function () {
      stepShop(1);
    });

  document
    .getElementById("btnShopBuy")
    .addEventListener("click", function () {
      buyShopOffer();
    });

  window.addEventListener("keydown", (e) => {
    if (
      raceOver &&
      !botBench.active &&
      (e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space")
    ) {
      e.preventDefault();
      showMainMenu();
      return;
    }
    if (!inMenu) return;
    if (shopOpen) {
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        stepShop(-1);
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        stepShop(1);
      } else if (e.code === "Enter" || e.code === "KeyE") {
        e.preventDefault();
        buyShopOffer();
      } else if (e.code === "Escape") {
        e.preventDefault();
        closeShop();
      }
      return;
    }
    if (!garageOpen) return;
    if (e.code === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      stepGarage(-1);
    } else if (e.code === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      stepGarage(1);
    } else if (e.code === "Enter" || e.code === "KeyE") {
      e.preventDefault();
      equipGarageCar();
    } else if (e.code === "Escape") {
      e.preventDefault();
      closeGarage();
    }
  });

  syncActiveRacers();
  showMainMenu();

  function getAIInput(racer, dt) {
    let distNow;
    if (track.totalLaps > 1) {
      distNow =
        racer.pathHint != null ? racer.pathHint : racer.distAlong;
    } else {
      distNow = path3D.getDistanceAt(
        path3D.getClosestPositionTo(racer.mesh.position)
      );
    }
    const lookDist = Math.min(
      trackLength - 1,
      distNow + racer.lookAhead
    );
    const sampleNow = samplePath(path3D, distNow);
    const sampleLook = samplePath(path3D, lookDist);

    const tanNow = sampleNow.tangent;
    const tanAhead = sampleLook.tangent;
    const bend = 1 - BABYLON.Vector3.Dot(tanNow, tanAhead);

    const laneOffset =
      racer.preferredLane +
      Math.sin(raceTime * racer.wobbleSpeed + racer.wobblePhase) *
        racer.wobbleAmount;

    const target = sampleLook.position.add(
      sampleLook.binormal.scale(laneOffset)
    );

    const toTarget = target.subtract(racer.mesh.position);
    const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
    let yawError = normalizeAngle(desiredYaw - racer.mesh.rotation.y);

    if (!racer.finished) {
      if (racer.mistakeTimer > 0) {
        racer.mistakeTimer -= dt;
        yawError *= -0.35;
      } else if (Math.random() < racer.mistakeChance) {
        racer.mistakeTimer = 0.2 + Math.random() * 0.25;
      }
    }

    const left = yawError < -racer.steerDeadzone;
    const right = yawError > racer.steerDeadzone;

    const sharpCurve = bend > racer.curveCaution;
    const badlyAligned = Math.abs(yawError) > 0.55;
    const almostStopped = Math.abs(racer.speed) < 4;
    // Evita deadlock: parado + desalinhado nunca mais acelerava/virava
    const up =
      !racer.finished &&
      (almostStopped || (!sharpCurve && !badlyAligned));
    const down =
      !racer.finished &&
      !almostStopped &&
      sharpCurve &&
      bend > racer.curveCaution + 0.08;

    return { up, down, left, right };
  }

  function markRacerFinished(racer, finishTime) {
    if (racer.finished) return;
    racer.finished = true;
    racer.finishTime = finishTime;
    racer.progress = 1;
    finishOrder.push(racer);
    if (!botBench.active) {
      GameAudio.playFinish(racer.isPlayer);
    }
    updateRankingPanel();
  }

  function forceFinishStragglers() {
    if (raceOver || finishOrder.length === 0) return;
    const firstFinish = finishOrder[0].finishTime;
    // Se alguém já chegou há tempo e ainda falta gente, encerra os atrasados
    if (raceTime < firstFinish + 14) return;
    const pending = racers
      .filter(function (racer) {
        return !racer.finished;
      })
      .sort(function (a, b) {
        return b.distAlong - a.distAlong;
      });
    pending.forEach(function (racer, i) {
      markRacerFinished(racer, raceTime + (i + 1) * 0.05);
    });
  }

  function cacheRacerFlashMats(racer) {
    if (racer.flashMats || !racer.mesh) return;
    const entries = [];
    const meshes = racer.mesh.getChildMeshes
      ? racer.mesh.getChildMeshes(false)
      : [];
    for (let i = 0; i < meshes.length; i++) {
      const mat = meshes[i].material;
      if (!mat) continue;
      const mats = mat.subMaterials || [mat];
      for (let j = 0; j < mats.length; j++) {
        const m = mats[j];
        if (!m || !m.emissiveColor) continue;
        entries.push({
          mat: m,
          emissive: m.emissiveColor.clone(),
          diffuse: m.diffuseColor ? m.diffuseColor.clone() : null,
        });
      }
    }
    racer.flashMats = entries;
  }

  function setRacerCollisionFlash(racer, on) {
    if (!!racer.collisionFlashOn === !!on) return;
    cacheRacerFlashMats(racer);
    const entries = racer.flashMats || [];
    const flashAmount = 0.25; // 25% branco / 75% cor original
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (on) {
        entry.mat.emissiveColor.set(
          entry.emissive.r + (1 - entry.emissive.r) * flashAmount,
          entry.emissive.g + (1 - entry.emissive.g) * flashAmount,
          entry.emissive.b + (1 - entry.emissive.b) * flashAmount
        );
        if (entry.diffuse && entry.mat.diffuseColor) {
          entry.mat.diffuseColor.set(
            entry.diffuse.r + (1 - entry.diffuse.r) * flashAmount,
            entry.diffuse.g + (1 - entry.diffuse.g) * flashAmount,
            entry.diffuse.b + (1 - entry.diffuse.b) * flashAmount
          );
        }
      } else {
        entry.mat.emissiveColor.copyFrom(entry.emissive);
        if (entry.diffuse && entry.mat.diffuseColor) {
          entry.mat.diffuseColor.copyFrom(entry.diffuse);
        }
      }
    }
    racer.collisionFlashOn = !!on;
  }

  function applyDrive(racer, input, dt) {
    if (racer.wallHitCooldown > 0) {
      racer.wallHitCooldown -= dt;
    }
    // Após cruzar a chegada: não acelera mais, só desacelera e pode virar
    const coasting = racer.finished;
    const throttleUp = !coasting && input.up;
    const throttleDown = !coasting && input.down;

    if (throttleUp) {
      racer.speed += PHYSICS.accel * dt;
    } else if (throttleDown) {
      racer.speed -= PHYSICS.brake * dt;
    } else {
      const friction = coasting
        ? PHYSICS.friction * 2.4
        : PHYSICS.friction;
      if (racer.speed > 0) racer.speed -= friction * dt;
      else if (racer.speed < 0) racer.speed += friction * dt;
      if (Math.abs(racer.speed) < 0.2) racer.speed = 0;
    }

    const speedCap = getRacerMaxSpeed(racer);
    racer.speed = Math.max(-12, Math.min(speedCap, racer.speed));

    // Sem velocidade mínima de steer o carro parado nunca realinha
    const steerPower = Math.max(
      racer.finished ? 0 : 0.4,
      Math.min(1, Math.abs(racer.speed) / 10)
    );
    if (input.left) racer.mesh.rotation.y -= PHYSICS.turnRate * steerPower * dt;
    if (input.right) racer.mesh.rotation.y += PHYSICS.turnRate * steerPower * dt;

    let targetRoll = 0;
    if (input.left) targetRoll = 0.18;
    if (input.right) targetRoll = -0.18;
    racer.mesh.rotation.z +=
      (targetRoll - racer.mesh.rotation.z) * Math.min(1, 8 * dt);

    const forward = new BABYLON.Vector3(
      Math.sin(racer.mesh.rotation.y),
      0,
      Math.cos(racer.mesh.rotation.y)
    );
    racer.mesh.position.addInPlace(forward.scale(racer.speed * dt));

    if (track.totalLaps > 1) {
      if (racer.pathHint == null) racer.pathHint = track.startDist;
      racer.distAlong = distanceAlongPathHinted(
        path3D,
        racer.mesh.position,
        racer.pathHint,
        35,
        110
      );
      racer.pathHint = racer.distAlong;
    } else {
      racer.distAlong = distanceAlongPath(path3D, racer.mesh.position);
    }

    const sampleOnPath = samplePath(path3D, racer.distAlong);
    const closest = sampleOnPath.position;
    const tan = sampleOnPath.tangent;
    const side = sampleOnPath.binormal;
    const lateral = BABYLON.Vector3.Dot(
      racer.mesh.position.subtract(closest),
      side
    );

    const laneLimit = getActiveLaneLimit();
    const hittingWall = Math.abs(lateral) > laneLimit;
    if (hittingWall) {
      const excess = Math.abs(lateral) - laneLimit;
      racer.mesh.position.addInPlace(
        side.scale(-Math.sign(lateral) * excess)
      );
      // Som só na entrada do contato (evita eco enquanto raspa a lateral)
      const hitSpeed = Math.abs(racer.speed);
      if (
        !racer.againstWall &&
        racer.wallHitCooldown <= 0 &&
        hitSpeed > 6 &&
        excess > 0.02
      ) {
        if (racer.bench) racer.bench.wallHits += 1;
        if (!botBench.active) {
          const intensity = Math.min(
            1,
            hitSpeed / getRacerMaxSpeed(racer)
          );
          let playHit = racer.isPlayer;
          if (!playHit) {
            const distToPlayer = BABYLON.Vector3.Distance(
              player.mesh.position,
              racer.mesh.position
            );
            playHit = distToPlayer < 28;
          }
          if (playHit) {
            GameAudio.playWallHit(intensity, racer.isPlayer);
          }
        }
        racer.wallHitCooldown = 0.28;
      }
      if (racer.bench && hitSpeed > 4) {
        racer.bench.scrapeTime += dt;
      }
      racer.againstWall = true;
      racer.speed *= 0.97;
      racer.collisionBlinkT += dt;
      // Pisca branco ~8×/s enquanto colide
      const blinkOn =
        Math.sin(racer.collisionBlinkT * Math.PI * 16) > 0;
      setRacerCollisionFlash(racer, blinkOn);
    } else {
      setRacerCollisionFlash(racer, false);
      racer.againstWall = false;
      racer.collisionBlinkT = 0;
    }

    // Arraste: contínuo enquanto raspa a lateral (só jogador)
    if (racer.isPlayer && !botBench.active) {
      const scrapeSpeed = Math.abs(racer.speed);
      const scraping = hittingWall && scrapeSpeed > 4;
      GameAudio.setWallScrape(
        scraping,
        scraping
          ? Math.min(1, scrapeSpeed / getRacerMaxSpeed(racer))
          : 0
      );
    }

    if (racer.bench && !racer.finished) {
      const absSpeed = Math.abs(racer.speed);
      racer.bench.distTraveled += absSpeed * dt;
      if (absSpeed < 4) racer.bench.stuckTime += dt;
    }

    // Segue o relevo da pista (morro suave) sem física extra
    racer.mesh.position.y = closest.y;
    racer.mesh.rotation.x = pitchFromTangent(tan);

    // Chegada / voltas
    const toFinish = racer.mesh.position.subtract(finishSample.position);
    const finishSide = BABYLON.Vector3.Dot(toFinish, finishSample.tangent);
    const nearFinish = racer.distAlong > track.finishDist - 40;
    const crossedPlane =
      nearFinish && racer.prevFinishSide < 0 && finishSide >= 0;
    const pastFinishDist = racer.distAlong >= track.finishDist;

    if (track.totalLaps > 1) {
      if (
        !racer.lapArmed &&
        racer.distAlong > track.startDist + track.lapLength * 0.4
      ) {
        racer.lapArmed = true;
      }
      if (
        !racer.finished &&
        racer.lapArmed &&
        (crossedPlane || pastFinishDist)
      ) {
        racer.lapsCompleted += 1;
        racer.lapArmed = false;
        if (racer.lapsCompleted >= track.totalLaps) {
          markRacerFinished(racer, raceTime);
        } else {
          let playCp = racer.isPlayer;
          if (!playCp) {
            playCp =
              BABYLON.Vector3.Distance(
                player.mesh.position,
                racer.mesh.position
              ) < 35;
          }
          if (playCp && !botBench.active) {
            GameAudio.playCheckpoint(racer.isPlayer);
          }
          wrapRacerToLapStart(racer);
        }
      }
    } else if (!racer.finished && (crossedPlane || pastFinishDist)) {
      markRacerFinished(racer, raceTime);
    }
    racer.prevFinishSide = finishSide;

    if (!racer.finished) {
      racer.progress =
        track.totalLaps > 1
          ? raceProgressFromLaps(racer, track)
          : raceProgressFromDistance(racer.distAlong, track);
    } else {
      racer.progress = 1;
    }
  }

  function getPlayerPlace() {
    let place = 1;
    for (const other of racers) {
      if (other === player) continue;
      if (other.finished && player.finished) {
        if (other.finishTime < player.finishTime) place += 1;
      } else if (other.finished && !player.finished) {
        place += 1;
      } else if (!other.finished && !player.finished) {
        if (other.progress > player.progress + 0.001) place += 1;
      }
    }
    return place;
  }

  function allRacersFinished() {
    return racers.every(function (racer) {
      return racer.finished;
    });
  }

  function placeText(place) {
    return place + "º";
  }

  function updateRankingPanel() {
    rankingPanel.classList.add("show");
    if (!raceOver && !allRacersFinished()) {
      rankingPanel.classList.add("racing");
    }
    rankingList.innerHTML = "";

    finishOrder.forEach(function (racer, index) {
      const row = document.createElement("div");
      row.className = "ranking-row" + (racer.isPlayer ? " you" : "");
      row.innerHTML =
        '<span class="pos">' +
        placeText(index + 1) +
        "</span>" +
        "<span>" +
        racer.name +
        "</span>" +
        '<span class="time">' +
        racer.finishTime.toFixed(1) +
        "s</span>";
      rankingList.appendChild(row);
    });

    racers.forEach(function (racer) {
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
      rankingList.appendChild(row);
    });

    if (allRacersFinished() && !raceOver) {
      raceOver = true;
      rankingPanel.classList.remove("racing");

      if (botBench.active && botBench.resolveRace) {
        const rows = finishOrder.map(function (racer, index) {
          const bench = racer.bench || {
            wallHits: 0,
            scrapeTime: 0,
            stuckTime: 0,
            distTraveled: 0,
          };
          const finishTime = racer.finishTime || raceTime;
          return {
            trackId: botBench.trackId,
            trackName:
              (track.data && track.data.name) || botBench.trackId,
            run: botBench.runIndex,
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
        botBench.rows.push.apply(botBench.rows, rows);
        const resolve = botBench.resolveRace;
        botBench.resolveRace = null;
        setTimeout(function () {
          resolve(rows);
        }, 30);
        return;
      }

      const finalPlace = getPlayerPlace();
      const didWin = registerWinIfFirst(finalPlace);
      const reward = rewardCoinsForPlace(finalPlace);
      setProgressHud(1, "100%", "Progresso");
      placeLabel.textContent =
        "Posição: " + placeText(finalPlace) + " / " + getFieldSize();
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
      rankingHint.innerHTML = hint.trim() + "<br>" + touchHint;
      rankingHint.classList.add("show");
      // Desliza o quadro do canto para o centro
      requestAnimationFrame(function () {
        rankingPanel.classList.add("centered");
      });
      syncMobileControlsVisibility();
    }
  }

  function setNodesEnabled(nodes, enabled) {
    nodes.forEach(function (node) {
      node.setEnabled(enabled);
    });
  }

  function setHalfBuildingsEnabled() {
    buildingGroups.forEach(function (group, index) {
      group.setEnabled(index % 2 === 0);
    });
  }

  function restorePerfScene() {
    setNodesEnabled(roadPieces, true);
    setNodesEnabled(buildingGroups, true);
    setNodesEnabled(tunnelRings, true);
    setNodesEnabled(beachProps, true);
    if (finishGate) finishGate.setEnabled(true);
    player.mesh.setEnabled(true);
    rivals.forEach(function (rival) {
      rival.mesh.setEnabled(false);
    });
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.006;
  }

  function countActiveMeshes() {
    return scene.meshes.filter(function (mesh) {
      return mesh.isEnabled() && mesh.isVisible;
    }).length;
  }

  function waitMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function sampleFpsAverage(durationMs) {
    const samples = [];
    const endAt = performance.now() + durationMs;
    while (performance.now() < endAt) {
      samples.push(engine.getFps());
      await waitMs(50);
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
  }

  // Diagnóstico de FPS (não otimiza — só mede e isola)
  perfSceneApi = {
    runDiagnostic: async function (onProgress) {
      const results = [];
      const sampleMs = 2000;

      async function measure(label, setupFn) {
        restorePerfScene();
        setupFn();
        await waitMs(400);
        if (onProgress) {
          onProgress("Medindo: " + label + " ...");
        }
        const stats = await sampleFpsAverage(sampleMs);
        const row = {
          label: label,
          avg: stats.avg,
          min: stats.min,
          max: stats.max,
          meshes: countActiveMeshes(),
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
        setNodesEnabled(buildingGroups, false);
      });
      await measure("3) Metade dos prédios", function () {
        setHalfBuildingsEnabled();
      });
      await measure("4) Sem pedaços da pista", function () {
        setNodesEnabled(roadPieces, false);
      });
      await measure("5) Sem linha de chegada", function () {
        if (finishGate) finishGate.setEnabled(false);
      });
      await measure("6) Sem neblina (fog)", function () {
        scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
      });
      await measure("7) Sem carro do jogador", function () {
        player.mesh.setEnabled(false);
      });
      await measure("8) Quase vazio (só céu)", function () {
        setNodesEnabled(roadPieces, false);
        setNodesEnabled(buildingGroups, false);
        setNodesEnabled(tunnelRings, false);
        setNodesEnabled(beachProps, false);
        if (finishGate) finishGate.setEnabled(false);
        player.mesh.setEnabled(false);
        scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
      });

      restorePerfScene();
      return results;
    },
  };

  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    handleVirtualMenuActions();

    // Hub: carro/item no centro girando + câmera orbitando
    if (inMenu) {
      GameAudio.stopEngines();
      if (!perfTestRunning) {
        const spinMesh = shopItemPreview || player.mesh;
        spinMesh.rotation.y += dt * 0.55;
        menuCamera.alpha += dt * 0.22;
      }
      return;
    }

    // Contagem: ninguém anda
    if (countdownActive) {
      countdownTimer += dt;
      if (countdownTimer >= 1) {
        countdownTimer = 0;
        countdownStep += 1;
        if (countdownStep >= countdownLabels.length) {
          countdownActive = false;
          countdownNumber.textContent = "VAI!";
          goDisplayTimer = 0.7;
          GameAudio.playCountdownBeep(true);
        } else {
          countdownNumber.textContent = countdownLabels[countdownStep];
          GameAudio.playCountdownBeep(false);
        }
      }
      return;
    }

    if (goDisplayTimer > 0) {
      goDisplayTimer -= dt;
      if (goDisplayTimer <= 0) {
        countdownOverlay.classList.remove("show");
      }
    }

    const simDt = botBench.active ? dt * botBench.simSpeed : dt;

    if (!raceOver) {
      raceTime += simDt;
    }

    if (botBench.active) {
      racers.forEach(function (rival) {
        if (!rival.finished) {
          applyDrive(rival, getAIInput(rival, simDt), simDt);
        } else {
          applyDrive(
            rival,
            { up: false, down: false, left: false, right: false },
            simDt
          );
        }
      });
      forceFinishStragglers();
      // Failsafe: corrida travada demais
      if (!raceOver && raceTime > 240) {
        racers.forEach(function (rival) {
          if (!rival.finished) {
            markRacerFinished(rival, raceTime);
          }
        });
      }
      if (racers[0] && !raceOver) {
        camera.lockedTarget = racers[0].mesh;
      }
      return;
    }

    // Depois da chegada o jogador só desacelera (ainda pode virar)
    const playerInput = mergeDriveInput(
      player.finished
        ? { up: false, down: false, left: keys.left, right: keys.right }
        : keys
    );

    applyDrive(player, playerInput, dt);
    getActiveRivals().forEach(function (rival) {
      applyDrive(rival, getAIInput(rival, dt), dt);
    });
    forceFinishStragglers();

    GameAudio.setEngineSpeed(
      "player",
      player.speed,
      getRacerMaxSpeed(player)
    );
    getActiveRivals().forEach(function (rival) {
      GameAudio.setEngineSpeed(
        rival.id,
        rival.speed,
        getRacerMaxSpeed(rival),
        BABYLON.Vector3.Distance(
          player.mesh.position,
          rival.mesh.position
        )
      );
    });

    // Câmera desacelera e assenta na chegada (sem salto brusco)
    if (player.finished) {
      lockCameraAtFinish();
    }

    const place = getPlayerPlace();
    placeLabel.textContent =
      "Posição: " + placeText(place) + " / " + getFieldSize();
    setSpeedHud(player.speed, getRacerMaxSpeed(player));

    if (!player.finished) {
      const progressRatio = Math.max(0, Math.min(1, player.progress || 0));
      const stepped = snapProgressRatio(progressRatio);
      const shown = Math.min(90, Math.round(stepped * 100));
      if (track.totalLaps > 1) {
        const lapShow = Math.min(
          track.totalLaps,
          player.lapsCompleted + 1
        );
        setProgressHud(
          stepped,
          shown + "%",
          "Volta " + lapShow + "/" + track.totalLaps
        );
      } else {
        setProgressHud(stepped, shown + "%", "Progresso");
      }
    } else if (!raceOver) {
      setProgressHud(1, "100%", "Chegou!");
    }
  });

  switchTrackInScene = function (trackId, options) {
    const opts = options || {};
    const force = !!opts.force;
    if (
      !force &&
      (!inMenu || perfTestRunning || countdownActive)
    ) {
      return false;
    }
    if (!window.NEON_RUSH_TRACKS || !window.NEON_RUSH_TRACKS[trackId]) {
      return false;
    }

    if (!force) {
      closeGarage({ restoreCar: true });
      closeShop({ restoreCar: true });
    }

    clearTrackWorld();
    track = buildTrackFromData(window.NEON_RUSH_TRACKS[trackId]);
    path3D = track.path3D;
    trackLength = track.trackLength;
    applyTrackTheme(track.data);
    buildTrackWorld();
    syncActiveRacers();
    placeGrid();
    if (!botBench.active) {
      enterMenuCamera();
      placeLabel.textContent = "Posição: 1º / " + getFieldSize();
    }
    return true;
  };

  function beginBotBenchRace() {
    closeGarage({ restoreCar: false });
    closeShop({ restoreCar: false });
    GameAudio.stopEngines();
    assignBotCarsForRace();
    syncActiveRacers();
    // Só bots — jogador fora da disputa
    racers = getActiveRivals().slice();
    player.mesh.setEnabled(false);
    rivals.forEach(function (rival) {
      rival.mesh.setEnabled(racers.indexOf(rival) !== -1);
      rival.maxSpeed = PHYSICS.maxSpeed;
    });

    inMenu = false;
    raceTime = 0;
    raceOver = false;
    countdownActive = false;
    goDisplayTimer = 0;
    countdownOverlay.classList.remove("show");
    mainMenu.classList.remove("show");
    hud.classList.add("show");
    setCanvasInteractive(false);
    finishOrder.length = 0;
    rankingPanel.classList.remove("show", "centered", "racing");
    rankingHint.classList.remove("show");
    rankingList.innerHTML = "";

    placeGrid();
    if (racers.length) {
      camera.lockedTarget = racers[0].mesh;
      unlockCameraFollow();
      camera.lockedTarget = racers[0].mesh;
      scene.activeCamera = camera;
      setRivalVisibility(true);
      player.mesh.setEnabled(false);
    }
    setProgressHud(
      (botBench.runIndex - 1) / Math.max(1, botBench.runsPerTrack),
      botBench.runIndex + "/" + botBench.runsPerTrack,
      "Bench " + (botBench.trackId || "")
    );
    placeLabel.textContent = "Bots: " + racers.length;
    setSpeedHud(0, PHYSICS.maxSpeed);
    speedLabel.textContent = "×" + botBench.simSpeed;
  }

  botBenchApi = {
    beginRace: beginBotBenchRace,
    switchTrack: function (trackId) {
      window.NEON_RUSH_ACTIVE_TRACK = trackId;
      return switchTrackInScene(trackId, { force: true });
    },
    getActiveTrackId: function () {
      return window.NEON_RUSH_ACTIVE_TRACK;
    },
    restoreHub: function () {
      racers = [player].concat(getActiveRivals());
      player.mesh.setEnabled(true);
      rivals.forEach(function (rival) {
        rival.mesh.setEnabled(false);
      });
      unlockCameraFollow();
      showMainMenu();
    },
  };

  return scene;
};

const scene = createScene();

function formatPerfResults(results) {
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
}

async function runFpsDiagnostic() {
  if (!debugEnabled || !perfSceneApi || perfTestRunning) return;
  perfTestRunning = true;
  debugPerfBtn.disabled = true;
  btnStartRace.disabled = true;
  debugPerfReport.classList.add("show");
  debugPerfReport.textContent =
    "Iniciando diagnóstico...\nOlhe o console (F12) também.";

  try {
    const results = await perfSceneApi.runDiagnostic(function (msg) {
      if (typeof msg === "string") {
        debugPerfReport.textContent = msg;
      } else {
        debugPerfReport.textContent = formatPerfResults(msg);
      }
    });
    const finalText = formatPerfResults(results);
    debugPerfReport.textContent =
      finalText + "\nConcluído. Nada foi otimizado — só medição.";
    console.log("[FPS TEST] Relatório final\n" + finalText);
  } catch (err) {
    console.error("[FPS TEST] Erro", err);
    debugPerfReport.textContent =
      "Erro no diagnóstico. Veja o console.\n" + String(err);
  } finally {
    perfTestRunning = false;
    debugPerfBtn.disabled = false;
    btnStartRace.disabled = false;
  }
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function botBenchRowsToCsv(rows) {
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
}

function formatBotBenchSummary(rows) {
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
}

async function runBotBenchmark() {
  if (!debugEnabled || !botBenchApi || perfTestRunning) return;
  perfTestRunning = true;
  botBench.active = true;
  botBench.rows = [];
  if (debugPerfBtn) debugPerfBtn.disabled = true;
  if (debugBotBenchBtn) debugBotBenchBtn.disabled = true;
  btnStartRace.disabled = true;
  debugPerfReport.classList.add("show");
  debugPerfReport.textContent = "Iniciando teste de bots...\n";

  const savedTrack = botBenchApi.getActiveTrackId();
  const trackIds = Object.keys(window.NEON_RUSH_TRACKS || {});

  try {
    for (let t = 0; t < trackIds.length; t++) {
      const trackId = trackIds[t];
      botBench.trackId = trackId;
      botBenchApi.switchTrack(trackId);
      await new Promise(function (r) {
        setTimeout(r, 200);
      });

      for (let run = 1; run <= botBench.runsPerTrack; run++) {
        botBench.runIndex = run;
        debugPerfReport.textContent =
          "Bench: " +
          trackId +
          " · corrida " +
          run +
          "/" +
          botBench.runsPerTrack +
          "\n(aguarde — simulação acelerada ×" +
          botBench.simSpeed +
          ")";

        await new Promise(function (resolve) {
          botBench.resolveRace = resolve;
          botBenchApi.beginRace();
        });

        await new Promise(function (r) {
          setTimeout(r, 80);
        });
      }
    }

    const csv = botBenchRowsToCsv(botBench.rows);
    downloadTextFile(
      "neon-rush-bot-bench-" + Date.now() + ".csv",
      csv
    );
    const summary = formatBotBenchSummary(botBench.rows);
    debugPerfReport.textContent = summary;
    console.log("[BOT BENCH]\n" + summary);
    console.log("[BOT BENCH] CSV rows", botBench.rows);
  } catch (err) {
    console.error("[BOT BENCH] Erro", err);
    debugPerfReport.textContent =
      "Erro no teste de bots.\n" + String(err);
  } finally {
    botBench.active = false;
    botBench.resolveRace = null;
    if (savedTrack) botBenchApi.switchTrack(savedTrack);
    botBenchApi.restoreHub();
    perfTestRunning = false;
    if (debugPerfBtn) debugPerfBtn.disabled = false;
    if (debugBotBenchBtn) debugBotBenchBtn.disabled = false;
    btnStartRace.disabled = false;
  }
}

if (debugEnabled) {
  debugPerfBtn.addEventListener("click", function () {
    runFpsDiagnostic();
  });
  if (debugBotBenchBtn) {
    debugBotBenchBtn.addEventListener("click", function () {
      runBotBenchmark();
    });
  }
}

engine.runRenderLoop(function () {
  scene.render();
  if (debugEnabled) {
    debugFpsFrame += 1;
    // Atualiza o DOM de tempos em tempos para não pesar o FPS
    if (debugFpsFrame % 15 === 0) {
      debugFps.textContent = Math.round(engine.getFps()) + " FPS";
    }
  }
});

window.addEventListener("resize", function () {
  engine.resize();
});
