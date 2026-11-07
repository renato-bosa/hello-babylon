/**
 * Catálogo de carros — Neon Rush
 * Raridades: comum | épico | lendário
 * (por enquanto só visual — mesma física para todos)
 */
(function (global) {
  // Preço da loja vem da raridade (não de cada carro)
  global.NEON_RUSH_RARITIES = {
    common: {
      id: "common",
      name: "Comum",
      color: "#b8f3ff",
      priceMin: 70,
      priceMax: 120,
    },
    epic: {
      id: "epic",
      name: "Épico",
      color: "#c44dff",
      priceMin: 120,
      priceMax: 190,
    },
    legendary: {
      id: "legendary",
      name: "Lendário",
      color: "#ffd24a",
      priceMin: 200,
      priceMax: 240,
    },
  };

  global.NEON_RUSH_CARS = {
    starter: {
      id: "starter",
      name: "Starter",
      rarity: "common",
      model: "starter",
      bodyColor: [0.15, 0.75, 1],
      accentColor: [1, 0.2, 0.85],
      ownedByDefault: true,
    },
    turbocharger: {
      id: "turbocharger",
      name: "Turbocharger",
      rarity: "epic",
      model: "turbocharger",
      bodyColor: [0.95, 0.2, 0.35],
      accentColor: [1, 0.75, 0.15],
      ownedByDefault: false,
    },
    "rocket-car": {
      id: "rocket-car",
      name: "Rocket Car",
      rarity: "common",
      model: "rocket-car",
      bodyColor: [0.25, 0.85, 0.45],
      accentColor: [0.85, 0.9, 0.95],
      ownedByDefault: false,
    },
    "egg-car": {
      id: "egg-car",
      name: "Egg Car",
      rarity: "common",
      model: "egg-car",
      bodyColor: [1, 0.92, 0.55],
      accentColor: [1, 0.45, 0.2],
      ownedByDefault: false,
    },
    rolima: {
      id: "rolima",
      name: "Rolimã",
      rarity: "epic",
      model: "rolima",
      bodyColor: [0.55, 0.32, 0.14],
      accentColor: [0.95, 0.12, 0.22],
      ownedByDefault: false,
    },
    "policie-car": {
      id: "policie-car",
      name: "Policie Car",
      rarity: "common",
      model: "policie-car",
      bodyColor: [0.92, 0.93, 0.96],
      accentColor: [0.12, 0.28, 0.85],
      ownedByDefault: false,
    },
    flyght: {
      id: "flyght",
      name: "Flyght",
      rarity: "legendary",
      model: "flyght",
      bodyColor: [0.75, 0.82, 0.95],
      accentColor: [1, 0.82, 0.2],
      ownedByDefault: false,
    },
  };

  /** Sorteia um preço justo dentro da faixa da raridade do carro */
  global.neonRushRollCarPrice = function (carId) {
    const car = global.NEON_RUSH_CARS[carId];
    if (!car) return 0;
    const rarity = global.NEON_RUSH_RARITIES[car.rarity];
    if (!rarity) return 0;
    const min = rarity.priceMin;
    const max = rarity.priceMax;
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  global.NEON_RUSH_DEFAULT_CAR = "starter";
})(window);
