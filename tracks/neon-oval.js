/**
 * Pacote de dados da pista: Neon Oval
 * Oval estilo speedway — pista larga, 5 voltas.
 * Muro/arquibancada é só visual (sem física extra).
 */
(function (global) {
  global.NEON_RUSH_TRACKS = global.NEON_RUSH_TRACKS || {};

  global.NEON_RUSH_TRACKS["neon-oval"] = {
    id: "neon-oval",
    name: "Neon Oval",

    // Um loop completo; a chegada fica no FIM da lista (após a volta)
    controlPoints: [
      // Pré-largada
      [0, 0, -110],
      [0, 0, -80],

      // Largada (reta da frente)
      [0, 0, -50],
      [0, 0, -10],
      [0, 0, 40],
      [0, 0, 95],

      // Curva 1
      [40, 0, 145],
      [90, 0, 175],
      [140, 0, 145],
      [170, 0, 95],

      // Reta de trás
      [180, 0, 40],
      [180, 0, -10],
      [180, 0, -60],
      [180, 0, -110],

      // Curva 2
      [140, 0, -150],
      [90, 0, -175],
      [40, 0, -150],
      [0, 0, -110],

      // Fecha a volta na reta da frente (chegada de 1 volta)
      [0, 0, -80],
      [0, 0, -55],
      [0, 0, -40],
    ],

    startPoint: [0, 0, -50],
    finishPoint: [0, 0, -55],

    features: {
      ovalArena: true,
      roadWidth: 28,
      laneLimit: 13,
      laps: 5,
      botCount: 6,
      noBuildings: true,
      // Premiação maior: mapa pago, mais rivais e corrida mais longa
      coinRewards: { 1: 22, 2: 15, 3: 10 },
      requiresTicket: true,
      ticketCost: 1,
    },

    theme: {
      edgeColor: [1, 0.45, 0.15],
      roadEmissive: [0.05, 0.05, 0.08],
    },
  };
})(window);
