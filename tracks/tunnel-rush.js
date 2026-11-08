/**
 * Pacote de dados da pista: Tunel Rush
 * Longo túnel + descida suave depois da saída.
 */
(function (global) {
  global.NEON_RUSH_TRACKS = global.NEON_RUSH_TRACKS || {};

  global.NEON_RUSH_TRACKS["tunnel-rush"] = {
    id: "tunnel-rush",
    name: "Tunel Rush",

    controlPoints: [
      // --- Antes da largada ---
      [0, 0, -90],
      [0, 0, -45],

      // --- Largada ---
      [0, 0, 0],

      // --- Aproximação ---
      [0, 0, 55],
      [22, 0, 110],
      [45, 0, 170],
      [35, 0, 230],
      [12, 0, 285],

      // --- Entrada do túnel ---
      [0, 0, 330],
      [0, 0, 390],
      [8, 0, 450],
      [-6, 0, 510],
      [4, 0, 570],

      // --- Saída do túnel ---
      [0, 0, 620],

      // --- Descida suave ---
      [6, -1.8, 665],
      [12, -4.2, 710],
      [4, -6.5, 750],

      // --- Chegada no fundo ---
      [0, -8, 790],

      // --- Depois da chegada ---
      [0, -8, 835],
      [0, -7.6, 880],
      [0, -7.2, 930],
    ],

    startPoint: [0, 0, 0],
    finishPoint: [0, -8, 790],

    // Trecho coberto (sem prédios; anéis de túnel)
    features: {
      tunnel: {
        startPoint: [0, 0, 330],
        endPoint: [0, 0, 620],
      },
    },

    theme: {
      edgeColor: [0.25, 0.95, 0.85],
      roadEmissive: [0.02, 0.04, 0.06],
    },
  };
})(window);
