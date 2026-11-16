/**
 * Modelos 3D dos carros do Neon Rush.
 * Requer Babylon.js. A fábrica recebe o criador de materiais neon compartilhado
 * com o cenário e devolve createCarByModel(scene, modelId, instanceId, bodyColor, accentColor).
 * Os construtores e suas animações ficam privados neste módulo.
 */
(function (global) {
  global.NeonRushCarModels = {
    createFactory: function (makeNeonMaterial) {
      function createStarterCar(scene, id, bodyColor, accentColor) {
        // Carro base mais “real”: carroceria, vidros, portas e rodas
        const car = new BABYLON.TransformNode("car_" + id, scene);

        const bodyMat = new BABYLON.StandardMaterial("bodyMat_" + id, scene);
        bodyMat.diffuseColor = bodyColor.scale(0.55);
        bodyMat.emissiveColor = bodyColor.scale(0.22);
        bodyMat.specularColor = new BABYLON.Color3(0.35, 0.35, 0.4);

        const accentMat = makeNeonMaterial(
          "accentMat_" + id,
          scene,
          accentColor,
          0.75
        );

        const glassMat = new BABYLON.StandardMaterial("glassMat_" + id, scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.15, 0.25, 0.35);
        glassMat.emissiveColor = new BABYLON.Color3(0.12, 0.28, 0.4);
        glassMat.alpha = 0.55;
        glassMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        glassMat.backFaceCulling = false;

        const darkMat = new BABYLON.StandardMaterial("darkMat_" + id, scene);
        darkMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.1);
        darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.03);

        const doorMat = new BABYLON.StandardMaterial("doorMat_" + id, scene);
        doorMat.diffuseColor = bodyColor.scale(0.4);
        doorMat.emissiveColor = bodyColor.scale(0.12);

        // Chassis / carroceria
        const body = BABYLON.MeshBuilder.CreateBox(
          "body_" + id,
          { width: 1.75, height: 0.42, depth: 3.5 },
          scene
        );
        body.position.y = 0.52;
        body.material = bodyMat;
        body.parent = car;

        // Capô um pouco mais baixo na frente
        const hood = BABYLON.MeshBuilder.CreateBox(
          "hood_" + id,
          { width: 1.55, height: 0.16, depth: 0.95 },
          scene
        );
        hood.position.set(0, 0.68, 1.15);
        hood.material = bodyMat;
        hood.parent = car;

        // Porta-malas
        const trunk = BABYLON.MeshBuilder.CreateBox(
          "trunk_" + id,
          { width: 1.55, height: 0.2, depth: 0.7 },
          scene
        );
        trunk.position.set(0, 0.7, -1.35);
        trunk.material = bodyMat;
        trunk.parent = car;

        // Cabine (estrutura)
        const cabin = BABYLON.MeshBuilder.CreateBox(
          "cabin_" + id,
          { width: 1.55, height: 0.5, depth: 1.55 },
          scene
        );
        cabin.position.set(0, 0.95, -0.15);
        cabin.material = darkMat;
        cabin.parent = car;

        // Vidros (parabrisas / laterais / traseiro)
        const windshield = BABYLON.MeshBuilder.CreateBox(
          "windshield_" + id,
          { width: 1.4, height: 0.38, depth: 0.08 },
          scene
        );
        windshield.position.set(0, 0.98, 0.58);
        windshield.rotation.x = -0.35;
        windshield.material = glassMat;
        windshield.parent = car;

        const rearGlass = BABYLON.MeshBuilder.CreateBox(
          "rearGlass_" + id,
          { width: 1.35, height: 0.34, depth: 0.08 },
          scene
        );
        rearGlass.position.set(0, 0.96, -0.88);
        rearGlass.rotation.x = 0.28;
        rearGlass.material = glassMat;
        rearGlass.parent = car;

        const sideGlassL = BABYLON.MeshBuilder.CreateBox(
          "sideGlassL_" + id,
          { width: 0.06, height: 0.32, depth: 1.2 },
          scene
        );
        sideGlassL.position.set(-0.78, 0.98, -0.1);
        sideGlassL.material = glassMat;
        sideGlassL.parent = car;

        const sideGlassR = sideGlassL.clone("sideGlassR_" + id);
        sideGlassR.position.x = 0.78;
        sideGlassR.parent = car;

        // Portas (painéis laterais)
        const doorL = BABYLON.MeshBuilder.CreateBox(
          "doorL_" + id,
          { width: 0.06, height: 0.36, depth: 1.15 },
          scene
        );
        doorL.position.set(-0.9, 0.55, 0.05);
        doorL.material = doorMat;
        doorL.parent = car;

        const doorR = doorL.clone("doorR_" + id);
        doorR.position.x = 0.9;
        doorR.parent = car;

        // Maçanetas
        const handleL = BABYLON.MeshBuilder.CreateBox(
          "handleL_" + id,
          { width: 0.05, height: 0.05, depth: 0.18 },
          scene
        );
        handleL.position.set(-0.94, 0.58, 0.25);
        handleL.material = accentMat;
        handleL.parent = car;

        const handleR = handleL.clone("handleR_" + id);
        handleR.position.x = 0.94;
        handleR.parent = car;

        // Faróis
        const headL = BABYLON.MeshBuilder.CreateBox(
          "headL_" + id,
          { width: 0.35, height: 0.14, depth: 0.08 },
          scene
        );
        headL.position.set(-0.55, 0.5, 1.76);
        headL.material = accentMat;
        headL.parent = car;

        const headR = headL.clone("headR_" + id);
        headR.position.x = 0.55;
        headR.parent = car;

        // Rodas
        function addWheel(name, x, z) {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.58, height: 0.28, tessellation: 16 },
            scene
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.29, z);
          wheel.material = darkMat;
          wheel.parent = car;

          const hub = BABYLON.MeshBuilder.CreateCylinder(
            name + "_hub",
            { diameter: 0.22, height: 0.3, tessellation: 12 },
            scene
          );
          hub.rotation.z = Math.PI / 2;
          hub.position.set(x, 0.29, z);
          hub.material = accentMat;
          hub.parent = car;
        }

        addWheel("wheelFL_" + id, -0.85, 1.15);
        addWheel("wheelFR_" + id, 0.85, 1.15);
        addWheel("wheelBL_" + id, -0.85, -1.15);
        addWheel("wheelBR_" + id, 0.85, -1.15);

        return car;
      }

      function createTurbochargerCar(scene, id, bodyColor, accentColor) {
        // Épico: mais longo e extravagante
        const car = new BABYLON.TransformNode("car_" + id, scene);

        const bodyMat = new BABYLON.StandardMaterial("bodyMat_" + id, scene);
        bodyMat.diffuseColor = bodyColor.scale(0.5);
        bodyMat.emissiveColor = bodyColor.scale(0.35);
        bodyMat.specularColor = new BABYLON.Color3(0.45, 0.35, 0.2);

        const accentMat = makeNeonMaterial(
          "accentMat_" + id,
          scene,
          accentColor,
          1
        );
        const glassMat = new BABYLON.StandardMaterial("glassMat_" + id, scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.2, 0.1, 0.15);
        glassMat.emissiveColor = new BABYLON.Color3(0.45, 0.12, 0.2);
        glassMat.alpha = 0.5;
        glassMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        glassMat.backFaceCulling = false;

        const darkMat = new BABYLON.StandardMaterial("darkMat_" + id, scene);
        darkMat.diffuseColor = new BABYLON.Color3(0.06, 0.06, 0.08);
        darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.03);

        // Corpo bem alongado
        const body = BABYLON.MeshBuilder.CreateBox(
          "body_" + id,
          { width: 1.85, height: 0.38, depth: 5.1 },
          scene
        );
        body.position.y = 0.5;
        body.material = bodyMat;
        body.parent = car;

        // Capô longo / nariz afilado
        const nose = BABYLON.MeshBuilder.CreateBox(
          "nose_" + id,
          { width: 1.35, height: 0.22, depth: 1.4 },
          scene
        );
        nose.position.set(0, 0.48, 2.55);
        nose.material = bodyMat;
        nose.parent = car;

        const hoodStripe = BABYLON.MeshBuilder.CreateBox(
          "hoodStripe_" + id,
          { width: 0.35, height: 0.06, depth: 2.8 },
          scene
        );
        hoodStripe.position.set(0, 0.72, 1.2);
        hoodStripe.material = accentMat;
        hoodStripe.parent = car;

        // Cabine recuada
        const cabin = BABYLON.MeshBuilder.CreateBox(
          "cabin_" + id,
          { width: 1.6, height: 0.48, depth: 1.5 },
          scene
        );
        cabin.position.set(0, 0.9, -0.35);
        cabin.material = darkMat;
        cabin.parent = car;

        const windshield = BABYLON.MeshBuilder.CreateBox(
          "windshield_" + id,
          { width: 1.45, height: 0.36, depth: 0.08 },
          scene
        );
        windshield.position.set(0, 0.95, 0.4);
        windshield.rotation.x = -0.4;
        windshield.material = glassMat;
        windshield.parent = car;

        const canopy = BABYLON.MeshBuilder.CreateBox(
          "canopy_" + id,
          { width: 1.4, height: 0.08, depth: 1.2 },
          scene
        );
        canopy.position.set(0, 1.16, -0.35);
        canopy.material = glassMat;
        canopy.parent = car;

        // Saia lateral extravagante
        const skirtL = BABYLON.MeshBuilder.CreateBox(
          "skirtL_" + id,
          { width: 0.12, height: 0.18, depth: 4.4 },
          scene
        );
        skirtL.position.set(-0.98, 0.28, 0.1);
        skirtL.material = accentMat;
        skirtL.parent = car;

        const skirtR = skirtL.clone("skirtR_" + id);
        skirtR.position.x = 0.98;
        skirtR.parent = car;

        // Asa traseira grande
        const spoilerPostL = BABYLON.MeshBuilder.CreateBox(
          "spoilerPostL_" + id,
          { width: 0.1, height: 0.55, depth: 0.1 },
          scene
        );
        spoilerPostL.position.set(-0.55, 0.95, -2.2);
        spoilerPostL.material = darkMat;
        spoilerPostL.parent = car;

        const spoilerPostR = spoilerPostL.clone("spoilerPostR_" + id);
        spoilerPostR.position.x = 0.55;
        spoilerPostR.parent = car;

        const spoiler = BABYLON.MeshBuilder.CreateBox(
          "spoiler_" + id,
          { width: 1.95, height: 0.1, depth: 0.55 },
          scene
        );
        spoiler.position.set(0, 1.28, -2.25);
        spoiler.material = accentMat;
        spoiler.parent = car;

        // Escapamentos / turbo traseiro
        const exhaustL = BABYLON.MeshBuilder.CreateCylinder(
          "exhaustL_" + id,
          { diameter: 0.22, height: 0.35, tessellation: 10 },
          scene
        );
        exhaustL.rotation.x = Math.PI / 2;
        exhaustL.position.set(-0.4, 0.35, -2.55);
        exhaustL.material = accentMat;
        exhaustL.parent = car;

        const exhaustR = exhaustL.clone("exhaustR_" + id);
        exhaustR.position.x = 0.4;
        exhaustR.parent = car;

        // Faróis alongados (à frente do nariz para evitar z-fighting com a carroceria)
        const headL = BABYLON.MeshBuilder.CreateBox(
          "headL_" + id,
          { width: 0.42, height: 0.12, depth: 0.14 },
          scene
        );
        headL.position.set(-0.55, 0.48, 3.22);
        headL.material = accentMat;
        headL.parent = car;

        const headR = headL.clone("headR_" + id);
        headR.position.x = 0.55;
        headR.parent = car;

        function addWheel(name, x, z) {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.62, height: 0.3, tessellation: 16 },
            scene
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.31, z);
          wheel.material = darkMat;
          wheel.parent = car;

          const hub = BABYLON.MeshBuilder.CreateCylinder(
            name + "_hub",
            { diameter: 0.24, height: 0.32, tessellation: 12 },
            scene
          );
          hub.rotation.z = Math.PI / 2;
          hub.position.set(x, 0.31, z);
          hub.material = accentMat;
          hub.parent = car;
        }

        addWheel("wheelFL_" + id, -0.9, 1.55);
        addWheel("wheelFR_" + id, 0.9, 1.55);
        addWheel("wheelBL_" + id, -0.9, -1.55);
        addWheel("wheelBR_" + id, 0.9, -1.55);

        return car;
      }

      function createRocketCar(scene, id, bodyColor, accentColor) {
        // Comum: tamanho normal + canos de ferro atrás (só visual)
        const car = createStarterCar(scene, id, bodyColor, accentColor);

        const ironMat = new BABYLON.StandardMaterial("ironMat_" + id, scene);
        ironMat.diffuseColor = new BABYLON.Color3(0.35, 0.36, 0.38);
        ironMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.09);
        ironMat.specularColor = new BABYLON.Color3(0.55, 0.55, 0.6);

        const pipeDark = new BABYLON.StandardMaterial("pipeDark_" + id, scene);
        pipeDark.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.2);
        pipeDark.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.04);
        pipeDark.specularColor = new BABYLON.Color3(0.4, 0.4, 0.45);

        function addPipe(name, x, y, z, length, diameter) {
          const pipe = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: diameter, height: length, tessellation: 10 },
            scene
          );
          pipe.rotation.x = Math.PI / 2;
          pipe.position.set(x, y, z);
          pipe.material = ironMat;
          pipe.parent = car;

          const tip = BABYLON.MeshBuilder.CreateCylinder(
            name + "_tip",
            { diameter: diameter * 1.15, height: 0.12, tessellation: 10 },
            scene
          );
          tip.rotation.x = Math.PI / 2;
          tip.position.set(x, y, z - length / 2 - 0.04);
          tip.material = pipeDark;
          tip.parent = car;
        }

        // Canos de ferro saindo da traseira
        addPipe("pipeL_" + id, -0.38, 0.42, -2.05, 0.85, 0.16);
        addPipe("pipeR_" + id, 0.38, 0.42, -2.05, 0.85, 0.16);
        addPipe("pipeMid_" + id, 0, 0.55, -2.15, 0.7, 0.13);

        // Suporte cruzado (detalhe de ferro)
        const brace = BABYLON.MeshBuilder.CreateBox(
          "pipeBrace_" + id,
          { width: 0.9, height: 0.08, depth: 0.08 },
          scene
        );
        brace.position.set(0, 0.42, -1.75);
        brace.material = ironMat;
        brace.parent = car;

        return car;
      }

      function createEggCar(scene, id, bodyColor, accentColor) {
        // Comum / meme: corpo oval (ovo) com rodas e detalhes bobos
        const car = new BABYLON.TransformNode("car_" + id, scene);

        const bodyMat = new BABYLON.StandardMaterial("bodyMat_" + id, scene);
        bodyMat.diffuseColor = bodyColor.scale(0.65);
        bodyMat.emissiveColor = bodyColor.scale(0.28);
        bodyMat.specularColor = new BABYLON.Color3(0.5, 0.45, 0.3);

        const accentMat = makeNeonMaterial(
          "accentMat_" + id,
          scene,
          accentColor,
          0.85
        );
        const darkMat = new BABYLON.StandardMaterial("darkMat_" + id, scene);
        darkMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.1);
        darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.03);

        const glassMat = new BABYLON.StandardMaterial("glassMat_" + id, scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.2, 0.35, 0.45);
        glassMat.emissiveColor = new BABYLON.Color3(0.15, 0.4, 0.55);
        glassMat.alpha = 0.45;
        glassMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        glassMat.backFaceCulling = false;

        // Casca do ovo (esfera esticada)
        const egg = BABYLON.MeshBuilder.CreateSphere(
          "eggBody_" + id,
          { diameter: 2.2, segments: 20 },
          scene
        );
        egg.scaling.set(1.05, 1.25, 1.55);
        egg.position.y = 1.05;
        egg.material = bodyMat;
        egg.parent = car;

        // Faixa meme no meio
        const belt = BABYLON.MeshBuilder.CreateTorus(
          "eggBelt_" + id,
          { diameter: 2.15, thickness: 0.12, tessellation: 24 },
          scene
        );
        belt.rotation.x = Math.PI / 2;
        belt.position.y = 1.0;
        belt.scaling.set(1.05, 1, 1.55);
        belt.material = accentMat;
        belt.parent = car;

        // Visor / "olhinho" na frente
        const visor = BABYLON.MeshBuilder.CreateSphere(
          "eggVisor_" + id,
          { diameter: 0.7, segments: 12 },
          scene
        );
        visor.scaling.set(1.2, 0.7, 0.35);
        visor.position.set(0, 1.25, 1.35);
        visor.material = glassMat;
        visor.parent = car;

        // Farolzinhos
        const headL = BABYLON.MeshBuilder.CreateSphere(
          "eggHeadL_" + id,
          { diameter: 0.28, segments: 10 },
          scene
        );
        headL.position.set(-0.55, 0.95, 1.45);
        headL.material = accentMat;
        headL.parent = car;

        const headR = headL.clone("eggHeadR_" + id);
        headR.position.x = 0.55;
        headR.parent = car;

        // Rodinhas pequeninas (meme)
        function addWheel(name, x, z) {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.5, height: 0.22, tessellation: 14 },
            scene
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.25, z);
          wheel.material = darkMat;
          wheel.parent = car;

          const hub = BABYLON.MeshBuilder.CreateCylinder(
            name + "_hub",
            { diameter: 0.18, height: 0.24, tessellation: 10 },
            scene
          );
          hub.rotation.z = Math.PI / 2;
          hub.position.set(x, 0.25, z);
          hub.material = accentMat;
          hub.parent = car;
        }

        addWheel("wheelFL_" + id, -0.85, 0.75);
        addWheel("wheelFR_" + id, 0.85, 0.75);
        addWheel("wheelBL_" + id, -0.85, -0.75);
        addWheel("wheelBR_" + id, 0.85, -0.75);

        return car;
      }

      function createRolimaCar(scene, id, bodyColor, accentColor) {
        // Épico / meme: carrinho de rolimã de madeira + piloto F1 no capacete
        const car = new BABYLON.TransformNode("car_" + id, scene);

        const woodMat = new BABYLON.StandardMaterial("woodMat_" + id, scene);
        woodMat.diffuseColor = bodyColor.scale(0.75);
        woodMat.emissiveColor = bodyColor.scale(0.18);
        woodMat.specularColor = new BABYLON.Color3(0.15, 0.12, 0.08);

        const woodDarkMat = new BABYLON.StandardMaterial(
          "woodDarkMat_" + id,
          scene
        );
        woodDarkMat.diffuseColor = bodyColor.scale(0.45);
        woodDarkMat.emissiveColor = bodyColor.scale(0.08);

        const accentMat = makeNeonMaterial(
          "accentMat_" + id,
          scene,
          accentColor,
          0.9
        );
        const metalMat = new BABYLON.StandardMaterial("metalMat_" + id, scene);
        metalMat.diffuseColor = new BABYLON.Color3(0.35, 0.35, 0.38);
        metalMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.1);
        metalMat.specularColor = new BABYLON.Color3(0.7, 0.7, 0.75);

        const suitMat = new BABYLON.StandardMaterial("suitMat_" + id, scene);
        suitMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.1);
        suitMat.emissiveColor = accentColor.scale(0.12);

        const skinMat = new BABYLON.StandardMaterial("skinMat_" + id, scene);
        skinMat.diffuseColor = new BABYLON.Color3(0.78, 0.58, 0.42);
        skinMat.emissiveColor = new BABYLON.Color3(0.08, 0.05, 0.03);

        const helmetMat = new BABYLON.StandardMaterial("helmetMat_" + id, scene);
        helmetMat.diffuseColor = accentColor.scale(0.55);
        helmetMat.emissiveColor = accentColor.scale(0.45);
        helmetMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.85);

        const visorMat = new BABYLON.StandardMaterial("visorMat_" + id, scene);
        visorMat.diffuseColor = new BABYLON.Color3(0.05, 0.08, 0.12);
        visorMat.emissiveColor = new BABYLON.Color3(0.12, 0.35, 0.55);
        visorMat.alpha = 0.75;
        visorMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        visorMat.backFaceCulling = false;

        // Assento / plataforma de madeira
        const deck = BABYLON.MeshBuilder.CreateBox(
          "rolimaDeck_" + id,
          { width: 1.15, height: 0.12, depth: 2.4 },
          scene
        );
        deck.position.y = 0.38;
        deck.material = woodMat;
        deck.parent = car;

        // Laterais tipo caixote
        const sideL = BABYLON.MeshBuilder.CreateBox(
          "rolimaSideL_" + id,
          { width: 0.1, height: 0.35, depth: 2.2 },
          scene
        );
        sideL.position.set(-0.55, 0.55, 0);
        sideL.material = woodDarkMat;
        sideL.parent = car;

        const sideR = sideL.clone("rolimaSideR_" + id);
        sideR.position.x = 0.55;
        sideR.parent = car;

        // Frente / bico
        const nose = BABYLON.MeshBuilder.CreateBox(
          "rolimaNose_" + id,
          { width: 1.0, height: 0.18, depth: 0.45 },
          scene
        );
        nose.position.set(0, 0.48, 1.25);
        nose.material = woodMat;
        nose.parent = car;

        // Traseira
        const rear = BABYLON.MeshBuilder.CreateBox(
          "rolimaRear_" + id,
          { width: 1.05, height: 0.4, depth: 0.12 },
          scene
        );
        rear.position.set(0, 0.58, -1.15);
        rear.material = woodDarkMat;
        rear.parent = car;

        // Faixa neon épica no deck
        const stripe = BABYLON.MeshBuilder.CreateBox(
          "rolimaStripe_" + id,
          { width: 0.22, height: 0.04, depth: 2.1 },
          scene
        );
        stripe.position.set(0, 0.46, 0);
        stripe.material = accentMat;
        stripe.parent = car;

        // Eixos (rolimã de verdade)
        function addAxle(name, z) {
          const axle = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.08, height: 1.45, tessellation: 10 },
            scene
          );
          axle.rotation.z = Math.PI / 2;
          axle.position.set(0, 0.22, z);
          axle.material = metalMat;
          axle.parent = car;
        }
        addAxle("axleF_" + id, 0.9);
        addAxle("axleB_" + id, -0.9);

        // Rodas de rolamento grossas
        function addBearingWheel(name, x, z) {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.55, height: 0.28, tessellation: 16 },
            scene
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.28, z);
          wheel.material = metalMat;
          wheel.parent = car;

          const rim = BABYLON.MeshBuilder.CreateCylinder(
            name + "_rim",
            { diameter: 0.22, height: 0.3, tessellation: 10 },
            scene
          );
          rim.rotation.z = Math.PI / 2;
          rim.position.set(x, 0.28, z);
          rim.material = accentMat;
          rim.parent = car;
        }
        addBearingWheel("wheelFL_" + id, -0.72, 0.9);
        addBearingWheel("wheelFR_" + id, 0.72, 0.9);
        addBearingWheel("wheelBL_" + id, -0.72, -0.9);
        addBearingWheel("wheelBR_" + id, 0.72, -0.9);

        // Volante / barra de direção de rolimã
        const steerBar = BABYLON.MeshBuilder.CreateCylinder(
          "rolimaSteer_" + id,
          { diameter: 0.07, height: 0.95, tessellation: 8 },
          scene
        );
        steerBar.rotation.z = Math.PI / 2;
        steerBar.position.set(0, 0.72, 0.85);
        steerBar.material = woodDarkMat;
        steerBar.parent = car;

        const ropeL = BABYLON.MeshBuilder.CreateCylinder(
          "rolimaRopeL_" + id,
          { diameter: 0.04, height: 0.55, tessellation: 6 },
          scene
        );
        ropeL.position.set(-0.35, 0.55, 1.05);
        ropeL.rotation.x = 0.55;
        ropeL.material = accentMat;
        ropeL.parent = car;

        const ropeR = ropeL.clone("rolimaRopeR_" + id);
        ropeR.position.x = 0.35;
        ropeR.parent = car;

        // —— Piloto F1 ——
        const driver = new BABYLON.TransformNode("driver_" + id, scene);
        driver.parent = car;
        driver.position.set(0, 0.55, -0.15);

        // Macacão
        const torso = BABYLON.MeshBuilder.CreateBox(
          "driverTorso_" + id,
          { width: 0.55, height: 0.55, depth: 0.4 },
          scene
        );
        torso.position.set(0, 0.45, 0);
        torso.material = suitMat;
        torso.parent = driver;

        const suitStripe = BABYLON.MeshBuilder.CreateBox(
          "driverStripe_" + id,
          { width: 0.12, height: 0.5, depth: 0.42 },
          scene
        );
        suitStripe.position.set(0, 0.45, 0);
        suitStripe.material = accentMat;
        suitStripe.parent = driver;

        // Pernas esticadas pra frente (posição típica de rolimã)
        const legL = BABYLON.MeshBuilder.CreateBox(
          "driverLegL_" + id,
          { width: 0.18, height: 0.16, depth: 0.85 },
          scene
        );
        legL.position.set(-0.16, 0.18, 0.55);
        legL.material = suitMat;
        legL.parent = driver;

        const legR = legL.clone("driverLegR_" + id);
        legR.position.x = 0.16;
        legR.parent = driver;

        // Braços no volante
        const armL = BABYLON.MeshBuilder.CreateBox(
          "driverArmL_" + id,
          { width: 0.12, height: 0.12, depth: 0.55 },
          scene
        );
        armL.position.set(-0.32, 0.55, 0.35);
        armL.rotation.x = -0.35;
        armL.material = suitMat;
        armL.parent = driver;

        const armR = armL.clone("driverArmR_" + id);
        armR.position.x = 0.32;
        armR.parent = driver;

        // Luvas
        const gloveL = BABYLON.MeshBuilder.CreateSphere(
          "driverGloveL_" + id,
          { diameter: 0.16, segments: 8 },
          scene
        );
        gloveL.position.set(-0.38, 0.72, 0.78);
        gloveL.material = accentMat;
        gloveL.parent = driver;

        const gloveR = gloveL.clone("driverGloveR_" + id);
        gloveR.position.x = 0.38;
        gloveR.parent = driver;

        // Pescoço
        const neck = BABYLON.MeshBuilder.CreateCylinder(
          "driverNeck_" + id,
          { diameter: 0.14, height: 0.12, tessellation: 8 },
          scene
        );
        neck.position.set(0, 0.78, 0);
        neck.material = skinMat;
        neck.parent = driver;

        // Capacete F1
        const helmet = BABYLON.MeshBuilder.CreateSphere(
          "driverHelmet_" + id,
          { diameter: 0.48, segments: 14 },
          scene
        );
        helmet.scaling.set(1, 1.05, 1.1);
        helmet.position.set(0, 1.02, 0.02);
        helmet.material = helmetMat;
        helmet.parent = driver;

        // Faixa do capacete
        const helmetStripe = BABYLON.MeshBuilder.CreateBox(
          "helmetStripe_" + id,
          { width: 0.1, height: 0.42, depth: 0.5 },
          scene
        );
        helmetStripe.position.set(0, 1.05, 0.02);
        helmetStripe.material = woodMat;
        helmetStripe.parent = driver;

        // Visor
        const visor = BABYLON.MeshBuilder.CreateBox(
          "driverVisor_" + id,
          { width: 0.38, height: 0.16, depth: 0.18 },
          scene
        );
        visor.position.set(0, 0.98, 0.2);
        visor.material = visorMat;
        visor.parent = driver;

        // Queixeira do capacete
        const chin = BABYLON.MeshBuilder.CreateBox(
          "driverChin_" + id,
          { width: 0.28, height: 0.14, depth: 0.22 },
          scene
        );
        chin.position.set(0, 0.86, 0.12);
        chin.material = helmetMat;
        chin.parent = driver;

        return car;
      }

      function createPoliceCar(scene, id, bodyColor, accentColor) {
        // Comum: carro normal com pintura de polícia + sirene vermelha/azul piscando
        const car = createStarterCar(scene, id, bodyColor, accentColor);

        const blackMat = new BABYLON.StandardMaterial("policeBlack_" + id, scene);
        blackMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.07);
        blackMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.03);

        const stripeMat = makeNeonMaterial(
          "policeStripe_" + id,
          scene,
          accentColor,
          0.55
        );

        // Faixa lateral estilo viatura
        const stripeL = BABYLON.MeshBuilder.CreateBox(
          "policeStripeL_" + id,
          { width: 0.05, height: 0.22, depth: 3.2 },
          scene
        );
        stripeL.position.set(-0.9, 0.52, 0);
        stripeL.material = stripeMat;
        stripeL.parent = car;

        const stripeR = stripeL.clone("policeStripeR_" + id);
        stripeR.position.x = 0.9;
        stripeR.parent = car;

        // Capô preto (clássico de polícia)
        const hoodPaint = BABYLON.MeshBuilder.CreateBox(
          "policeHood_" + id,
          { width: 1.5, height: 0.04, depth: 0.9 },
          scene
        );
        hoodPaint.position.set(0, 0.77, 1.15);
        hoodPaint.material = blackMat;
        hoodPaint.parent = car;

        // Porta-malas preto
        const trunkPaint = BABYLON.MeshBuilder.CreateBox(
          "policeTrunk_" + id,
          { width: 1.5, height: 0.04, depth: 0.65 },
          scene
        );
        trunkPaint.position.set(0, 0.81, -1.35);
        trunkPaint.material = blackMat;
        trunkPaint.parent = car;

        // Emblema / bloco "POLICE" no capô (retângulo azul)
        const badge = BABYLON.MeshBuilder.CreateBox(
          "policeBadge_" + id,
          { width: 0.55, height: 0.03, depth: 0.28 },
          scene
        );
        badge.position.set(0, 0.8, 1.15);
        badge.material = stripeMat;
        badge.parent = car;

        // Base da sirene no teto
        const lightBarBase = BABYLON.MeshBuilder.CreateBox(
          "sirenBase_" + id,
          { width: 1.05, height: 0.08, depth: 0.28 },
          scene
        );
        lightBarBase.position.set(0, 1.26, -0.05);
        lightBarBase.material = blackMat;
        lightBarBase.parent = car;

        const redMat = new BABYLON.StandardMaterial("sirenRed_" + id, scene);
        redMat.diffuseColor = new BABYLON.Color3(0.9, 0.05, 0.08);
        redMat.emissiveColor = new BABYLON.Color3(1, 0.05, 0.08);
        redMat.specularColor = new BABYLON.Color3(0.9, 0.3, 0.3);

        const blueMat = new BABYLON.StandardMaterial("sirenBlue_" + id, scene);
        blueMat.diffuseColor = new BABYLON.Color3(0.05, 0.15, 0.95);
        blueMat.emissiveColor = new BABYLON.Color3(0.08, 0.25, 1);
        blueMat.specularColor = new BABYLON.Color3(0.3, 0.4, 0.95);

        // Meia esquerda vermelha / direita azul
        const sirenRed = BABYLON.MeshBuilder.CreateBox(
          "sirenRed_" + id,
          { width: 0.48, height: 0.16, depth: 0.24 },
          scene
        );
        sirenRed.position.set(-0.26, 1.38, -0.05);
        sirenRed.material = redMat;
        sirenRed.parent = car;

        const sirenBlue = BABYLON.MeshBuilder.CreateBox(
          "sirenBlue_" + id,
          { width: 0.48, height: 0.16, depth: 0.24 },
          scene
        );
        sirenBlue.position.set(0.26, 1.38, -0.05);
        sirenBlue.material = blueMat;
        sirenBlue.parent = car;

        // Bolinhas extras na barra (piscam junto)
        const bulbRed = BABYLON.MeshBuilder.CreateSphere(
          "sirenBulbR_" + id,
          { diameter: 0.14, segments: 8 },
          scene
        );
        bulbRed.position.set(-0.42, 1.42, -0.05);
        bulbRed.material = redMat;
        bulbRed.parent = car;

        const bulbBlue = BABYLON.MeshBuilder.CreateSphere(
          "sirenBulbB_" + id,
          { diameter: 0.14, segments: 8 },
          scene
        );
        bulbBlue.position.set(0.42, 1.42, -0.05);
        bulbBlue.material = blueMat;
        bulbBlue.parent = car;

        const redOn = new BABYLON.Color3(1.2, 0.08, 0.1);
        const redOff = new BABYLON.Color3(0.15, 0.02, 0.02);
        const blueOn = new BABYLON.Color3(0.1, 0.3, 1.3);
        const blueOff = new BABYLON.Color3(0.02, 0.04, 0.18);

        const sirenObs = scene.onBeforeRenderObservable.add(() => {
          if (!car || car.isDisposed()) {
            scene.onBeforeRenderObservable.remove(sirenObs);
            return;
          }
          // Alterna vermelho/azul ~4x por segundo
          const phase = Math.floor(performance.now() / 220) % 2 === 0;
          redMat.emissiveColor = phase ? redOn : redOff;
          blueMat.emissiveColor = phase ? blueOff : blueOn;
        });
        car.onDisposeObservable.addOnce(() => {
          scene.onBeforeRenderObservable.remove(sirenObs);
        });

        return car;
      }

      function createFlyghtCar(scene, id, bodyColor, accentColor) {
        // Lendário: planador sem rodas. Root em y=0 (mesma altura dos outros);
        // o vão embaixo + glow vendem o hover sem passar por cima de ninguém.
        const car = new BABYLON.TransformNode("car_" + id, scene);
        const hull = new BABYLON.TransformNode("flyghtHull_" + id, scene);
        hull.parent = car;
        hull.position.y = 0; // igual a um carro com rodas

        const bodyMat = new BABYLON.StandardMaterial("flyghtBody_" + id, scene);
        bodyMat.diffuseColor = bodyColor.scale(0.55);
        bodyMat.emissiveColor = bodyColor.scale(0.35);
        bodyMat.specularColor = new BABYLON.Color3(0.85, 0.85, 0.95);

        const accentMat = makeNeonMaterial(
          "flyghtAccent_" + id,
          scene,
          accentColor,
          1.05
        );

        const darkMat = new BABYLON.StandardMaterial("flyghtDark_" + id, scene);
        darkMat.diffuseColor = new BABYLON.Color3(0.06, 0.07, 0.1);
        darkMat.emissiveColor = new BABYLON.Color3(0.03, 0.04, 0.06);

        const glassMat = new BABYLON.StandardMaterial("flyghtGlass_" + id, scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.25, 0.45, 0.7);
        glassMat.emissiveColor = new BABYLON.Color3(0.2, 0.55, 0.85);
        glassMat.alpha = 0.5;
        glassMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        glassMat.backFaceCulling = false;

        const glowMat = new BABYLON.StandardMaterial("flyghtGlow_" + id, scene);
        glowMat.diffuseColor = accentColor.scale(0.4);
        glowMat.emissiveColor = accentColor.scale(1.1);
        glowMat.alpha = 0.65;
        glowMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        glowMat.backFaceCulling = false;

        // Casco principal (flutua com vão sob o chassi — sem rodas)
        const body = BABYLON.MeshBuilder.CreateBox(
          "flyghtBody_" + id,
          { width: 1.7, height: 0.38, depth: 3.4 },
          scene
        );
        body.position.y = 0.62;
        body.material = bodyMat;
        body.parent = hull;

        // Barriga / casco inferior arredondado visual
        const belly = BABYLON.MeshBuilder.CreateBox(
          "flyghtBelly_" + id,
          { width: 1.45, height: 0.16, depth: 2.9 },
          scene
        );
        belly.position.y = 0.4;
        belly.material = darkMat;
        belly.parent = hull;

        // Nariz afiado
        const nose = BABYLON.MeshBuilder.CreateBox(
          "flyghtNose_" + id,
          { width: 1.15, height: 0.22, depth: 0.85 },
          scene
        );
        nose.position.set(0, 0.58, 1.85);
        nose.scaling.set(1, 1, 1);
        nose.material = bodyMat;
        nose.parent = hull;

        const noseTip = BABYLON.MeshBuilder.CreateBox(
          "flyghtNoseTip_" + id,
          { width: 0.55, height: 0.12, depth: 0.45 },
          scene
        );
        noseTip.position.set(0, 0.55, 2.35);
        noseTip.material = accentMat;
        noseTip.parent = hull;

        // Cabine / canopy
        const cabin = BABYLON.MeshBuilder.CreateBox(
          "flyghtCabin_" + id,
          { width: 1.25, height: 0.42, depth: 1.35 },
          scene
        );
        cabin.position.set(0, 0.95, -0.05);
        cabin.material = darkMat;
        cabin.parent = hull;

        const canopy = BABYLON.MeshBuilder.CreateSphere(
          "flyghtCanopy_" + id,
          { diameter: 1.15, segments: 14 },
          scene
        );
        canopy.scaling.set(1.15, 0.55, 1.35);
        canopy.position.set(0, 1.05, 0.05);
        canopy.material = glassMat;
        canopy.parent = hull;

        // Asas laterais curtas (estilo hover)
        const wingL = BABYLON.MeshBuilder.CreateBox(
          "flyghtWingL_" + id,
          { width: 0.55, height: 0.08, depth: 1.6 },
          scene
        );
        wingL.position.set(-1.05, 0.55, -0.2);
        wingL.material = accentMat;
        wingL.parent = hull;

        const wingR = wingL.clone("flyghtWingR_" + id);
        wingR.position.x = 1.05;
        wingR.parent = hull;

        // Estabilizador traseiro
        const fin = BABYLON.MeshBuilder.CreateBox(
          "flyghtFin_" + id,
          { width: 0.08, height: 0.55, depth: 0.55 },
          scene
        );
        fin.position.set(0, 1.05, -1.55);
        fin.material = accentMat;
        fin.parent = hull;

        const rearWing = BABYLON.MeshBuilder.CreateBox(
          "flyghtRearWing_" + id,
          { width: 1.5, height: 0.07, depth: 0.35 },
          scene
        );
        rearWing.position.set(0, 1.28, -1.65);
        rearWing.material = bodyMat;
        rearWing.parent = hull;

        // Faixa lendária no teto
        const stripe = BABYLON.MeshBuilder.CreateBox(
          "flyghtStripe_" + id,
          { width: 0.18, height: 0.05, depth: 2.8 },
          scene
        );
        stripe.position.set(0, 0.82, 0.1);
        stripe.material = accentMat;
        stripe.parent = hull;

        // Faróis
        const headL = BABYLON.MeshBuilder.CreateBox(
          "flyghtHeadL_" + id,
          { width: 0.32, height: 0.1, depth: 0.08 },
          scene
        );
        headL.position.set(-0.45, 0.58, 2.25);
        headL.material = accentMat;
        headL.parent = hull;

        const headR = headL.clone("flyghtHeadR_" + id);
        headR.position.x = 0.45;
        headR.parent = hull;

        // Propulsor traseiro
        const thruster = BABYLON.MeshBuilder.CreateCylinder(
          "flyghtThruster_" + id,
          { diameter: 0.45, height: 0.25, tessellation: 12 },
          scene
        );
        thruster.rotation.x = Math.PI / 2;
        thruster.position.set(0, 0.55, -1.85);
        thruster.material = darkMat;
        thruster.parent = hull;

        const thrusterGlow = BABYLON.MeshBuilder.CreateSphere(
          "flyghtThrustGlow_" + id,
          { diameter: 0.38, segments: 10 },
          scene
        );
        thrusterGlow.position.set(0, 0.55, -2.05);
        thrusterGlow.material = glowMat;
        thrusterGlow.parent = hull;

        // Pads de levitação (onde estariam as rodas) — vão até ~y 0.12
        function addHoverPad(name, x, z) {
          const pad = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.42, height: 0.08, tessellation: 12 },
            scene
          );
          pad.position.set(x, 0.22, z);
          pad.material = darkMat;
          pad.parent = hull;

          const ring = BABYLON.MeshBuilder.CreateTorus(
            name + "_ring",
            { diameter: 0.48, thickness: 0.05, tessellation: 16 },
            scene
          );
          ring.position.set(x, 0.18, z);
          ring.material = accentMat;
          ring.parent = hull;

          const beam = BABYLON.MeshBuilder.CreateCylinder(
            name + "_beam",
            { diameterTop: 0.08, diameterBottom: 0.35, height: 0.2, tessellation: 10 },
            scene
          );
          beam.position.set(x, 0.08, z);
          beam.material = glowMat;
          beam.parent = hull;
        }

        addHoverPad("padFL_" + id, -0.7, 1.05);
        addHoverPad("padFR_" + id, 0.7, 1.05);
        addHoverPad("padBL_" + id, -0.7, -1.05);
        addHoverPad("padBR_" + id, 0.7, -1.05);

        // Sombra de ar / disco sob o casco (reforça o plano sem levantar o root)
        const hoverDisc = BABYLON.MeshBuilder.CreateCylinder(
          "flyghtDisc_" + id,
          { diameter: 1.8, height: 0.02, tessellation: 24 },
          scene
        );
        hoverDisc.position.y = 0.04;
        hoverDisc.material = glowMat;
        hoverDisc.parent = hull;

        // Bob sutil só no hull — root continua em y=0 com os outros
        const hoverObs = scene.onBeforeRenderObservable.add(() => {
          if (!car || car.isDisposed()) {
            scene.onBeforeRenderObservable.remove(hoverObs);
            return;
          }
          const t = performance.now() * 0.003;
          hull.position.y = Math.sin(t) * 0.04;
          const pulse = 0.75 + Math.sin(t * 2.2) * 0.3;
          glowMat.emissiveColor = accentColor.scale(pulse);
          glowMat.alpha = 0.45 + Math.sin(t * 2.2) * 0.2;
        });
        car.onDisposeObservable.addOnce(() => {
          scene.onBeforeRenderObservable.remove(hoverObs);
        });

        return car;
      }

      function createTropicalCar(scene, id, bodyColor, accentColor) {
        // Épico: formato normal, pintura de ondas, conchas no lugar dos faróis
        const car = createStarterCar(scene, id, bodyColor, accentColor);

        // Remove faróis padrão
        car.getChildMeshes(false).forEach(function (mesh) {
          if (
            mesh.name === "headL_" + id ||
            mesh.name === "headR_" + id
          ) {
            mesh.dispose();
          }
        });

        const waveDeep = makeNeonMaterial(
          "waveDeep_" + id,
          scene,
          new BABYLON.Color3(0.05, 0.45, 0.75),
          0.55
        );
        const waveFoam = makeNeonMaterial(
          "waveFoam_" + id,
          scene,
          new BABYLON.Color3(0.75, 0.95, 1),
          0.7
        );
        const sandMat = makeNeonMaterial(
          "sandMat_" + id,
          scene,
          accentColor,
          0.65
        );
        const shellMat = new BABYLON.StandardMaterial("shellMat_" + id, scene);
        shellMat.diffuseColor = new BABYLON.Color3(0.95, 0.82, 0.65);
        shellMat.emissiveColor = accentColor.scale(0.35);
        shellMat.specularColor = new BABYLON.Color3(0.7, 0.6, 0.45);

        const shellPink = new BABYLON.StandardMaterial(
          "shellPink_" + id,
          scene
        );
        shellPink.diffuseColor = new BABYLON.Color3(0.95, 0.55, 0.55);
        shellPink.emissiveColor = new BABYLON.Color3(0.35, 0.12, 0.12);

        // Ondas laterais (faixas onduladas em degraus)
        function addWaveStripe(side, zBase, y, depth, mat) {
          const stripe = BABYLON.MeshBuilder.CreateBox(
            "wave_" + side + "_" + zBase + "_" + id,
            { width: 0.06, height: 0.14, depth: depth },
            scene
          );
          stripe.position.set(side * 0.92, y, zBase);
          stripe.material = mat;
          stripe.parent = car;
        }

        // Lado esquerdo — ondas
        addWaveStripe(-1, 0.85, 0.58, 0.55, waveDeep);
        addWaveStripe(-1, 0.35, 0.64, 0.5, waveFoam);
        addWaveStripe(-1, -0.15, 0.56, 0.55, waveDeep);
        addWaveStripe(-1, -0.65, 0.62, 0.45, waveFoam);
        addWaveStripe(-1, -1.1, 0.55, 0.4, waveDeep);

        // Lado direito — ondas
        addWaveStripe(1, 0.85, 0.58, 0.55, waveDeep);
        addWaveStripe(1, 0.35, 0.64, 0.5, waveFoam);
        addWaveStripe(1, -0.15, 0.56, 0.55, waveDeep);
        addWaveStripe(1, -0.65, 0.62, 0.45, waveFoam);
        addWaveStripe(1, -1.1, 0.55, 0.4, waveDeep);

        // Faixa de areia no capô
        const hoodSand = BABYLON.MeshBuilder.CreateBox(
          "hoodSand_" + id,
          { width: 1.35, height: 0.04, depth: 0.75 },
          scene
        );
        hoodSand.position.set(0, 0.78, 1.15);
        hoodSand.material = sandMat;
        hoodSand.parent = car;

        // Onda no teto / faixa superior
        const roofWave = BABYLON.MeshBuilder.CreateBox(
          "roofWave_" + id,
          { width: 0.35, height: 0.05, depth: 1.3 },
          scene
        );
        roofWave.position.set(0, 1.22, -0.15);
        roofWave.material = waveFoam;
        roofWave.parent = car;

        function addShellHeadlight(name, x) {
          // Concha: esfera achatada + “abertura”
          const shell = BABYLON.MeshBuilder.CreateSphere(
            name,
            { diameter: 0.32, segments: 12 },
            scene
          );
          shell.scaling.set(1.15, 0.75, 0.55);
          shell.position.set(x, 0.5, 1.78);
          shell.material = shellMat;
          shell.parent = car;

          const opening = BABYLON.MeshBuilder.CreateSphere(
            name + "_open",
            { diameter: 0.18, segments: 10 },
            scene
          );
          opening.scaling.set(1.1, 0.7, 0.35);
          opening.position.set(x, 0.5, 1.88);
          opening.material = shellPink;
          opening.parent = car;

          // Ridges da concha
          for (let i = -1; i <= 1; i++) {
            const ridge = BABYLON.MeshBuilder.CreateBox(
              name + "_ridge_" + i,
              { width: 0.03, height: 0.16, depth: 0.2 },
              scene
            );
            ridge.position.set(x + i * 0.07, 0.52, 1.8);
            ridge.rotation.z = i * 0.25;
            ridge.material = sandMat;
            ridge.parent = car;
          }
        }

        addShellHeadlight("shellL_" + id, -0.55);
        addShellHeadlight("shellR_" + id, 0.55);

        return car;
      }

      function createMonocar(scene, id, bodyColor, accentColor) {
        // Comum: carcaça normal + uma única roda grande no centro de baixo
        const car = createStarterCar(scene, id, bodyColor, accentColor);

        car.getChildMeshes(false).forEach(function (mesh) {
          if (
            mesh.name.indexOf("wheel") === 0 ||
            mesh.name.indexOf("_hub") !== -1
          ) {
            mesh.dispose();
          }
        });

        const darkMat = new BABYLON.StandardMaterial("monoDark_" + id, scene);
        darkMat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.1);
        darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.03);

        const accentMat = makeNeonMaterial(
          "monoAccent_" + id,
          scene,
          accentColor,
          0.85
        );

        // Poço / abertura sob a carcaça onde a roda passa
        const wellL = BABYLON.MeshBuilder.CreateBox(
          "monoWellL_" + id,
          { width: 0.08, height: 0.35, depth: 1.1 },
          scene
        );
        wellL.position.set(-0.55, 0.42, 0);
        wellL.material = darkMat;
        wellL.parent = car;

        const wellR = wellL.clone("monoWellR_" + id);
        wellR.position.x = 0.55;
        wellR.parent = car;

        // Roda única gigante no meio
        const wheel = BABYLON.MeshBuilder.CreateCylinder(
          "monoWheel_" + id,
          { diameter: 1.15, height: 0.42, tessellation: 22 },
          scene
        );
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(0, 0.58, 0);
        wheel.material = darkMat;
        wheel.parent = car;

        const hub = BABYLON.MeshBuilder.CreateCylinder(
          "monoHub_" + id,
          { diameter: 0.45, height: 0.46, tessellation: 14 },
          scene
        );
        hub.rotation.z = Math.PI / 2;
        hub.position.set(0, 0.58, 0);
        hub.material = accentMat;
        hub.parent = car;

        // Eixo atravessando a carcaça
        const axle = BABYLON.MeshBuilder.CreateCylinder(
          "monoAxle_" + id,
          { diameter: 0.1, height: 1.2, tessellation: 8 },
          scene
        );
        axle.rotation.z = Math.PI / 2;
        axle.position.set(0, 0.58, 0);
        axle.material = accentMat;
        axle.parent = car;

        // Estabilizadores laterais pequeninos (não tocam o chão — só visual)
        const skateL = BABYLON.MeshBuilder.CreateBox(
          "monoSkateL_" + id,
          { width: 0.18, height: 0.06, depth: 0.55 },
          scene
        );
        skateL.position.set(-0.85, 0.12, 0);
        skateL.material = darkMat;
        skateL.parent = car;

        const skateR = skateL.clone("monoSkateR_" + id);
        skateR.position.x = 0.85;
        skateR.parent = car;

        return car;
      }

      function createTanque(scene, id, bodyColor, accentColor) {
        // Épico: tanque de guerra — camuflagem, esteiras e canhão
        const car = new BABYLON.TransformNode("car_" + id, scene);

        const camoA = new BABYLON.StandardMaterial("camoA_" + id, scene);
        camoA.diffuseColor = bodyColor.scale(0.75);
        camoA.emissiveColor = bodyColor.scale(0.12);
        camoA.specularColor = new BABYLON.Color3(0.12, 0.12, 0.1);

        const camoB = new BABYLON.StandardMaterial("camoB_" + id, scene);
        camoB.diffuseColor = accentColor.scale(0.7);
        camoB.emissiveColor = accentColor.scale(0.1);

        const camoDark = new BABYLON.StandardMaterial("camoDark_" + id, scene);
        camoDark.diffuseColor = new BABYLON.Color3(0.12, 0.14, 0.08);
        camoDark.emissiveColor = new BABYLON.Color3(0.03, 0.03, 0.02);

        const metalMat = new BABYLON.StandardMaterial("tankMetal_" + id, scene);
        metalMat.diffuseColor = new BABYLON.Color3(0.25, 0.26, 0.22);
        metalMat.emissiveColor = new BABYLON.Color3(0.06, 0.06, 0.05);
        metalMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.35);

        // Casco principal
        const hull = BABYLON.MeshBuilder.CreateBox(
          "tankHull_" + id,
          { width: 2.1, height: 0.7, depth: 3.6 },
          scene
        );
        hull.position.y = 0.75;
        hull.material = camoA;
        hull.parent = car;

        // Manchas de camuflagem
        const patch1 = BABYLON.MeshBuilder.CreateBox(
          "camoPatch1_" + id,
          { width: 0.85, height: 0.72, depth: 1.1 },
          scene
        );
        patch1.position.set(-0.55, 0.75, 0.6);
        patch1.material = camoB;
        patch1.parent = car;

        const patch2 = BABYLON.MeshBuilder.CreateBox(
          "camoPatch2_" + id,
          { width: 0.7, height: 0.72, depth: 0.9 },
          scene
        );
        patch2.position.set(0.6, 0.75, -0.8);
        patch2.material = camoDark;
        patch2.parent = car;

        const patch3 = BABYLON.MeshBuilder.CreateBox(
          "camoPatch3_" + id,
          { width: 1.0, height: 0.72, depth: 0.7 },
          scene
        );
        patch3.position.set(0.2, 0.75, 1.2);
        patch3.material = camoDark;
        patch3.parent = car;

        // Frente inclinada
        const nose = BABYLON.MeshBuilder.CreateBox(
          "tankNose_" + id,
          { width: 1.95, height: 0.45, depth: 0.7 },
          scene
        );
        nose.position.set(0, 0.7, 1.95);
        nose.rotation.x = -0.35;
        nose.material = camoA;
        nose.parent = car;

        // Torre
        const turret = BABYLON.MeshBuilder.CreateCylinder(
          "tankTurret_" + id,
          { diameter: 1.45, height: 0.55, tessellation: 14 },
          scene
        );
        turret.position.set(0, 1.35, -0.15);
        turret.material = camoB;
        turret.parent = car;

        const turretTop = BABYLON.MeshBuilder.CreateCylinder(
          "tankTurretTop_" + id,
          { diameter: 0.7, height: 0.28, tessellation: 12 },
          scene
        );
        turretTop.position.set(0.15, 1.7, -0.15);
        turretTop.material = camoDark;
        turretTop.parent = car;

        // Canhão
        const barrel = BABYLON.MeshBuilder.CreateCylinder(
          "tankBarrel_" + id,
          { diameter: 0.22, height: 2.4, tessellation: 10 },
          scene
        );
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 1.4, 1.35);
        barrel.material = metalMat;
        barrel.parent = car;

        const muzzle = BABYLON.MeshBuilder.CreateCylinder(
          "tankMuzzle_" + id,
          { diameter: 0.32, height: 0.28, tessellation: 10 },
          scene
        );
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 1.4, 2.55);
        muzzle.material = camoDark;
        muzzle.parent = car;

        // Escotilha / mira
        const hatch = BABYLON.MeshBuilder.CreateBox(
          "tankHatch_" + id,
          { width: 0.35, height: 0.12, depth: 0.35 },
          scene
        );
        hatch.position.set(-0.25, 1.72, -0.35);
        hatch.material = metalMat;
        hatch.parent = car;

        // Saia lateral / blindagem
        const skirtL = BABYLON.MeshBuilder.CreateBox(
          "tankSkirtL_" + id,
          { width: 0.12, height: 0.45, depth: 3.4 },
          scene
        );
        skirtL.position.set(-1.1, 0.55, 0);
        skirtL.material = camoDark;
        skirtL.parent = car;

        const skirtR = skirtL.clone("tankSkirtR_" + id);
        skirtR.position.x = 1.1;
        skirtR.parent = car;

        // Esteiras (blocos longos) + rodas de apoio
        function addTrack(side) {
          const track = BABYLON.MeshBuilder.CreateBox(
            "track_" + side + "_" + id,
            { width: 0.55, height: 0.35, depth: 3.5 },
            scene
          );
          track.position.set(side * 1.05, 0.28, 0);
          track.material = metalMat;
          track.parent = car;

          for (let i = -1; i <= 1; i++) {
            const roller = BABYLON.MeshBuilder.CreateCylinder(
              "roller_" + side + "_" + i + "_" + id,
              { diameter: 0.48, height: 0.5, tessellation: 12 },
              scene
            );
            roller.rotation.z = Math.PI / 2;
            roller.position.set(side * 1.05, 0.28, i * 1.15);
            roller.material = camoDark;
            roller.parent = car;
          }
        }
        addTrack(-1);
        addTrack(1);

        // Farol de combate
        const lamp = BABYLON.MeshBuilder.CreateSphere(
          "tankLamp_" + id,
          { diameter: 0.22, segments: 8 },
          scene
        );
        lamp.position.set(-0.55, 0.95, 2.15);
        lamp.material = makeNeonMaterial(
          "tankLampMat_" + id,
          scene,
          new BABYLON.Color3(1, 0.85, 0.4),
          0.9
        );
        lamp.parent = car;

        return car;
      }

      function createCrashingCar(scene, id, bodyColor, accentColor) {
        // Lendário: tão comprido quanto o Turbocharger, porém fino e futurista
        const car = new BABYLON.TransformNode("car_" + id, scene);

        const bodyMat = new BABYLON.StandardMaterial("crashBody_" + id, scene);
        bodyMat.diffuseColor = bodyColor.scale(0.45);
        bodyMat.emissiveColor = bodyColor.scale(0.4);
        bodyMat.specularColor = new BABYLON.Color3(0.55, 0.7, 0.95);

        const accentMat = makeNeonMaterial(
          "crashAccent_" + id,
          scene,
          accentColor,
          1.15
        );

        const darkMat = new BABYLON.StandardMaterial("crashDark_" + id, scene);
        darkMat.diffuseColor = new BABYLON.Color3(0.04, 0.06, 0.1);
        darkMat.emissiveColor = new BABYLON.Color3(0.02, 0.04, 0.08);

        const glassMat = new BABYLON.StandardMaterial("crashGlass_" + id, scene);
        glassMat.diffuseColor = new BABYLON.Color3(0.15, 0.45, 0.65);
        glassMat.emissiveColor = new BABYLON.Color3(0.25, 0.75, 0.95);
        glassMat.alpha = 0.48;
        glassMat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        glassMat.backFaceCulling = false;

        const chromeMat = new BABYLON.StandardMaterial("crashChrome_" + id, scene);
        chromeMat.diffuseColor = new BABYLON.Color3(0.35, 0.45, 0.55);
        chromeMat.emissiveColor = new BABYLON.Color3(0.18, 0.28, 0.4);
        chromeMat.specularColor = new BABYLON.Color3(0.9, 0.95, 1);

        // Casco longo e estreito
        const body = BABYLON.MeshBuilder.CreateBox(
          "crashBody_" + id,
          { width: 1.15, height: 0.32, depth: 5.15 },
          scene
        );
        body.position.y = 0.48;
        body.material = bodyMat;
        body.parent = car;

        // Deck superior em degrau (perfil de cunha)
        const deck = BABYLON.MeshBuilder.CreateBox(
          "crashDeck_" + id,
          { width: 0.95, height: 0.14, depth: 3.6 },
          scene
        );
        deck.position.set(0, 0.68, 0.15);
        deck.material = bodyMat;
        deck.parent = car;

        // Nariz afilado em duas etapas
        const nose = BABYLON.MeshBuilder.CreateBox(
          "crashNose_" + id,
          { width: 0.78, height: 0.2, depth: 1.15 },
          scene
        );
        nose.position.set(0, 0.46, 2.7);
        nose.material = bodyMat;
        nose.parent = car;

        const tip = BABYLON.MeshBuilder.CreateBox(
          "crashTip_" + id,
          { width: 0.42, height: 0.12, depth: 0.7 },
          scene
        );
        tip.position.set(0, 0.44, 3.35);
        tip.material = accentMat;
        tip.parent = car;

        // Faixa neon central no capô
        const spine = BABYLON.MeshBuilder.CreateBox(
          "crashSpine_" + id,
          { width: 0.12, height: 0.05, depth: 4.2 },
          scene
        );
        spine.position.set(0, 0.78, 0.35);
        spine.material = accentMat;
        spine.parent = car;

        // Cabine baixa e estreita
        const cabin = BABYLON.MeshBuilder.CreateBox(
          "crashCabin_" + id,
          { width: 0.88, height: 0.38, depth: 1.35 },
          scene
        );
        cabin.position.set(0, 0.88, -0.45);
        cabin.material = darkMat;
        cabin.parent = car;

        const canopy = BABYLON.MeshBuilder.CreateSphere(
          "crashCanopy_" + id,
          { diameter: 0.95, segments: 14 },
          scene
        );
        canopy.scaling.set(0.95, 0.42, 1.45);
        canopy.position.set(0, 0.98, -0.35);
        canopy.material = glassMat;
        canopy.parent = car;

        const windshield = BABYLON.MeshBuilder.CreateBox(
          "crashWind_" + id,
          { width: 0.82, height: 0.28, depth: 0.06 },
          scene
        );
        windshield.position.set(0, 0.92, 0.28);
        windshield.rotation.x = -0.48;
        windshield.material = glassMat;
        windshield.parent = car;

        // Trilhos laterais futuristas
        const railL = BABYLON.MeshBuilder.CreateBox(
          "crashRailL_" + id,
          { width: 0.08, height: 0.1, depth: 4.6 },
          scene
        );
        railL.position.set(-0.62, 0.36, 0.1);
        railL.material = accentMat;
        railL.parent = car;

        const railR = railL.clone("crashRailR_" + id);
        railR.position.x = 0.62;
        railR.parent = car;

        // Aletas traseiras finas
        const finL = BABYLON.MeshBuilder.CreateBox(
          "crashFinL_" + id,
          { width: 0.06, height: 0.42, depth: 0.55 },
          scene
        );
        finL.position.set(-0.38, 0.95, -2.25);
        finL.rotation.z = 0.18;
        finL.material = accentMat;
        finL.parent = car;

        const finR = finL.clone("crashFinR_" + id);
        finR.position.x = 0.38;
        finR.rotation.z = -0.18;
        finR.parent = car;

        const wing = BABYLON.MeshBuilder.CreateBox(
          "crashWing_" + id,
          { width: 1.05, height: 0.06, depth: 0.38 },
          scene
        );
        wing.position.set(0, 1.18, -2.28);
        wing.material = chromeMat;
        wing.parent = car;

        // Propulsão traseira (anéis)
        const thrusterL = BABYLON.MeshBuilder.CreateCylinder(
          "crashThrustL_" + id,
          { diameter: 0.28, height: 0.22, tessellation: 12 },
          scene
        );
        thrusterL.rotation.x = Math.PI / 2;
        thrusterL.position.set(-0.28, 0.4, -2.62);
        thrusterL.material = accentMat;
        thrusterL.parent = car;

        const thrusterR = thrusterL.clone("crashThrustR_" + id);
        thrusterR.position.x = 0.28;
        thrusterR.parent = car;

        const thrustCore = BABYLON.MeshBuilder.CreateCylinder(
          "crashThrustCore_" + id,
          { diameter: 0.18, height: 0.16, tessellation: 10 },
          scene
        );
        thrustCore.rotation.x = Math.PI / 2;
        thrustCore.position.set(0, 0.52, -2.58);
        thrustCore.material = accentMat;
        thrustCore.parent = car;

        // Faróis em barra (estilo HUD)
        const headBar = BABYLON.MeshBuilder.CreateBox(
          "crashHead_" + id,
          { width: 0.72, height: 0.08, depth: 0.1 },
          scene
        );
        headBar.position.set(0, 0.44, 3.62);
        headBar.material = accentMat;
        headBar.parent = car;

        const headL = BABYLON.MeshBuilder.CreateBox(
          "crashHeadL_" + id,
          { width: 0.18, height: 0.1, depth: 0.12 },
          scene
        );
        headL.position.set(-0.38, 0.44, 3.55);
        headL.material = accentMat;
        headL.parent = car;

        const headR = headL.clone("crashHeadR_" + id);
        headR.position.x = 0.38;
        headR.parent = car;

        // Luzes de status no flanco
        for (let i = 0; i < 4; i++) {
          const pip = BABYLON.MeshBuilder.CreateBox(
            "crashPip_" + id + "_" + i,
            { width: 0.08, height: 0.08, depth: 0.08 },
            scene
          );
          pip.position.set(0.58, 0.55, 1.4 - i * 0.55);
          pip.material = accentMat;
          pip.parent = car;
          const pipL = pip.clone("crashPipL_" + id + "_" + i);
          pipL.position.x = -0.58;
          pipL.parent = car;
        }

        function addWheel(name, x, z) {
          const wheel = BABYLON.MeshBuilder.CreateCylinder(
            name,
            { diameter: 0.52, height: 0.2, tessellation: 16 },
            scene
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, 0.26, z);
          wheel.material = darkMat;
          wheel.parent = car;

          const rim = BABYLON.MeshBuilder.CreateCylinder(
            name + "_rim",
            { diameter: 0.28, height: 0.22, tessellation: 12 },
            scene
          );
          rim.rotation.z = Math.PI / 2;
          rim.position.set(x, 0.26, z);
          rim.material = accentMat;
          rim.parent = car;

          const cover = BABYLON.MeshBuilder.CreateBox(
            name + "_cover",
            { width: 0.12, height: 0.34, depth: 0.42 },
            scene
          );
          cover.position.set(x * 0.92, 0.34, z);
          cover.material = chromeMat;
          cover.parent = car;
        }

        // Eixo longo: rodas bem espaçadas no chassi fino
        addWheel("crashFL_" + id, -0.58, 1.65);
        addWheel("crashFR_" + id, 0.58, 1.65);
        addWheel("crashBL_" + id, -0.58, -1.75);
        addWheel("crashBR_" + id, 0.58, -1.75);

        return car;
      }

      function createCarByModel(scene, modelId, instanceId, bodyColor, accentColor) {
        if (modelId === "turbocharger") {
          return createTurbochargerCar(
            scene,
            instanceId,
            bodyColor,
            accentColor
          );
        }
        if (modelId === "rocket-car") {
          return createRocketCar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "egg-car") {
          return createEggCar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "rolima") {
          return createRolimaCar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "policie-car") {
          return createPoliceCar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "flyght") {
          return createFlyghtCar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "tropical") {
          return createTropicalCar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "monocar") {
          return createMonocar(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "tanque") {
          return createTanque(scene, instanceId, bodyColor, accentColor);
        }
        if (modelId === "crashing") {
          return createCrashingCar(scene, instanceId, bodyColor, accentColor);
        }
        return createStarterCar(scene, instanceId, bodyColor, accentColor);
      }

      return function (scene, modelId, instanceId, bodyColor, accentColor) {
        // Cada instância possui seus materiais, inclusive os de peças removidas
        // durante a construção de variantes como Tropical e Monocar.
        const existingMaterials = new Set(scene.materials);
        const car = createCarByModel(
          scene, modelId, instanceId, bodyColor, accentColor
        );
        const materials = scene.materials.filter(function (material) {
          return !existingMaterials.has(material);
        });
        car.onDisposeObservable.addOnce(function () {
          materials.forEach(function (material) {
            material.dispose();
          });
        });
        return car;
      };
    },
  };
})(window);
