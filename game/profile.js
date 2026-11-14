// Sistema: profile. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.loadCoins = function loadCoins() {
    const saved = localStorage.getItem(app.COINS_STORAGE_KEY);
    const value = saved === null ? 0 : parseInt(saved, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };

  app.saveCoins = function saveCoins(amount) {
    localStorage.setItem(app.COINS_STORAGE_KEY, String(amount));
  };

  app.loadPendingCoinMultiplier = function loadPendingCoinMultiplier() {
    const saved = parseInt(
      localStorage.getItem(app.COIN_MULTIPLIER_KEY) || "1",
      10
    );
    return saved > 1 ? saved : 1;
  };

  app.savePendingCoinMultiplier = function savePendingCoinMultiplier(mult) {
    if (mult > 1) {
      localStorage.setItem(app.COIN_MULTIPLIER_KEY, String(mult));
    } else {
      localStorage.removeItem(app.COIN_MULTIPLIER_KEY);
    }
  };

  app.hasPendingCoinMultiplier = function hasPendingCoinMultiplier() {
    return app.loadPendingCoinMultiplier() > 1;
  };

  app.activateCoinMultiplier = function activateCoinMultiplier() {
    app.savePendingCoinMultiplier(app.COIN_MULTIPLIER_VALUE);
  };

  app.hasPendingCalibratedTire = function hasPendingCalibratedTire() {
    return localStorage.getItem(app.CALIBRATED_TIRE_KEY) === "1";
  };

  app.activateCalibratedTire = function activateCalibratedTire() {
    localStorage.setItem(app.CALIBRATED_TIRE_KEY, "1");
  };

  app.consumeCalibratedTire = function consumeCalibratedTire() {
    localStorage.removeItem(app.CALIBRATED_TIRE_KEY);
  };

  app.rollPriceBetween = function rollPriceBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  app.refreshMoneyLabel = function refreshMoneyLabel() {
    app.moneyLabel.textContent = String(app.coins);
    const multBadge = document.getElementById("multiplierBadge");
    if (multBadge) {
      multBadge.hidden = !app.hasPendingCoinMultiplier();
    }
    const tireBadge = document.getElementById("tireBadge");
    if (tireBadge) {
      tireBadge.textContent = "Pneu +" + app.CALIBRATED_TIRE_BONUS_PCT + "%";
      tireBadge.hidden = !app.hasPendingCalibratedTire();
    }
  };

  app.rewardCoinsForPlace = function rewardCoinsForPlace(place) {
    const base = app.COIN_REWARDS[place] || 0;
    const multiplier = app.loadPendingCoinMultiplier();
    const gained = base * multiplier;
    if (multiplier > 1) {
      app.savePendingCoinMultiplier(1);
    }
    if (gained > 0) {
      app.coins += gained;
      app.saveCoins(app.coins);
    }
    app.refreshMoneyLabel();
    return { gained: gained, multiplier: multiplier, base: base };
  };

  app.getCarDef = function getCarDef(carId) {
    return (
      (window.NEON_RUSH_CARS && window.NEON_RUSH_CARS[carId]) ||
      window.NEON_RUSH_CARS.starter
    );
  };

  app.loadPurchasedCars = function loadPurchasedCars() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(app.PURCHASED_CARS_KEY)
      );
      if (Array.isArray(saved)) {
        return saved.filter(function (id) {
          return window.NEON_RUSH_CARS && window.NEON_RUSH_CARS[id];
        });
      }
    } catch (e) {}
    return [];
  };

  app.savePurchasedCars = function savePurchasedCars(ids) {
    localStorage.setItem(app.PURCHASED_CARS_KEY, JSON.stringify(ids));
  };

  app.purchaseCar = function purchaseCar(carId) {
    const purchased = app.loadPurchasedCars();
    if (purchased.indexOf(carId) === -1) {
      purchased.push(carId);
      app.savePurchasedCars(purchased);
      app.refreshAccountStats();
    }
  };

  app.shuffleArray = function shuffleArray(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  };

  app.loadOwnedCars = function loadOwnedCars() {
    // Só o que vem de graça + o que foi comprado na loja
    const owned = Object.keys(window.NEON_RUSH_CARS || {}).filter(
      function (id) {
        return window.NEON_RUSH_CARS[id].ownedByDefault;
      }
    );
    app.loadPurchasedCars().forEach(function (id) {
      if (owned.indexOf(id) === -1) owned.push(id);
    });
    // Limpa save antigo que liberava carros sem comprar
    localStorage.removeItem("neonRush.ownedCars");
    return owned;
  };

  app.getTotalCarsCount = function getTotalCarsCount() {
    return Object.keys(window.NEON_RUSH_CARS || {}).length;
  };

  app.loadWins = function loadWins() {
    const saved = parseInt(localStorage.getItem(app.WINS_STORAGE_KEY) || "0", 10);
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  };

  app.saveWins = function saveWins(amount) {
    localStorage.setItem(app.WINS_STORAGE_KEY, String(amount));
  };

  app.refreshAccountStats = function refreshAccountStats() {
    const carsLabel = document.getElementById("carsCollectionLabel");
    const winsLabel = document.getElementById("winsLabel");
    if (carsLabel) {
      carsLabel.textContent =
        app.loadOwnedCars().length + "/" + app.getTotalCarsCount();
    }
    if (winsLabel) {
      winsLabel.textContent = String(app.wins);
    }
  };

  app.registerWinIfFirst = function registerWinIfFirst(place) {
    if (place !== 1) return false;
    app.wins += 1;
    app.saveWins(app.wins);
    app.refreshAccountStats();
    return true;
  };

  app.loadEquippedCarId = function loadEquippedCarId() {
    const owned = app.loadOwnedCars();
    const saved = localStorage.getItem(app.EQUIPPED_CAR_KEY);
    if (saved && owned.indexOf(saved) !== -1) return saved;
    const fallback = window.NEON_RUSH_DEFAULT_CAR || "starter";
    localStorage.setItem(app.EQUIPPED_CAR_KEY, fallback);
    return fallback;
  };

  app.saveEquippedCarId = function saveEquippedCarId(carId) {
    localStorage.setItem(app.EQUIPPED_CAR_KEY, carId);
  };

  app.refreshEquippedCarLabel = function refreshEquippedCarLabel() {
    const label = document.getElementById("equippedCarLabel");
    if (!label) return;
    const def = app.getCarDef(app.loadEquippedCarId());
    const rarity =
      window.NEON_RUSH_RARITIES &&
      window.NEON_RUSH_RARITIES[def.rarity];
    label.textContent =
      def.name + (rarity ? " · " + rarity.name : "");
    label.style.color = rarity ? rarity.color : "#b8f3ff";
  };
}

export function initializeEconomy(app) {
  app.COIN_REWARDS = { 1: 11, 2: 7, 3: 0 };
  app.COINS_STORAGE_KEY = "neonRush.coins";
  app.COIN_MULTIPLIER_KEY = "neonRush.coinMultiplierNext";
  app.COIN_MULTIPLIER_PRICE = 11;
  app.COIN_MULTIPLIER_VALUE = 3;
  app.CALIBRATED_TIRE_KEY = "neonRush.calibratedTireNext";
  app.CALIBRATED_TIRE_PRICE_MIN = 30;
  app.CALIBRATED_TIRE_PRICE_MAX = 50;
  app.CALIBRATED_TIRE_SPEED_MULT = 1.25;
  app.CALIBRATED_TIRE_BONUS_PCT = Math.round(
    (app.CALIBRATED_TIRE_SPEED_MULT - 1) * 100
  );
  app.coins = app.loadCoins();
  app.refreshMoneyLabel();
}

export function initializeCollection(app) {
  app.EQUIPPED_CAR_KEY = "neonRush.equippedCar";
  app.PURCHASED_CARS_KEY = "neonRush.purchasedCars";
  app.WINS_STORAGE_KEY = "neonRush.wins";
  app.wins = app.loadWins();
  app.refreshAccountStats();
}
