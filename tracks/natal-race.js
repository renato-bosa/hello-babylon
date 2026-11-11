/**
 * Pacote de dados da pista: Natal Race
 * Mais longa; estrada normal; neve na calçada; prédio/pinheiro alternados.
 */
(function (global) {
  global.NEON_RUSH_TRACKS = global.NEON_RUSH_TRACKS || {};

  global.NEON_RUSH_TRACKS["natal-race"] = {
    id: "natal-race",
    name: "Natal Race",

    controlPoints: [
      // --- Antes da largada (reta contínua) ---
      [0, 0, -100],
      [0, 0, -50],

      // --- Largada ---
      [0, 0, 0],
      [0, 0, 60],

      // --- Curvas (sem “quebras” artificiais na reta) ---
      [25, 0, 120],
      [55, 0, 180],
      [40, 0, 250],
      [5, 0, 310],
      [-40, 0, 370],
      [-70, 0, 440],
      [-45, 0, 510],
      [0, 0, 580],
      [50, 0, 650],
      [80, 0, 730],
      [55, 0, 810],
      [10, 0, 880],
      [-35, 0, 950],
      [-65, 0, 1020],
      [-40, 0, 1090],
      [5, 0, 1160],
      [40, 0, 1220],
      [20, 0, 1280],
      [5, 0, 1310],

      // --- Chegada (reta alinhada) ---
      [0, 0, 1340],
      [0, 0, 1390],
      [0, 0, 1450],
      [0, 0, 1510],
    ],

    startPoint: [0, 0, 0],
    finishPoint: [0, 0, 1340],

    features: {
      christmas: true,
    },

    theme: {
      edgeColor: [0.95, 0.2, 0.25],
      roadEmissive: [0.04, 0.05, 0.08],
    },
  };
})(window);
