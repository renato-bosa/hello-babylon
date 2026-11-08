/**
 * Pacote de dados da pista: Sunset Rush
 * Mais curvas em S e tema magenta/laranja.
 */
(function (global) {
  global.NEON_RUSH_TRACKS = global.NEON_RUSH_TRACKS || {};

  global.NEON_RUSH_TRACKS["sunset-rush"] = {
    id: "sunset-rush",
    name: "Sunset Rush",

    controlPoints: [
      // --- Antes da largada ---
      [0, 0, -90],
      [0, 0, -45],

      // --- Largada ---
      [0, 0, 0],

      // --- Trecho de corrida (mais sinuoso) ---
      [0, 0, 40],
      [25, 0, 85],
      [55, 0, 130],
      [70, 0, 180],
      [45, 0, 230],
      [5, 0, 270],
      [-40, 0, 310],
      [-70, 0, 360],
      [-55, 0, 415],
      [-15, 0, 460],
      [30, 0, 505],
      [60, 0, 555],
      [40, 0, 610],
      [0, 0, 660],
      [-25, 0, 710],

      // --- Chegada ---
      [-30, 0, 760],

      // --- Depois da chegada ---
      [-30, 0, 805],
      [-30, 0, 850],
      [-30, 0, 900],
    ],

    startPoint: [0, 0, 0],
    finishPoint: [-30, 0, 760],

    theme: {
      edgeColor: [1, 0.35, 0.75],
      roadEmissive: [0.06, 0.02, 0.05],
    },
  };
})(window);
