/**
 * Pacote de dados da pista: Neon Circuit 1
 * Formato preparado para o jogo carregar outras pistas no futuro.
 *
 * controlPoints: caminho completo (incluindo metros antes da largada e depois da chegada)
 * startPoint / finishPoint: onde a corrida começa e termina (não nas pontas do desenho)
 */
(function (global) {
  global.NEON_RUSH_TRACKS = global.NEON_RUSH_TRACKS || {};

  global.NEON_RUSH_TRACKS["neon-circuit-1"] = {
    id: "neon-circuit-1",
    name: "Neon Circuit 1",

    // Pontos de controle [x, y, z] — a curva passa por eles
    controlPoints: [
      // --- Antes da largada (pista visível / não corta abrupto) ---
      [0, 0, -90],
      [0, 0, -45],

      // --- Largada ---
      [0, 0, 0],

      // --- Trecho de corrida (pista original) ---
      [0, 0, 50],
      [8, 0, 100],
      [28, 0, 150],
      [35, 0, 210],
      [18, 0, 270],
      [-10, 0, 320],
      [-30, 0, 380],
      [-22, 0, 440],
      [0, 0, 500],
      [20, 0, 560],
      [12, 0, 620],
      [0, 0, 680],

      // --- Chegada ---
      [0, 0, 740],

      // --- Depois da chegada ---
      [0, 0, 785],
      [0, 0, 830],
      [0, 0, 880],
    ],

    // Marcadores da corrida (coordenadas iguais a pontos da lista)
    startPoint: [0, 0, 0],
    finishPoint: [0, 0, 740],

    // Aparência (para futuras pistas diferentes)
    theme: {
      edgeColor: [0.2, 0.95, 1],
      roadEmissive: [0.03, 0.03, 0.07],
    },
  };

  // Segunda pista (também em sunset-rush.js; fica aqui para garantir o seletor)
  global.NEON_RUSH_TRACKS["sunset-rush"] = {
    id: "sunset-rush",
    name: "Sunset Rush",
    controlPoints: [
      [0, 0, -90],
      [0, 0, -45],
      [0, 0, 0],
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
      [10, 0.4, 655],
      [-10, 2.2, 700],
      [-25, 5, 735],
      [-30, 8, 760],
      [-30, 8, 805],
      [-30, 7.6, 850],
      [-30, 7.2, 900],
    ],
    startPoint: [0, 0, 0],
    finishPoint: [-30, 8, 760],
    theme: {
      edgeColor: [1, 0.35, 0.75],
      roadEmissive: [0.06, 0.02, 0.05],
    },
  };

  // Terceira pista (também em tunnel-rush.js)
  global.NEON_RUSH_TRACKS["tunnel-rush"] = {
    id: "tunnel-rush",
    name: "Tunel Rush",
    controlPoints: [
      [0, 0, -90],
      [0, 0, -45],
      [0, 0, 0],
      [0, 0, 55],
      [22, 0, 110],
      [45, 0, 170],
      [35, 0, 230],
      [12, 0, 285],
      [0, 0, 330],
      [0, 0, 390],
      [8, 0, 450],
      [-6, 0, 510],
      [4, 0, 570],
      [0, 0, 620],
      [6, -1.8, 665],
      [12, -4.2, 710],
      [4, -6.5, 750],
      [0, -8, 790],
      [0, -8, 835],
      [0, -7.6, 880],
      [0, -7.2, 930],
    ],
    startPoint: [0, 0, 0],
    finishPoint: [0, -8, 790],
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

  // Quarta pista (também em praia-rush.js)
  global.NEON_RUSH_TRACKS["praia-rush"] = {
    id: "praia-rush",
    name: "Praia Rush",
    controlPoints: [
      [0, 0, -80],
      [0, 0, -40],
      [0, 0, 0],
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
      [0, 0, 785],
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

  // Default só se ainda não houver pista ativa
  if (!global.NEON_RUSH_ACTIVE_TRACK) {
    global.NEON_RUSH_ACTIVE_TRACK = "neon-circuit-1";
  }
})(window);
