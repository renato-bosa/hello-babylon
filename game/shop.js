// Sistema: shop. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.disposeShopItemPreview = function disposeShopItemPreview() {
    if (world.shopItemPreview) {
      world.shopItemPreview.dispose();
      world.shopItemPreview = null;
    }
    world.shopItemPreviewId = null;
  };

  world.hideShopItemPreview = function hideShopItemPreview() {
    world.disposeShopItemPreview();
    if (world.player && world.player.mesh) world.player.mesh.setEnabled(true);
  };

  world.placeShopItemPreview = function placeShopItemPreview() {
    if (!world.shopItemPreview || !world.player || !world.player.mesh) return;
    world.shopItemPreview.position.copyFrom(world.player.mesh.position);
    world.shopItemPreview.position.y += 0.02;
  };

  world.showShopItemPreview = function showShopItemPreview(itemId) {
    try {
      if (world.shopItemPreviewId !== itemId || !world.shopItemPreview) {
        world.disposeShopItemPreview();
        world.shopItemPreview = app.createShopItemPreview(world.scene, itemId);
        world.shopItemPreviewId = itemId;
      }
      world.placeShopItemPreview();
    } catch (err) {
      console.error("Falha na prévia do item:", itemId, err);
      world.disposeShopItemPreview();
    }
    // Sempre esconde o carro na oferta de item
    if (world.player && world.player.mesh) world.player.mesh.setEnabled(false);
  };

  world.getUnownedCarIds = function getUnownedCarIds(excludeIds) {
    const owned = app.loadOwnedCars();
    const blocked = excludeIds || [];
    return Object.keys(window.NEON_RUSH_CARS || {}).filter(function (id) {
      return owned.indexOf(id) === -1 && blocked.indexOf(id) === -1;
    });
  };

  world.makeCarOffer = function makeCarOffer(carId) {
    return {
      kind: "car",
      carId: carId,
      price: window.neonRushRollCarPrice
        ? window.neonRushRollCarPrice(carId)
        : 100,
    };
  };

  world.makeItemOffer = function makeItemOffer(itemId) {
    const item = world.SHOP_FILLER_ITEMS[itemId];
    return {
      kind: "item",
      itemId: itemId,
      price: item.rollPrice(),
    };
  };

  world.getOfferableFillerIds = function getOfferableFillerIds() {
    return Object.keys(world.SHOP_FILLER_ITEMS).filter(function (id) {
      return world.SHOP_FILLER_ITEMS[id].canOffer();
    });
  };

  world.pickRandomFillerOffer = function pickRandomFillerOffer() {
    const ids = world.getOfferableFillerIds();
    if (!ids.length) return null;
    const itemId = ids[Math.floor(Math.random() * ids.length)];
    return world.makeItemOffer(itemId);
  };

  world.padShopOffersWithItems = function padShopOffersWithItems() {
    while (world.shopOffers.length < world.SHOP_OFFER_COUNT) {
      const offer = world.pickRandomFillerOffer();
      if (!offer) break;
      world.shopOffers.push(offer);
    }
  };

  world.ensureOvalTicketOffer = function ensureOvalTicketOffer() {
    const hasTicket = world.shopOffers.some(function (o) {
      return o.kind === "item" && o.itemId === "oval-ticket";
    });
    if (hasTicket) return;
    const ticket = world.makeItemOffer("oval-ticket");
    if (world.shopOffers.length < world.SHOP_OFFER_COUNT) {
      world.shopOffers.push(ticket);
    } else if (world.shopOffers.length) {
      // Garante ticket na vitrine mesmo com a loja cheia de carros
      world.shopOffers[world.shopOffers.length - 1] = ticket;
    } else {
      world.shopOffers.push(ticket);
    }
  };

  world.rollShopOffers = function rollShopOffers() {
    const pool = app.shuffleArray(world.getUnownedCarIds());
    const picked = pool.slice(0, world.SHOP_OFFER_COUNT);
    world.shopOffers = picked.map(world.makeCarOffer);
    world.padShopOffersWithItems();
    world.ensureOvalTicketOffer();
    world.shopIndex = 0;
  };

  world.pickReplacementOffer = function pickReplacementOffer() {
    const inOffers = world.shopOffers
      .filter(function (o) {
        return o.kind === "car";
      })
      .map(function (o) {
        return o.carId;
      });
    const pool = app.shuffleArray(world.getUnownedCarIds(inOffers));
    if (pool.length) return world.makeCarOffer(pool[0]);
    return world.pickRandomFillerOffer();
  };

  world.stripItemOffersOfType = function stripItemOffersOfType(itemId) {
    world.shopOffers = world.shopOffers.filter(function (o) {
      return !(o.kind === "item" && o.itemId === itemId);
    });
    if (world.shopIndex >= world.shopOffers.length) {
      world.shopIndex = Math.max(0, world.shopOffers.length - 1);
    }
  };

  world.isItemOffer = function isItemOffer(offer) {
    return offer && offer.kind === "item";
  };

  world.updateShopHud = function updateShopHud() {
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

    if (!world.shopOffers.length) {
      nameEl.textContent = "Loja";
      rarityEl.textContent = "";
      priceEl.textContent = "";
      priceEl.classList.remove("cant-afford");
      indexEl.textContent = "";
      emptyEl.hidden = false;
      emptyEl.textContent =
        app.hasPendingCoinMultiplier() || app.hasPendingCalibratedTire()
          ? "Sem ofertas — use seus itens na próxima corrida!"
          : "Sem ofertas agora — você já tem todos!";
      buyBtn.disabled = true;
      buyBtn.textContent = "Comprar";
      prevBtn.style.visibility = "hidden";
      nextBtn.style.visibility = "hidden";
      return;
    }

    emptyEl.hidden = true;
    prevBtn.style.visibility = world.shopOffers.length > 1 ? "visible" : "hidden";
    nextBtn.style.visibility = world.shopOffers.length > 1 ? "visible" : "hidden";

    const offer = world.shopOffers[world.shopIndex];
    const canAfford = app.coins >= offer.price;

    if (world.isItemOffer(offer)) {
      const item = world.SHOP_FILLER_ITEMS[offer.itemId];
      nameEl.textContent = item.name;
      rarityEl.textContent = item.blurb;
      rarityEl.style.color = item.color;
    } else {
      const def = app.getCarDef(offer.carId);
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
      "Oferta " + (world.shopIndex + 1) + " / " + world.shopOffers.length;

    buyBtn.disabled = !canAfford;
    buyBtn.textContent = canAfford ? "Comprar" : "Sem moedas";

    world.shopOffers.forEach(function (_offer, i) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className =
        "shop-offer-dot" + (i === world.shopIndex ? " active" : "");
      dot.setAttribute("aria-label", "Oferta " + (i + 1));
      dot.addEventListener("click", function () {
        world.showShopOfferAt(i);
      });
      dots.appendChild(dot);
    });
  };

  world.showShopOfferAt = function showShopOfferAt(index, options) {
    if (!world.shopOpen || !world.inMenu || app.perfTestRunning) return;
    const opts = options || {};
    const spinY = world.getHubSpinY();
    if (!world.shopOffers.length) {
      world.shopPreviewId = null;
      world.hideShopItemPreview();
      world.rebuildPlayerCar(world.equippedCarId, { saveEquip: true });
      world.refreshMenuDisplay({
        resetView: !!opts.resetView,
        spinY: spinY,
      });
      world.updateShopHud();
      return;
    }
    world.shopIndex =
      ((index % world.shopOffers.length) + world.shopOffers.length) %
      world.shopOffers.length;
    const offer = world.shopOffers[world.shopIndex];

    if (world.isItemOffer(offer)) {
      world.shopPreviewId = null;
      if (world.player.carModelId !== world.equippedCarId) {
        world.rebuildPlayerCar(world.equippedCarId, { saveEquip: true });
      }
      world.showShopItemPreview(offer.itemId);
    } else {
      world.hideShopItemPreview();
      world.shopPreviewId = offer.carId;
      world.rebuildPlayerCar(offer.carId, { saveEquip: false });
    }

    world.refreshMenuDisplay({
      resetView: !!opts.resetView,
      spinY: spinY,
    });
    world.updateShopHud();
  };

  world.stepShop = function stepShop(delta) {
    if (!world.shopOpen || world.shopOffers.length < 2) return;
    world.showShopOfferAt(world.shopIndex + delta);
  };

  world.buyShopOffer = function buyShopOffer() {
    if (!world.shopOpen || !world.inMenu || app.perfTestRunning) return;
    const offer = world.shopOffers[world.shopIndex];
    if (!offer) return;
    if (app.coins < offer.price) return;

    if (world.isItemOffer(offer)) {
      const item = world.SHOP_FILLER_ITEMS[offer.itemId];
      if (!item || !item.canOffer()) return;
      app.coins -= offer.price;
      app.saveCoins(app.coins);
      item.activate();
      app.refreshMoneyLabel();
    } else {
      if (app.loadOwnedCars().indexOf(offer.carId) !== -1) return;
      app.coins -= offer.price;
      app.saveCoins(app.coins);
      app.refreshMoneyLabel();
      app.purchaseCar(offer.carId);
    }

    const boughtItemId = world.isItemOffer(offer) ? offer.itemId : null;

    const replacement = world.pickReplacementOffer();
    if (replacement) {
      world.shopOffers[world.shopIndex] = replacement;
    } else {
      world.shopOffers.splice(world.shopIndex, 1);
      if (world.shopIndex >= world.shopOffers.length) {
        world.shopIndex = Math.max(0, world.shopOffers.length - 1);
      }
    }

    // Item ativado: remove cópias iguais (exceto stackable, ex.: tickets)
    if (boughtItemId) {
      const boughtItem = world.SHOP_FILLER_ITEMS[boughtItemId];
      if (!boughtItem || !boughtItem.stackable) {
        world.stripItemOffersOfType(boughtItemId);
      }
    }

    world.ensureOvalTicketOffer();
    world.showShopOfferAt(world.shopIndex);
  };

  world.openShop = function openShop() {
    if (!world.inMenu || app.perfTestRunning) return;
    if (typeof world.closeMissions === "function") world.closeMissions();
    if (typeof world.closeAccount === "function") world.closeAccount();
    world.closeGarage({ restoreCar: false });
    world.rollShopOffers();
    world.shopOpen = true;
    document.getElementById("mainMenu").classList.add("shop-open");
    const panel = document.getElementById("shopPanel");
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    world.showShopOfferAt(0, { resetView: false });
    world.syncMobileControlsVisibility();
  };

  world.closeShop = function closeShop(options) {
    const opts = options || {};
    const restoreCar = opts.restoreCar !== false;
    const panel = document.getElementById("shopPanel");
    const hadItemPreview = !!world.shopItemPreview;
    world.hideShopItemPreview();
    if (restoreCar && (world.shopPreviewId || world.shopOpen || hadItemPreview)) {
      world.rebuildPlayerCar(world.equippedCarId, { saveEquip: true });
      world.placeGrid();
      world.enterMenuCamera();
    }
    world.shopPreviewId = null;
    world.shopOpen = false;
    world.shopOffers = [];
    panel.classList.remove("show");
    panel.setAttribute("aria-hidden", "true");
    document.getElementById("mainMenu").classList.remove("shop-open");
    if (restoreCar) app.refreshEquippedCarLabel();
    world.syncMobileControlsVisibility();
  };
}

export function initializeShop(app, world) {
  world.SHOP_OFFER_COUNT = 5;
  world.shopOffers = [];
  world.shopIndex = 0;
  world.shopPreviewId = null;
  world.shopItemPreview = null;
  world.shopItemPreviewId = null;
  world.SHOP_FILLER_ITEMS = {
    multiplier: {
      id: "multiplier",
      name: "Multiplicador ×3",
      color: "#39ff9f",
      blurb: "Próxima corrida: moedas ×3",
      rollPrice: function () {
        return app.COIN_MULTIPLIER_PRICE;
      },
      canOffer: function () {
        return !app.hasPendingCoinMultiplier();
      },
      activate: app.activateCoinMultiplier,
    },
    "calibrated-tire": {
      id: "calibrated-tire",
      name: "Pneu calibrado",
      color: "#7ec8ff",
      blurb:
        "Próxima corrida: vel. máx. +" + app.CALIBRATED_TIRE_BONUS_PCT + "%",
      rollPrice: function () {
        return app.rollPriceBetween(
          app.CALIBRATED_TIRE_PRICE_MIN,
          app.CALIBRATED_TIRE_PRICE_MAX
        );
      },
      canOffer: function () {
        return !app.hasPendingCalibratedTire();
      },
      activate: app.activateCalibratedTire,
    },
    "oval-ticket": {
      id: "oval-ticket",
      name: "Ticket Oval",
      color: "#ffb347",
      blurb: "1 entrada no Neon Oval",
      stackable: true,
      rollPrice: function () {
        return app.OVAL_TICKET_PRICE;
      },
      canOffer: function () {
        return true;
      },
      activate: function () {
        app.activateOvalTicket();
        app.refreshMoneyLabel();
        if (typeof app.refreshTrackLabel === "function") {
          app.refreshTrackLabel();
        }
      },
    },
  };
}
