// Sistema: world. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.getTunnelRange = function getTunnelRange() {
    const feat =
      world.track.data.features && world.track.data.features.tunnel
        ? world.track.data.features.tunnel
        : null;
    if (!feat || !feat.startPoint || !feat.endPoint) return null;
    const startPos = BABYLON.Vector3.FromArray(feat.startPoint);
    const endPos = BABYLON.Vector3.FromArray(feat.endPoint);
    const startDist = world.path3D.getDistanceAt(
      world.path3D.getClosestPositionTo(startPos)
    );
    const endDist = world.path3D.getDistanceAt(
      world.path3D.getClosestPositionTo(endPos)
    );
    return {
      startDist: Math.min(startDist, endDist),
      endDist: Math.max(startDist, endDist),
    };
  };

  world.clearTrackWorld = function clearTrackWorld() {
    while (world.roadPieces.length) {
      const piece = world.roadPieces.pop();
      if (piece) piece.dispose();
    }
    while (world.buildingGroups.length) {
      const group = world.buildingGroups.pop();
      if (group) group.dispose();
    }
    while (world.tunnelRings.length) {
      const ring = world.tunnelRings.pop();
      if (ring) ring.dispose();
    }
    while (world.beachProps.length) {
      const prop = world.beachProps.pop();
      if (prop) prop.dispose();
    }
    if (world.finishGate) {
      world.finishGate.dispose();
      world.finishGate = null;
    }
  };

  world.buildTrackWorld = function buildTrackWorld() {
    const features = world.track.data.features || {};
    const isBeach = !!features.beach;
    const step = 7;
    const worldPath = world.track.closedPath3D || world.path3D;
    const worldLength = worldPath.length();
    const worldPieceCount = Math.ceil(worldLength / step);
    // Distribui marcações e cenário pela volta inteira.
    const worldStep = features.ovalArena
      ? worldLength / worldPieceCount
      : step;

    if (isBeach) {
      // Um único chão de areia — sem fendas pretas entre pedaços
      world.beachProps.push(
        app.createBeachSandField(world.scene, world.path3D, world.trackLength, world.sandMat)
      );
      for (let d = 0; d < world.trackLength; d += step) {
        if (d < world.track.startDist - 5 || d > world.track.finishDist + 20) {
          continue;
        }
        const sample = app.samplePath(world.path3D, d);
        world.beachProps.push(
          app.createBeachTape(world.scene, sample, -1, world.tapeMatA, world.tapeMatB)
        );
        world.beachProps.push(
          app.createBeachTape(world.scene, sample, 1, world.tapeMatA, world.tapeMatB)
        );
      }
    } else {
      const roadWidth = features.roadWidth || 14;
      world.roadPieces.push(...app.createContinuousRoad(
        world.scene, worldPath, world.roadMat, world.edgeMat, roadWidth,
        { closed: !!features.ovalArena, dashStep: worldStep }
      ));
    }

    world.finishSample = app.samplePath(world.path3D, world.track.finishDist);
    world.finishGate = app.createFinishLine(
      world.scene,
      world.finishSample,
      features.roadWidth || 14
    );

    const tunnel = world.getTunnelRange();

    // Túnel: anéis espaçados (leve — sem prédios dentro)
    if (tunnel) {
      if (!world.tunnelWallMat) {
        world.tunnelWallMat = new BABYLON.StandardMaterial(
          "tunnelWallMat",
          world.scene
        );
        world.tunnelWallMat.diffuseColor = new BABYLON.Color3(0.06, 0.08, 0.12);
        world.tunnelWallMat.emissiveColor = new BABYLON.Color3(0.03, 0.05, 0.08);
      }
      if (!world.tunnelNeonMat) {
        world.tunnelNeonMat = app.makeNeonMaterial(
          "tunnelNeonMat",
          world.scene,
          new BABYLON.Color3(0.2, 1, 0.85),
          0.95
        );
      }
      for (
        let d = tunnel.startDist;
        d <= tunnel.endDist;
        d += step * 1.4
      ) {
        world.tunnelRings.push(
          app.createTunnelRing(
            world.scene,
            app.samplePath(world.path3D, d),
            world.tunnelWallMat,
            world.tunnelNeonMat
          )
        );
      }
    }

    // Mar logo após a chegada (praia): faixa larga, não um “quadrado”
    if (typeof features.oceanAfterFinish === "number") {
      const oceanDist =
        world.track.finishDist + Math.max(10, features.oceanAfterFinish);
      world.beachProps.push(
        app.createOceanPlane(
          world.scene,
          app.samplePath(world.path3D, Math.min(world.trackLength - 1, oceanDist)),
          world.oceanMat
        )
      );
    }

    // Oval speedway: arquibancada/muro visual + gramado interno
    if (features.ovalArena) {
      const roadWidth = features.roadWidth || 28;
      const roadHalf = roadWidth / 2;
      const bermMat = new BABYLON.StandardMaterial("ovalBermMat", world.scene);
      bermMat.diffuseColor = new BABYLON.Color3(0.22, 0.14, 0.1);
      bermMat.emissiveColor = new BABYLON.Color3(0.1, 0.05, 0.03);
      const wallMat = new BABYLON.StandardMaterial("ovalWallMat", world.scene);
      wallMat.diffuseColor = new BABYLON.Color3(0.08, 0.09, 0.14);
      wallMat.emissiveColor = new BABYLON.Color3(0.05, 0.06, 0.1);
      const seatMat = new BABYLON.StandardMaterial("ovalSeatMat", world.scene);
      seatMat.diffuseColor = new BABYLON.Color3(0.35, 0.12, 0.1);
      seatMat.emissiveColor = new BABYLON.Color3(0.18, 0.05, 0.04);
      const ovalMats = {
        berm: bermMat,
        wall: wallMat,
        seat: seatMat,
        neon: world.edgeMat,
      };

      let cx = 0;
      let cz = 0;
      let samples = 0;
      for (let d = 0; d < worldLength; d += 18) {
        const p = worldPath.getPointAt(
          Math.max(0, Math.min(1, d / worldLength))
        );
        cx += p.x;
        cz += p.z;
        samples += 1;
      }
      cx /= Math.max(1, samples);
      cz /= Math.max(1, samples);
      const center = new BABYLON.Vector3(cx, 0, cz);

      const infieldMat = new BABYLON.StandardMaterial(
        "ovalInfieldMat",
        world.scene
      );
      infieldMat.diffuseColor = new BABYLON.Color3(0.08, 0.16, 0.1);
      infieldMat.emissiveColor = new BABYLON.Color3(0.03, 0.08, 0.04);
      const infield = BABYLON.MeshBuilder.CreateGround(
        "ovalInfield",
        { width: 150, height: 240 },
        world.scene
      );
      infield.position.set(cx, -0.05, cz);
      infield.material = infieldMat;
      world.beachProps.push(infield);

      let standId = 0;
      // Arquibancada nos dois lados (bowl) — sempre visível
      for (let i = 0; i < worldPieceCount; i++) {
        const d = i * worldStep;
        const sample = app.samplePath(worldPath, d);
        [-1, 1].forEach(function (dir) {
          world.beachProps.push(
            app.createOvalGrandstand(
              world.scene,
              sample,
              dir,
              // Folga para os cantos das peças retas nas curvas mais fechadas.
              roadHalf + 2,
              standId++,
              ovalMats
            )
          );
        });
      }

      // Prédios atrás do muro (fora do bowl)
      let buildingId = 0;
      for (let d = 20; d < worldLength; d += 28) {
        const sample = app.samplePath(worldPath, d);
        const side = sample.binormal;
        [-1, 1].forEach(function (dir) {
          const pos = sample.position.add(
            side.scale(dir * (roadHalf + 18 + (buildingId % 3)))
          );
          world.buildingGroups.push(
            app.createBuilding(world.scene, pos, world.neonColors, buildingId++)
          );
        });
      }
      return;
    }

    if (features.noBuildings) {
      return;
    }

    const isChristmas = !!features.christmas;
    // Natal: menos props e mais espaçados (prédio / pinheiro)
    const sceneryStep = isChristmas ? 20 : 14;
    let buildingId = 0;
    let sceneryIndex = 0;

    for (let d = 10; d < world.trackLength; d += sceneryStep) {
      if (
        tunnel &&
        d >= tunnel.startDist - 6 &&
        d <= tunnel.endDist + 6
      ) {
        continue;
      }
      const sample = app.samplePath(world.path3D, d);
      const side = sample.binormal;

      if (isChristmas) {
        world.beachProps.push(
          app.createSnowSidewalk(world.scene, sample, -1, world.snowMat, sceneryIndex)
        );
        world.beachProps.push(
          app.createSnowSidewalk(world.scene, sample, 1, world.snowMat, sceneryIndex + 10000)
        );
      }

      // Ao longo da pista: prédio, pinheiro, prédio, pinheiro...
      const usePine =
        isChristmas &&
        Math.floor((d - 10) / sceneryStep) % 2 === 1;

      [-1, 1].forEach(function (dir) {
        const pos = sample.position.add(
          side.scale(dir * (12 + Math.random() * 6))
        );
        if (usePine) {
          world.buildingGroups.push(app.createPineTree(world.scene, pos, buildingId++));
        } else {
          world.buildingGroups.push(
            app.createBuilding(world.scene, pos, world.neonColors, buildingId++)
          );
        }
      });
      sceneryIndex += 1;
    }
  };

  world.applyTrackTheme = function applyTrackTheme(trackData) {
    const edge = trackData.theme.edgeColor;
    const edgeColor = new BABYLON.Color3(edge[0], edge[1], edge[2]);
    world.edgeMat.diffuseColor = edgeColor.scale(0.25);
    world.edgeMat.emissiveColor = edgeColor.scale(1);
    const road = trackData.theme.roadEmissive;
    world.roadMat.emissiveColor = new BABYLON.Color3(road[0], road[1], road[2]);
    if (trackData.features && trackData.features.beach) {
      world.sandMat.emissiveColor = new BABYLON.Color3(
        road[0],
        road[1],
        road[2]
      );
    }
    world.scene.fogDensity = 0.006;
  };
}

export function initializeWorld(app, world) {
  world.scene = new BABYLON.Scene(app.engine);
  world.scene.clearColor = new BABYLON.Color4(0.02, 0.01, 0.08, 1);
  world.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  world.scene.fogDensity = 0.006;
  world.scene.fogColor = new BABYLON.Color3(0.04, 0.02, 0.1);
  world.hemi = new BABYLON.HemisphericLight(
    "hemi",
    new BABYLON.Vector3(0, 1, 0),
    world.scene
  );
  world.hemi.intensity = 0.35;
  world.hemi.groundColor = new BABYLON.Color3(0.05, 0.02, 0.1);
  world.neonColors = [
    new BABYLON.Color3(1, 0.2, 0.85),
    new BABYLON.Color3(0.2, 0.9, 1),
    new BABYLON.Color3(0.5, 0.3, 1),
    new BABYLON.Color3(1, 0.5, 0.2),
  ];
  world.roadMat = new BABYLON.StandardMaterial("roadMat", world.scene);
  world.roadMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.08);
  world.roadMat.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.07);
  world.sandMat = new BABYLON.StandardMaterial("sandMat", world.scene);
  world.sandMat.diffuseColor = new BABYLON.Color3(0.72, 0.58, 0.32);
  world.sandMat.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.06);
  world.sandMat.specularColor = new BABYLON.Color3(0.08, 0.07, 0.04);
  world.snowMat = new BABYLON.StandardMaterial("snowMat", world.scene);
  world.snowMat.diffuseColor = new BABYLON.Color3(0.85, 0.9, 0.98);
  world.snowMat.emissiveColor = new BABYLON.Color3(0.35, 0.4, 0.5);
  world.snowMat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.25);
  world.tapeMatA = app.makeNeonMaterial(
    "tapeMatA",
    world.scene,
    new BABYLON.Color3(1, 0.85, 0.15),
    0.75
  );
  world.tapeMatB = app.makeNeonMaterial(
    "tapeMatB",
    world.scene,
    new BABYLON.Color3(1, 0.25, 0.2),
    0.7
  );
  world.oceanMat = new BABYLON.StandardMaterial("oceanMat", world.scene);
  world.oceanMat.diffuseColor = new BABYLON.Color3(0.08, 0.35, 0.65);
  world.oceanMat.emissiveColor = new BABYLON.Color3(0.05, 0.28, 0.55);
  world.oceanMat.alpha = 0.88;
  world.oceanMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
  world.oceanMat.backFaceCulling = false;
  world.track = app.buildTrackFromData(app.getActiveTrackData());
  world.path3D = world.track.path3D;
  world.trackLength = world.track.trackLength;
  world.finishSample = app.samplePath(world.path3D, world.track.finishDist);
  world.themeEdge = world.track.data.theme.edgeColor;
  world.edgeMat = app.makeNeonMaterial(
    "edgeMat",
    world.scene,
    new BABYLON.Color3(world.themeEdge[0], world.themeEdge[1], world.themeEdge[2]),
    1
  );
  world.themeRoad = world.track.data.theme.roadEmissive;
  world.roadMat.emissiveColor = new BABYLON.Color3(
    world.themeRoad[0],
    world.themeRoad[1],
    world.themeRoad[2]
  );
  world.roadPieces = [];
  world.buildingGroups = [];
  world.tunnelRings = [];
  world.beachProps = [];
  world.finishGate = null;
  world.tunnelWallMat = null;
  world.tunnelNeonMat = null;
  world.buildTrackWorld();
}

export function bindTrackSwitch(app, world) {
  app.switchTrackInScene = function (trackId, options) {
    const opts = options || {};
    const force = !!opts.force;
    if (
      !force &&
      (!world.inMenu || app.perfTestRunning || world.countdownActive)
    ) {
      return false;
    }
    if (!window.NEON_RUSH_TRACKS || !window.NEON_RUSH_TRACKS[trackId]) {
      return false;
    }

    if (!force) {
      world.closeGarage({ restoreCar: true });
      world.closeShop({ restoreCar: true });
    }

    world.clearTrackWorld();
    world.track = app.buildTrackFromData(window.NEON_RUSH_TRACKS[trackId]);
    world.path3D = world.track.path3D;
    world.trackLength = world.track.trackLength;
    world.applyTrackTheme(world.track.data);
    world.buildTrackWorld();
    world.syncActiveRacers();
    world.placeGrid();
    if (!app.botBench.active) {
      world.enterMenuCamera();
      app.placeLabel.textContent = "Posição: 1º / " + world.getFieldSize();
    }
    return true;
  };
}
