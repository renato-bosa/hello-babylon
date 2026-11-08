/**
 * Pacote de dados da pista: Praia Rush
 * Areia (sem asfalto/prédios), fitas laterais, curvas fechadas, mar após a chegada.
 * Versão inicial — refinamentos depois.
 */
(function (global) {
  global.NEON_RUSH_TRACKS = global.NEON_RUSH_TRACKS || {};

  global.NEON_RUSH_TRACKS["praia-rush"] = {
    id: "praia-rush",
    name: "Praia Rush",

    controlPoints: [
      // --- Antes da largada ---
      [0, 0, -80],
      [0, 0, -40],

      // --- Largada ---
      [0, 0, 0],

      // --- Curvas fechadas na areia ---
      [0, 0, 35],
      [45, 0, 70],
      [70, 0, 110],
      [40, 0, 145],
      [-25, 0, 175],
      [-70, 0, 215],
      [-45, 0, 255],
      [20, 0, 285],
      [65, 0, 325],
      [35, 0, 365],
      [-30, 0, 400],
      [-75, 0, 445],
      [-40, 0, 490],
      [15, 0, 530],
      [55, 0, 575],
      [25, 0, 620],
      [-20, 0, 660],
      [-50, 0, 705],
      [-25, 0, 745],

      // --- Chegada ---
      [0, 0, 785],

      // --- Areia até a beira ---
      [0, 0, 815],
      [0, 0, 845],
    ],

    startPoint: [0, 0, 0],
    finishPoint: [0, 0, 785],

    features: {
      beach: true,
      noBuildings: true,
      oceanAfterFinish: 28,
    },

    theme: {
      edgeColor: [1, 0.85, 0.25],
      roadEmissive: [0.22, 0.18, 0.08],
    },
  };
})(window);
