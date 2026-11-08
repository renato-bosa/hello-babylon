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
      [0, 0, 660],
      [-25, 0, 710],
      [-30, 0, 760],
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

  // Default só se ainda não houver pista ativa
  if (!global.NEON_RUSH_ACTIVE_TRACK) {
    global.NEON_RUSH_ACTIVE_TRACK = "neon-circuit-1";
  }
})(window);
