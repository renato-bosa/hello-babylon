// Sistema: geometry. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.makeNeonMaterial = function makeNeonMaterial(name, scene, color, glow = 0.85) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = color.scale(0.25);
    mat.emissiveColor = color.scale(glow);
    mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.3);
    return mat;
  };

  app.createContinuousRoad = function createContinuousRoad(scene, path, roadMat, edgeMat, width, options) {
    const length = path.length();
    const half = width / 2;
    const { closed, dashStep } = options;
    // Blocos espaciais mantêm o descarte fora da câmera. As seções nas emendas
    // são compartilhadas; não há retângulos sobrepostos nas curvas.
    const chunkLength = 28;
    const sampleStep = 2;
    const start = closed ? 0 : -4;
    const end = closed ? length : Math.max(length, (Math.ceil(length / dashStep) - 1) * dashStep + 4);
    const section = distance => {
      const sample = app.samplePath(path, closed && distance === length ? 0 : distance);
      const position = sample.position.clone();
      if (distance < 0) position.addInPlace(sample.tangent.scale(distance));
      if (distance > length) position.addInPlace(sample.tangent.scale(distance - length));
      return { position, side: sample.binormal, up: BABYLON.Vector3.Cross(sample.tangent, sample.binormal).normalize() };
    };
    const point = (s, x, y) => s.position.add(s.side.scale(x)).add(s.up.scale(y));
    const buffer = () => ({ positions: [], indices: [], normals: [] });
    const strip = (data, sections, x1, y1, x2, y2) => {
      const offset = data.positions.length / 3;
      sections.forEach(s => {
        data.positions.push(...point(s, x1, y1).asArray(), ...point(s, x2, y2).asArray());
      });
      for (let i = 0; i < sections.length - 1; i++) {
        const a = offset + i * 2;
        data.indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    };
    const mesh = (name, data, material, parent) => {
      const result = new BABYLON.Mesh(name, scene);
      for (let i = 0; i < data.positions.length; i += 3) {
        data.positions[i] -= parent.position.x;
        data.positions[i + 1] -= parent.position.y;
        data.positions[i + 2] -= parent.position.z;
      }
      BABYLON.VertexData.ComputeNormals(data.positions, data.indices, data.normals);
      const vertices = new BABYLON.VertexData();
      Object.assign(vertices, data);
      vertices.applyToMesh(result);
      result.material = material;
      result.parent = parent;
      // O cenário só muda ao reconstruir a pista; evita recalcular estas
      // matrizes em cada quadro sem congelar materiais ou a lista visível.
      result.freezeWorldMatrix();
      return result;
    };
    const dashBox = BABYLON.VertexData.CreateBox({ width: 0.2, height: 0.05, depth: 3 });
    const groups = [];
    let previous = section(start);
    let dashIndex = 0;
    for (let from = start; from < end; from += chunkLength) {
      const to = Math.min(end, from + chunkLength);
      const count = Math.ceil((to - from) / sampleStep);
      const sections = [previous];
      for (let i = 1; i <= count; i++) sections.push(section(from + (to - from) * i / count));
      previous = sections[sections.length - 1];
      const id = groups.length;
      const group = new BABYLON.TransformNode("roadPiece_" + id, scene);
      group.position.copyFrom(sections[0].position);
      const road = buffer();
      strip(road, sections, -half, 0, half, 0);
      mesh("road_" + id, road, roadMat, group);
      const edges = buffer();
      for (const side of [-1, 1]) {
        const left = side * half - 0.125;
        const right = side * half + 0.125;
        strip(edges, sections, left, 0, left, 0.2);
        strip(edges, sections, left, 0.2, right, 0.2);
        strip(edges, sections, right, 0.2, right, 0);
        strip(edges, sections, right, 0, left, 0);
      }
      // Bordas e marcações usam o mesmo material e o mesmo trecho espacial.
      // Compartilhar o mesh elimina uma chamada de desenho por trecho.
      const dashes = edges;
      while (dashIndex * dashStep < Math.min(to, length)) {
        const sample = app.samplePath(path, dashIndex++ * dashStep);
        const rotation = BABYLON.Quaternion.RotationYawPitchRoll(
          app.yawFromTangent(sample.tangent), app.pitchFromTangent(sample.tangent), 0
        );
        const up = BABYLON.Vector3.Cross(sample.tangent, sample.binormal).normalize();
        const transform = BABYLON.Matrix.Compose(BABYLON.Vector3.One(), rotation, sample.position.add(up.scale(0.03)));
        const offset = dashes.positions.length / 3;
        for (let i = 0; i < dashBox.positions.length; i += 3) {
          dashes.positions.push(...BABYLON.Vector3.TransformCoordinates(
            BABYLON.Vector3.FromArray(dashBox.positions, i), transform
          ).asArray());
        }
        dashes.indices.push(...dashBox.indices.map(i => i + offset));
      }
      mesh("roadEdges_" + id, edges, edgeMat, group);
      groups.push(group);
    }
    return groups;
  };

  app.createOvalGrandstand = function createOvalGrandstand(scene, sample, dir, roadHalf, id, mats) {
    const group = new BABYLON.TransformNode("ovalStand_" + id, scene);
    group.position.copyFrom(sample.position);
    group.rotation.y = app.yawFromTangent(sample.tangent);
    group.rotation.x = app.pitchFromTangent(sample.tangent);

    // Berma inclinada (só visual)
    const berm = BABYLON.MeshBuilder.CreateBox(
      "ovalBerm_" + id,
      { width: 7.5, height: 3.2, depth: 9 },
      scene
    );
    berm.position.set(dir * (roadHalf + 4.0), 1.2, 0);
    berm.rotation.z = dir * -0.42;
    berm.material = mats.berm;
    berm.parent = group;

    // Muro alto — tapa o horizonte
    const wall = BABYLON.MeshBuilder.CreateBox(
      "ovalWall_" + id,
      { width: 1.6, height: 10, depth: 9 },
      scene
    );
    wall.position.set(dir * (roadHalf + 8.8), 4.6, 0);
    wall.material = mats.wall;
    wall.parent = group;

    // Degraus de arquibancada
    const seat = BABYLON.MeshBuilder.CreateBox(
      "ovalSeat_" + id,
      { width: 4.5, height: 0.35, depth: 8.6 },
      scene
    );
    seat.position.set(dir * (roadHalf + 5.5), 2.6, 0);
    seat.material = mats.seat;
    seat.parent = group;

    const neon = BABYLON.MeshBuilder.CreateBox(
      "ovalNeon_" + id,
      { width: 0.35, height: 0.35, depth: 9 },
      scene
    );
    neon.position.set(dir * (roadHalf + 8.8), 9.7, 0);
    neon.material = mats.neon;
    neon.parent = group;

    return group;
  };

  app.createOvalInnerCurb = function createOvalInnerCurb(scene, sample, dir, roadHalf, id, mats) {
    const group = new BABYLON.TransformNode("ovalCurb_" + id, scene);
    group.position.copyFrom(sample.position);
    group.rotation.y = app.yawFromTangent(sample.tangent);
    group.rotation.x = app.pitchFromTangent(sample.tangent);

    const curb = BABYLON.MeshBuilder.CreateBox(
      "ovalCurbMesh_" + id,
      { width: 0.9, height: 0.4, depth: 8.5 },
      scene
    );
    curb.position.set(dir * (roadHalf + 0.55), 0.18, 0);
    curb.material = mats.neon;
    curb.parent = group;
    return group;
  };

  app.createBeachSandField = function createBeachSandField(scene, path3D, trackLength, sandMat) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const sampleStep = Math.max(12, trackLength / 40);
    for (let d = 0; d <= trackLength; d += sampleStep) {
      const p = path3D.getPointAt(
        Math.max(0, Math.min(1, d / trackLength))
      );
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const margin = 140;
    const width = maxX - minX + margin * 2;
    const depth = maxZ - minZ + margin * 2;
    const sand = BABYLON.MeshBuilder.CreateGround(
      "beachSandField",
      { width: width, height: depth },
      scene
    );
    sand.position.set((minX + maxX) / 2, -0.04, (minZ + maxZ) / 2);
    sand.material = sandMat;
    return sand;
  };

  app.createBeachTape = function createBeachTape(scene, sample, side, tapeA, tapeB) {
    const sid = app.beachTapeSerial++;
    const group = new BABYLON.TransformNode("beachTape_" + sid, scene);
    group.position.copyFrom(sample.position);
    group.rotation.y = app.yawFromTangent(sample.tangent);
    group.rotation.x = app.pitchFromTangent(sample.tangent);

    const post = BABYLON.MeshBuilder.CreateBox(
      "tapePost_" + sid,
      { width: 0.08, height: 0.85, depth: 0.08 },
      scene
    );
    post.position.set(side * 7.1, 0.42, 0);
    post.material = tapeB;
    post.parent = group;

    const ribbon = BABYLON.MeshBuilder.CreateBox(
      "tapeRibbon_" + sid,
      { width: 0.06, height: 0.22, depth: 7.2 },
      scene
    );
    ribbon.position.set(side * 7.1, 0.72, 0);
    ribbon.material = sid % 2 === 0 ? tapeA : tapeB;
    ribbon.parent = group;

    return group;
  };

  app.createOceanPlane = function createOceanPlane(scene, sample, oceanMat) {
    const group = new BABYLON.TransformNode("oceanPad", scene);
    group.position.copyFrom(sample.position);
    group.rotation.y = app.yawFromTangent(sample.tangent);

    const water = BABYLON.MeshBuilder.CreateGround(
      "oceanWater",
      { width: 520, height: 260 },
      scene
    );
    // Começa um pouco à frente e segue longe; y leve abaixo da areia
    water.position.set(0, -0.12, 110);
    water.material = oceanMat;
    water.parent = group;
    return group;
  };

  app.createTunnelRing = function createTunnelRing(scene, sample, wallMat, neonMat) {
    const sid = app.tunnelRingSerial++;
    const group = new BABYLON.TransformNode("tunnelRing_" + sid, scene);
    group.position.copyFrom(sample.position);
    group.rotation.y = app.yawFromTangent(sample.tangent);
    group.rotation.x = app.pitchFromTangent(sample.tangent);

    const left = BABYLON.MeshBuilder.CreateBox(
      "tunnelL_" + sid,
      { width: 0.45, height: 5.2, depth: 9.5 },
      scene
    );
    left.position.set(-7.6, 2.6, 0);
    left.material = wallMat;
    left.parent = group;

    const right = left.clone("tunnelR_" + sid);
    right.position.x = 7.6;
    right.parent = group;

    const roof = BABYLON.MeshBuilder.CreateBox(
      "tunnelRoof_" + sid,
      { width: 15.6, height: 0.4, depth: 9.5 },
      scene
    );
    roof.position.set(0, 5.2, 0);
    roof.material = wallMat;
    roof.parent = group;

    // Faixa neon no teto (barata: 1 caixa)
    const strip = BABYLON.MeshBuilder.CreateBox(
      "tunnelStrip_" + sid,
      { width: 0.35, height: 0.12, depth: 9.2 },
      scene
    );
    strip.position.set(0, 5.0, 0);
    strip.material = neonMat;
    strip.parent = group;

    return group;
  };

  app.createFinishLine = function createFinishLine(scene, sample, roadWidth) {
    const sid = app.finishLineSerial++;
    const width = roadWidth || 14;
    const half = width / 2;
    const gate = new BABYLON.TransformNode("finishGate_" + sid, scene);
    gate.position.copyFrom(sample.position);
    gate.rotation.y = app.yawFromTangent(sample.tangent);
    gate.rotation.x = app.pitchFromTangent(sample.tangent);

    const pink = app.makeNeonMaterial(
      "finishPink_" + sid,
      scene,
      new BABYLON.Color3(1, 0.2, 0.85),
      1
    );
    const cyan = app.makeNeonMaterial(
      "finishCyan_" + sid,
      scene,
      new BABYLON.Color3(0.2, 0.95, 1),
      1
    );
    const white = app.makeNeonMaterial(
      "finishWhite_" + sid,
      scene,
      new BABYLON.Color3(1, 1, 1),
      0.9
    );

    const leftPost = BABYLON.MeshBuilder.CreateBox(
      "leftPost_" + sid,
      { width: 0.4, height: 6, depth: 0.4 },
      scene
    );
    leftPost.position.set(-half, 3, 0);
    leftPost.material = pink;
    leftPost.parent = gate;

    const rightPost = BABYLON.MeshBuilder.CreateBox(
      "rightPost_" + sid,
      { width: 0.4, height: 6, depth: 0.4 },
      scene
    );
    rightPost.position.set(half, 3, 0);
    rightPost.material = cyan;
    rightPost.parent = gate;

    // Faixa com texto FINISH (frente e verso)
    const finishTex = new BABYLON.DynamicTexture(
      "finishText_" + sid,
      { width: 1024, height: 256 },
      scene,
      false
    );
    finishTex.hasAlpha = true;
    const ctx = finishTex.getContext();
    ctx.clearRect(0, 0, 1024, 256);
    ctx.fillStyle = "#1a0428";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.strokeStyle = "#ff4fd8";
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, 1000, 232);
    finishTex.update();
    finishTex.drawText(
      "FINISH",
      null,
      170,
      "bold 140px Segoe UI, Arial",
      "#b8f3ff",
      null,
      true
    );

    const bannerMat = new BABYLON.StandardMaterial(
      "finishBannerMat_" + sid,
      scene
    );
    bannerMat.diffuseTexture = finishTex;
    bannerMat.emissiveTexture = finishTex;
    bannerMat.emissiveColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    // Sem segunda placa: evita flicker. Sem culling: continua visível na aproximação.
    bannerMat.backFaceCulling = false;

    const bannerWidth = Math.max(12, width - 2);
    const banner = BABYLON.MeshBuilder.CreatePlane(
      "finishBanner_" + sid,
      { width: bannerWidth, height: 1.6 },
      scene
    );
    banner.position.set(0, 5.4, 0);
    banner.material = bannerMat;
    banner.parent = gate;

    const stripeCount = Math.max(8, Math.round(width / 1.75));
    const stripeWidth = width / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const stripe = BABYLON.MeshBuilder.CreateBox(
        "finishStripe_" + sid + "_" + i,
        { width: stripeWidth * 0.92, height: 0.06, depth: 1.2 },
        scene
      );
      stripe.position.set(
        -half + stripeWidth * (i + 0.5),
        0.04,
        0
      );
      stripe.material = i % 2 === 0 ? white : pink;
      stripe.parent = gate;
    }

    return gate;
  };

  app.colorToRgb = function colorToRgb(color, brightness) {
    const r = Math.round(Math.min(1, color.r * brightness) * 255);
    const g = Math.round(Math.min(1, color.g * brightness) * 255);
    const b = Math.round(Math.min(1, color.b * brightness) * 255);
    return "rgb(" + r + "," + g + "," + b + ")";
  };

  app.getFacadeTexture = function getFacadeTexture(scene, bucket, colorIndex, color) {
    const key = bucket + "_" + colorIndex;
    if (app.facadeTextureCache[key]) return app.facadeTextureCache[key];

    const rowsByBucket = { short: 4, mid: 7, tall: 10 };
    const rows = rowsByBucket[bucket] || 7;
    const cols = 3;
    const sizeW = 256;
    const sizeH = 512;
    const tex = new BABYLON.DynamicTexture(
      "facade_" + key,
      { width: sizeW, height: sizeH },
      scene,
      true
    );
    const ctx = tex.getContext();

    // Fundo preto sólido (parede)
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#03030a";
    ctx.fillRect(0, 0, sizeW, sizeH);

    // Porta de vidro na cor neon
    const doorW = sizeW * 0.28;
    const doorH = sizeH * 0.11;
    ctx.fillStyle = app.colorToRgb(color, 0.9);
    ctx.fillRect((sizeW - doorW) / 2, sizeH - doorH - 8, doorW, doorH);
    ctx.strokeStyle = app.colorToRgb(color, 1);
    ctx.lineWidth = 3;
    ctx.strokeRect((sizeW - doorW) / 2, sizeH - doorH - 8, doorW, doorH);

    // Janelas coloridas (acesas / apagadas)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (r === 0 && c === 1) continue;
        const lit = Math.random() > 0.22;
        ctx.fillStyle = lit
          ? app.colorToRgb(color, 0.75 + Math.random() * 0.35)
          : "#0c0c14";
        const cellW = sizeW / cols;
        const cellH = (sizeH * 0.82) / rows;
        const ww = cellW * 0.58;
        const wh = cellH * 0.48;
        const x = c * cellW + (cellW - ww) / 2;
        const y = 12 + r * cellH + (cellH - wh) / 2;
        ctx.fillRect(x, y, ww, wh);
      }
    }

    tex.hasAlpha = false;
    tex.update(true);
    app.facadeTextureCache[key] = tex;
    return tex;
  };

  app.createBuilding = function createBuilding(scene, position, neonColors, id) {
    const height = 6 + Math.random() * 18;
    const width = 3 + Math.random() * 3;
    const depth = 3 + Math.random() * 3;
    const group = new BABYLON.TransformNode("buildingGroup_" + id, scene);
    group.position.copyFrom(position);

    const colorIndex = Math.floor(Math.random() * neonColors.length);
    const color = neonColors[colorIndex];
    const bucket = height < 10 ? "short" : height < 16 ? "mid" : "tall";
    const facadeTex = app.getFacadeTexture(scene, bucket, colorIndex, color);

    const building = BABYLON.MeshBuilder.CreateBox(
      "building_" + id,
      { width: width, height: height, depth: depth },
      scene
    );
    building.position.y = height / 2;
    building.parent = group;

    const mat = new BABYLON.StandardMaterial("buildMat_" + id, scene);
    // Textura na diffuse (paredes pretas + janelas coloridas)
    // e um pouco na emissive (brilho neon só onde a textura é clara)
    mat.diffuseTexture = facadeTex;
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mat.emissiveTexture = facadeTex;
    mat.emissiveColor = new BABYLON.Color3(0.55, 0.55, 0.55);
    mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.08);
    mat.disableLighting = false;
    building.material = mat;

    return group;
  };

  app.createPineTree = function createPineTree(scene, position, id) {
    const group = new BABYLON.TransformNode("pine_" + id, scene);
    group.position.copyFrom(position);

    const trunkMat = new BABYLON.StandardMaterial("pineTrunk_" + id, scene);
    trunkMat.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.08);
    trunkMat.emissiveColor = new BABYLON.Color3(0.06, 0.03, 0.02);

    const leafMat = app.makeNeonMaterial(
      "pineLeaf_" + id,
      scene,
      new BABYLON.Color3(0.12, 0.55, 0.22),
      0.45
    );
    const ornamentMat = app.makeNeonMaterial(
      "pineOrnament_" + id,
      scene,
      id % 2 === 0
        ? new BABYLON.Color3(1, 0.2, 0.25)
        : new BABYLON.Color3(1, 0.85, 0.2),
      0.9
    );

    const trunk = BABYLON.MeshBuilder.CreateCylinder(
      "pineTrunkMesh_" + id,
      { diameter: 0.35, height: 1.4, tessellation: 8 },
      scene
    );
    trunk.position.y = 0.7;
    trunk.material = trunkMat;
    trunk.parent = group;

    // Copas em camadas (barato e legível)
    const layers = [
      { y: 2.0, d: 2.4 },
      { y: 3.1, d: 1.8 },
      { y: 4.0, d: 1.2 },
    ];
    layers.forEach(function (layer, i) {
      const cone = BABYLON.MeshBuilder.CreateCylinder(
        "pineCone_" + id + "_" + i,
        {
          diameterTop: 0.05,
          diameterBottom: layer.d,
          height: 1.35,
          tessellation: 10,
        },
        scene
      );
      cone.position.y = layer.y;
      cone.material = leafMat;
      cone.parent = group;
    });

    const star = BABYLON.MeshBuilder.CreateSphere(
      "pineStar_" + id,
      { diameter: 0.28, segments: 6 },
      scene
    );
    star.position.y = 4.75;
    star.material = ornamentMat;
    star.parent = group;

    return group;
  };

  app.createSnowSidewalk = function createSnowSidewalk(scene, sample, side, snowMat, index) {
    const group = new BABYLON.TransformNode(
      "snowWalk_" + index,
      scene
    );
    group.position.copyFrom(sample.position);
    group.rotation.y = app.yawFromTangent(sample.tangent);
    group.rotation.x = app.pitchFromTangent(sample.tangent);

    const snow = BABYLON.MeshBuilder.CreateGround(
      "snowPad_" + index,
      { width: 5.5, height: 8 },
      scene
    );
    // Fora da pista, perto dos prédios/pinheiros
    snow.position.set(side * 10.2, 0.02, 0);
    snow.material = snowMat;
    snow.parent = group;
    return group;
  };
}

export function initializeSceneryCache(app) {
  app.beachTapeSerial = 0;
  app.tunnelRingSerial = 0;
  app.finishLineSerial = 0;
  app.facadeTextureCache = {};
}
