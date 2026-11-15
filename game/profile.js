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

  app.loadOvalTickets = function loadOvalTickets() {
    const saved = localStorage.getItem(app.OVAL_TICKETS_KEY);
    const value = saved === null ? 0 : parseInt(saved, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };

  app.saveOvalTickets = function saveOvalTickets(amount) {
    localStorage.setItem(app.OVAL_TICKETS_KEY, String(Math.max(0, amount | 0)));
  };

  app.getOvalTickets = function getOvalTickets() {
    return app.loadOvalTickets();
  };

  app.addOvalTickets = function addOvalTickets(amount) {
    const next = app.loadOvalTickets() + Math.max(0, amount | 0);
    app.saveOvalTickets(next);
    return next;
  };

  app.consumeOvalTickets = function consumeOvalTickets(amount) {
    const cost = Math.max(1, amount | 0);
    const have = app.loadOvalTickets();
    if (have < cost) return false;
    app.saveOvalTickets(have - cost);
    return true;
  };

  app.hasOvalTickets = function hasOvalTickets(amount) {
    return app.loadOvalTickets() >= Math.max(1, amount | 0);
  };

  app.activateOvalTicket = function activateOvalTicket() {
    app.addOvalTickets(1);
  };

  app.getTrackTicketCost = function getTrackTicketCost(trackId) {
    const id = trackId || window.NEON_RUSH_ACTIVE_TRACK;
    const data =
      window.NEON_RUSH_TRACKS && id ? window.NEON_RUSH_TRACKS[id] : null;
    const feats = data && data.features ? data.features : null;
    if (!feats || !feats.requiresTicket) return 0;
    return typeof feats.ticketCost === "number" ? feats.ticketCost : 1;
  };

  app.activeTrackRequiresTicket = function activeTrackRequiresTicket() {
    return app.getTrackTicketCost() > 0;
  };

  app.refreshPlayButton = function refreshPlayButton() {
    const btn = app.btnStartRace;
    if (!btn) return;
    const cost = app.getTrackTicketCost();
    const needsTicket = cost > 0;
    const canPlay = !needsTicket || app.hasOvalTickets(cost);
    btn.classList.toggle("needs-ticket", needsTicket && !canPlay);
    if (needsTicket && !canPlay) {
      btn.textContent = "SEM TICKET";
      btn.title = "Compre um Ticket Oval na Loja para correr aqui";
    } else if (needsTicket) {
      btn.textContent = "JOGAR (−" + cost + ")";
      btn.title = "Gasta " + cost + " ticket para correr no Neon Oval";
    } else {
      btn.textContent = "JOGAR";
      btn.title = "";
    }
  };

  app.getCoinIconHtml = function getCoinIconHtml(className) {
    return (
      '<svg class="' +
      (className || "coin-icon") +
      '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="12" cy="12" r="10" fill="#ffd24a" stroke="#c99212" stroke-width="2"/>' +
      '<circle cx="12" cy="12" r="7.25" fill="none" stroke="#ffe79a" stroke-width="1.4"/>' +
      '<text x="12" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="#8a6200" font-family="Orbitron, sans-serif">$</text>' +
      "</svg>"
    );
  };

  app.refreshMoneyLabel = function refreshMoneyLabel(displayCoins) {
    if (!app._coinFlyActive || displayCoins != null) {
      const shown = displayCoins != null ? displayCoins : app.coins;
      app.moneyLabel.textContent = String(shown);
    }
    const ticketBadge = document.getElementById("ticketBadge");
    if (ticketBadge) {
      const tickets = app.getOvalTickets();
      ticketBadge.textContent = "Ticket ×" + tickets;
      ticketBadge.hidden = tickets <= 0;
    }
    const multBadge = document.getElementById("multiplierBadge");
    if (multBadge) {
      multBadge.hidden = !app.hasPendingCoinMultiplier();
    }
    const tireBadge = document.getElementById("tireBadge");
    if (tireBadge) {
      tireBadge.textContent = "Pneu +" + app.CALIBRATED_TIRE_BONUS_PCT + "%";
      tireBadge.hidden = !app.hasPendingCalibratedTire();
    }
    if (typeof app.refreshPlayButton === "function") {
      app.refreshPlayButton();
    }
  };

  app.playCoinFlyCelebration = function playCoinFlyCelebration(pending) {
    if (!pending || !(pending.amount > 0) || !app.moneyLabel) {
      app.refreshMoneyLabel();
      return;
    }
    const from = pending.from | 0;
    const to = pending.to | 0;
    const amount = pending.amount | 0;

    let layer = document.getElementById("coinFlyLayer");
    if (!layer) {
      layer = document.createElement("div");
      layer.id = "coinFlyLayer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    layer.innerHTML = "";

    const hud =
      document.querySelector(".menu-money") || app.moneyLabel.parentElement;
    const hudRect = hud.getBoundingClientRect();
    const destX = hudRect.left + hudRect.width * 0.5;
    const destY = hudRect.top + Math.min(hudRect.height * 0.55, 36);

    const originX = window.innerWidth * 0.5;
    const originY = window.innerHeight * 0.48;
    const coinCount = Math.min(14, Math.max(6, Math.round(amount / 1.5)));
    const flightMs = 1250;
    const staggerMs = 55;

    app._coinFlyActive = true;
    app.moneyLabel.textContent = String(from);
    if (hud) hud.classList.remove("coin-pulse");

    for (let i = 0; i < coinCount; i++) {
      const el = document.createElement("div");
      el.className = "fly-coin";
      el.innerHTML = app.getCoinIconHtml("coin-icon coin-icon--fly");
      const sx = originX + (Math.random() - 0.5) * 100;
      const sy = originY + (Math.random() - 0.5) * 70;
      el.style.left = sx + "px";
      el.style.top = sy + "px";
      layer.appendChild(el);

      const dx = destX - sx;
      const dy = destY - sy;
      const delay = i * staggerMs;
      if (typeof el.animate === "function") {
        el.animate(
          [
            {
              transform: "translate(-50%, -50%) scale(0.35)",
              opacity: 0,
            },
            {
              transform: "translate(-50%, -50%) scale(1.2)",
              opacity: 1,
              offset: 0.12,
            },
            {
              transform:
                "translate(calc(-50% + " +
                dx * 0.55 +
                "px), calc(-50% + " +
                (dy * 0.4 - 36) +
                "px)) scale(1)",
              opacity: 1,
              offset: 0.45,
            },
            {
              transform:
                "translate(calc(-50% + " +
                dx +
                "px), calc(-50% + " +
                dy +
                "px)) scale(0.45)",
              opacity: 1,
              offset: 0.88,
            },
            {
              transform:
                "translate(calc(-50% + " +
                dx +
                "px), calc(-50% + " +
                dy +
                "px)) scale(0.15)",
              opacity: 0,
            },
          ],
          {
            duration: flightMs,
            delay: delay,
            easing: "cubic-bezier(0.22, 0.7, 0.2, 1)",
            fill: "forwards",
          }
        );
      }
    }

    const countDelay = 180;
    const countMs = flightMs + (coinCount - 1) * staggerMs * 0.65;
    const t0 = performance.now();

    function tick(now) {
      const t = Math.min(
        1,
        Math.max(0, (now - t0 - countDelay) / countMs)
      );
      const eased = 1 - Math.pow(1 - t, 3);
      app.moneyLabel.textContent = String(
        Math.round(from + (to - from) * eased)
      );
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      app._coinFlyActive = false;
      app.refreshMoneyLabel();
      layer.innerHTML = "";
      if (hud) {
        hud.classList.add("coin-pulse");
        setTimeout(function () {
          hud.classList.remove("coin-pulse");
        }, 450);
      }
    }
    requestAnimationFrame(tick);
  };

  app.getCoinRewardsForActiveTrack = function getCoinRewardsForActiveTrack() {
    try {
      const data =
        typeof app.getActiveTrackData === "function"
          ? app.getActiveTrackData()
          : null;
      const custom =
        data && data.features && data.features.coinRewards
          ? data.features.coinRewards
          : null;
      if (custom && typeof custom === "object") return custom;
    } catch (e) {}
    return app.COIN_REWARDS;
  };

  app.rewardCoinsForPlace = function rewardCoinsForPlace(place) {
    const table = app.getCoinRewardsForActiveTrack();
    const base = table[place] || 0;
    const multiplier = app.loadPendingCoinMultiplier();
    const gained = base * multiplier;
    const from = app.coins;
    if (multiplier > 1) {
      app.savePendingCoinMultiplier(1);
    }
    if (gained > 0) {
      app.coins += gained;
      app.saveCoins(app.coins);
      app.pendingCoinFly = {
        from: from,
        to: app.coins,
        amount: gained,
      };
      // Mantém o total antigo no placar até a animação no menu
      app.refreshMoneyLabel(from);
    } else {
      app.pendingCoinFly = null;
      app.refreshMoneyLabel();
    }
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
  app.OVAL_TICKETS_KEY = "neonRush.ovalTickets";
  app.OVAL_TICKET_PRICE = 20;
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
