// Sistema: shop-previews. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.createMultiplierItemPreview = function createMultiplierItemPreview(scene, id) {
    const root = new BABYLON.TransformNode("shopItem_" + id, scene);

    const goldMat = new BABYLON.StandardMaterial("multGold_" + id, scene);
    goldMat.diffuseColor = new BABYLON.Color3(1, 0.78, 0.2);
    goldMat.emissiveColor = new BABYLON.Color3(0.55, 0.32, 0.05);
    goldMat.specularColor = new BABYLON.Color3(1, 0.9, 0.4);

    const neonMat = app.makeNeonMaterial(
      "multNeon_" + id,
      scene,
      new BABYLON.Color3(0.22, 1, 0.62),
      1
    );
    const darkMat = new BABYLON.StandardMaterial("multDark_" + id, scene);
    darkMat.diffuseColor = new BABYLON.Color3(0.07, 0.1, 0.12);
    darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.05, 0.04);

    const pedestal = BABYLON.MeshBuilder.CreateCylinder(
      "multPed_" + id,
      { diameter: 2.1, height: 0.16, tessellation: 28 },
      scene
    );
    pedestal.position.y = 0.08;
    pedestal.material = darkMat;
    pedestal.parent = root;

    const ring = BABYLON.MeshBuilder.CreateTorus(
      "multRing_" + id,
      { diameter: 2.0, thickness: 0.09, tessellation: 40 },
      scene
    );
    ring.position.y = 0.16;
    ring.material = neonMat;
    ring.parent = root;

    for (let i = 0; i < 3; i++) {
      const coin = BABYLON.MeshBuilder.CreateCylinder(
        "multCoin_" + id + "_" + i,
        { diameter: 1.5 - i * 0.06, height: 0.18, tessellation: 36 },
        scene
      );
      coin.position.y = 0.35 + i * 0.22;
      coin.material = goldMat;
      coin.parent = root;

      const edge = BABYLON.MeshBuilder.CreateTorus(
        "multEdge_" + id + "_" + i,
        { diameter: 1.5 - i * 0.06, thickness: 0.06, tessellation: 36 },
        scene
      );
      edge.position.y = coin.position.y;
      edge.material = neonMat;
      edge.parent = root;
    }

    // Placa ×3 com texto (evita geometria espelhada ao girar)
    const badge = BABYLON.MeshBuilder.CreatePlane(
      "multBadge_" + id,
      { width: 1.5, height: 0.85 },
      scene
    );
    badge.position.y = 1.85;
    badge.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    const badgeMat = new BABYLON.StandardMaterial("multBadgeMat_" + id, scene);
    const badgeTex = new BABYLON.DynamicTexture(
      "multBadgeTex_" + id,
      { width: 256, height: 160 },
      scene,
      false
    );
    badgeTex.hasAlpha = true;
    const ctx = badgeTex.getContext();
    ctx.clearRect(0, 0, 256, 160);
    ctx.fillStyle = "rgba(6, 18, 14, 0.92)";
    ctx.strokeStyle = "#39ff9f";
    ctx.lineWidth = 10;
    ctx.fillRect(8, 8, 240, 144);
    ctx.strokeRect(8, 8, 240, 144);
    badgeTex.drawText(
      "×3",
      null,
      108,
      "bold 96px sans-serif",
      "#9dffc9",
      null,
      true,
      true
    );
    badgeMat.diffuseTexture = badgeTex;
    badgeMat.emissiveTexture = badgeTex;
    badgeMat.opacityTexture = badgeTex;
    badgeMat.backFaceCulling = false;
    badgeMat.disableLighting = true;
    badge.material = badgeMat;
    badge.parent = root;

    return root;
  };

  app.createCalibratedTireItemPreview = function createCalibratedTireItemPreview(scene, id) {
    const root = new BABYLON.TransformNode("shopItem_" + id, scene);

    const rubberMat = new BABYLON.StandardMaterial("tireRub_" + id, scene);
    rubberMat.diffuseColor = new BABYLON.Color3(0.16, 0.18, 0.22);
    rubberMat.emissiveColor = new BABYLON.Color3(0.05, 0.07, 0.1);
    rubberMat.specularColor = new BABYLON.Color3(0.25, 0.25, 0.3);

    const rimMat = new BABYLON.StandardMaterial("tireRim_" + id, scene);
    rimMat.diffuseColor = new BABYLON.Color3(0.7, 0.75, 0.85);
    rimMat.emissiveColor = new BABYLON.Color3(0.18, 0.22, 0.3);
    rimMat.specularColor = new BABYLON.Color3(0.85, 0.9, 1);

    const neonMat = app.makeNeonMaterial(
      "tireNeon_" + id,
      scene,
      new BABYLON.Color3(0.45, 0.82, 1),
      1
    );
    const darkMat = new BABYLON.StandardMaterial("tireDark_" + id, scene);
    darkMat.diffuseColor = new BABYLON.Color3(0.07, 0.09, 0.12);
    darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.05);

    const pedestal = BABYLON.MeshBuilder.CreateCylinder(
      "tirePed_" + id,
      { diameter: 2.0, height: 0.16, tessellation: 28 },
      scene
    );
    pedestal.position.y = 0.08;
    pedestal.material = darkMat;
    pedestal.parent = root;

    const padRing = BABYLON.MeshBuilder.CreateTorus(
      "tirePadRing_" + id,
      { diameter: 1.9, thickness: 0.09, tessellation: 40 },
      scene
    );
    padRing.position.y = 0.16;
    padRing.material = neonMat;
    padRing.parent = root;

    // Monta no eixo Y (torus padrão do Babylon fica deitado) e
    // depois levanta o conjunto inteiro — assim pneu e aro não dessincronizam
    const wheel = new BABYLON.TransformNode("tireWheel_" + id, scene);
    wheel.position.y = 1.15;
    wheel.rotation.x = Math.PI / 2;
    wheel.parent = root;

    const tire = BABYLON.MeshBuilder.CreateTorus(
      "tireBody_" + id,
      { diameter: 1.55, thickness: 0.48, tessellation: 36 },
      scene
    );
    tire.material = rubberMat;
    tire.parent = wheel;

    const rim = BABYLON.MeshBuilder.CreateCylinder(
      "tireRim_" + id,
      { diameter: 1.05, height: 0.28, tessellation: 28 },
      scene
    );
    rim.position.y = 0.06;
    rim.material = rimMat;
    rim.parent = wheel;

    const hub = BABYLON.MeshBuilder.CreateCylinder(
      "tireHub_" + id,
      { diameter: 0.38, height: 0.34, tessellation: 16 },
      scene
    );
    hub.position.y = 0.1;
    hub.material = neonMat;
    hub.parent = wheel;

    for (let i = 0; i < 6; i++) {
      const spoke = BABYLON.MeshBuilder.CreateBox(
        "tireSpoke_" + id + "_" + i,
        { width: 0.85, height: 0.1, depth: 0.11 },
        scene
      );
      spoke.rotation.y = (i * Math.PI) / 6;
      spoke.position.y = 0.08;
      spoke.material = rimMat;
      spoke.parent = wheel;
    }

    // Placa de bônus relativo à vel. máx.
    const badge = BABYLON.MeshBuilder.CreatePlane(
      "tireBadge_" + id,
      { width: 1.15, height: 0.7 },
      scene
    );
    badge.position.set(0, 2.4, 0);
    badge.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    const badgeMat = new BABYLON.StandardMaterial("tireBadgeMat_" + id, scene);
    const badgeTex = new BABYLON.DynamicTexture(
      "tireBadgeTex_" + id,
      { width: 256, height: 160 },
      scene,
      false
    );
    badgeTex.hasAlpha = true;
    const ctx = badgeTex.getContext();
    ctx.clearRect(0, 0, 256, 160);
    ctx.fillStyle = "rgba(6, 14, 22, 0.92)";
    ctx.strokeStyle = "#74d2ff";
    ctx.lineWidth = 10;
    ctx.fillRect(8, 8, 240, 144);
    ctx.strokeRect(8, 8, 240, 144);
    badgeTex.drawText(
      "+" + app.CALIBRATED_TIRE_BONUS_PCT + "%",
      null,
      108,
      "bold 72px sans-serif",
      "#9fe3ff",
      null,
      true,
      true
    );
    badgeMat.diffuseTexture = badgeTex;
    badgeMat.emissiveTexture = badgeTex;
    badgeMat.opacityTexture = badgeTex;
    badgeMat.backFaceCulling = false;
    badgeMat.disableLighting = true;
    badge.material = badgeMat;
    badge.parent = root;

    return root;
  };

  app.createOvalTicketItemPreview = function createOvalTicketItemPreview(
    scene,
    id
  ) {
    const root = new BABYLON.TransformNode("shopItem_" + id, scene);

    const cardMat = new BABYLON.StandardMaterial("ticketCard_" + id, scene);
    cardMat.diffuseColor = new BABYLON.Color3(0.95, 0.55, 0.15);
    cardMat.emissiveColor = new BABYLON.Color3(0.45, 0.22, 0.05);
    cardMat.specularColor = new BABYLON.Color3(1, 0.8, 0.4);

    const neonMat = app.makeNeonMaterial(
      "ticketNeon_" + id,
      scene,
      new BABYLON.Color3(1, 0.7, 0.25),
      1
    );
    const darkMat = new BABYLON.StandardMaterial("ticketDark_" + id, scene);
    darkMat.diffuseColor = new BABYLON.Color3(0.08, 0.05, 0.02);
    darkMat.emissiveColor = new BABYLON.Color3(0.03, 0.02, 0.01);

    const pedestal = BABYLON.MeshBuilder.CreateCylinder(
      "ticketPed_" + id,
      { diameter: 2.1, height: 0.16, tessellation: 28 },
      scene
    );
    pedestal.position.y = 0.08;
    pedestal.material = darkMat;
    pedestal.parent = root;

    const ring = BABYLON.MeshBuilder.CreateTorus(
      "ticketRing_" + id,
      { diameter: 2.0, thickness: 0.09, tessellation: 40 },
      scene
    );
    ring.position.y = 0.16;
    ring.material = neonMat;
    ring.parent = root;

    const card = BABYLON.MeshBuilder.CreateBox(
      "ticketCardMesh_" + id,
      { width: 1.7, height: 1.05, depth: 0.08 },
      scene
    );
    card.position.y = 0.85;
    card.rotation.x = -0.15;
    card.material = cardMat;
    card.parent = root;

    const stripe = BABYLON.MeshBuilder.CreateBox(
      "ticketStripe_" + id,
      { width: 0.18, height: 1.05, depth: 0.09 },
      scene
    );
    stripe.position.set(-0.55, 0.85, 0);
    stripe.rotation.x = -0.15;
    stripe.material = neonMat;
    stripe.parent = root;

    const badge = BABYLON.MeshBuilder.CreatePlane(
      "ticketBadge_" + id,
      { width: 1.6, height: 0.7 },
      scene
    );
    badge.position.y = 1.75;
    badge.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    const badgeMat = new BABYLON.StandardMaterial("ticketBadgeMat_" + id, scene);
    const badgeTex = new BABYLON.DynamicTexture(
      "ticketBadgeTex_" + id,
      { width: 256, height: 128 },
      scene,
      false
    );
    badgeTex.hasAlpha = true;
    const ctx = badgeTex.getContext();
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = "rgba(20, 10, 2, 0.92)";
    ctx.strokeStyle = "#ffb347";
    ctx.lineWidth = 8;
    ctx.fillRect(16, 16, 224, 96);
    ctx.strokeRect(16, 16, 224, 96);
    ctx.fillStyle = "#ffb347";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TICKET", 128, 64);
    badgeTex.update();
    badgeMat.diffuseTexture = badgeTex;
    badgeMat.emissiveTexture = badgeTex;
    badgeMat.opacityTexture = badgeTex;
    badgeMat.backFaceCulling = false;
    badgeMat.disableLighting = true;
    badge.material = badgeMat;
    badge.parent = root;

    return root;
  };

  app.createShopItemPreview = function createShopItemPreview(scene, itemId) {
    if (itemId === "calibrated-tire") {
      return app.createCalibratedTireItemPreview(scene, itemId);
    }
    if (itemId === "oval-ticket") {
      return app.createOvalTicketItemPreview(scene, itemId);
    }
    return app.createMultiplierItemPreview(scene, itemId || "multiplier");
  };
}

export function initializeCarFactory(app) {
  app.createCarByModel = window.NeonRushCarModels.createFactory(app.makeNeonMaterial);
}
