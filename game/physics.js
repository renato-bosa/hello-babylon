// Sistema: physics. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.getRacerMaxSpeed = function getRacerMaxSpeed(racer) {
    return racer.maxSpeed != null ? racer.maxSpeed : app.PHYSICS.maxSpeed;
  };

  app.getActiveLaneLimit = function getActiveLaneLimit() {
    const id = window.NEON_RUSH_ACTIVE_TRACK;
    const data =
      window.NEON_RUSH_TRACKS && id ? window.NEON_RUSH_TRACKS[id] : null;
    const feat = data && data.features;
    if (feat && typeof feat.laneLimit === "number") return feat.laneLimit;
    // Até perto da faixa neon da beira (metade da pista − folga do carro)
    if (feat && typeof feat.roadWidth === "number") {
      return feat.roadWidth * 0.5 - 1;
    }
    return app.PHYSICS.laneLimit;
  };
}

export function installScene(app, world) {
  world.cacheRacerFlashMats = function cacheRacerFlashMats(racer) {
    if (racer.flashMats || !racer.mesh) return;
    const entries = [];
    const meshes = racer.mesh.getChildMeshes
      ? racer.mesh.getChildMeshes(false)
      : [];
    for (let i = 0; i < meshes.length; i++) {
      const mat = meshes[i].material;
      if (!mat) continue;
      const mats = mat.subMaterials || [mat];
      for (let j = 0; j < mats.length; j++) {
        const m = mats[j];
        if (!m || !m.emissiveColor) continue;
        entries.push({
          mat: m,
          emissive: m.emissiveColor.clone(),
          diffuse: m.diffuseColor ? m.diffuseColor.clone() : null,
        });
      }
    }
    racer.flashMats = entries;
  };

  world.setRacerCollisionFlash = function setRacerCollisionFlash(racer, on) {
    if (!!racer.collisionFlashOn === !!on) return;
    world.cacheRacerFlashMats(racer);
    const entries = racer.flashMats || [];
    const flashAmount = 0.25; // 25% branco / 75% cor original
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (on) {
        entry.mat.emissiveColor.set(
          entry.emissive.r + (1 - entry.emissive.r) * flashAmount,
          entry.emissive.g + (1 - entry.emissive.g) * flashAmount,
          entry.emissive.b + (1 - entry.emissive.b) * flashAmount
        );
        if (entry.diffuse && entry.mat.diffuseColor) {
          entry.mat.diffuseColor.set(
            entry.diffuse.r + (1 - entry.diffuse.r) * flashAmount,
            entry.diffuse.g + (1 - entry.diffuse.g) * flashAmount,
            entry.diffuse.b + (1 - entry.diffuse.b) * flashAmount
          );
        }
      } else {
        entry.mat.emissiveColor.copyFrom(entry.emissive);
        if (entry.diffuse && entry.mat.diffuseColor) {
          entry.mat.diffuseColor.copyFrom(entry.diffuse);
        }
      }
    }
    racer.collisionFlashOn = !!on;
  };

  world.applyDrive = function applyDrive(racer, input, dt) {
    if (racer.wallHitCooldown > 0) {
      racer.wallHitCooldown -= dt;
    }
    // Após cruzar a chegada: não acelera mais, só desacelera e pode virar
    const coasting = racer.finished;
    const throttleUp = !coasting && input.up;
    const throttleDown = !coasting && input.down;

    if (throttleUp) {
      racer.speed += app.PHYSICS.accel * dt;
    } else if (throttleDown) {
      racer.speed -= app.PHYSICS.brake * dt;
    } else {
      const friction = coasting
        ? app.PHYSICS.friction * 2.4
        : app.PHYSICS.friction;
      if (racer.speed > 0) racer.speed -= friction * dt;
      else if (racer.speed < 0) racer.speed += friction * dt;
      if (Math.abs(racer.speed) < 0.2) racer.speed = 0;
    }

    const speedCap = app.getRacerMaxSpeed(racer);
    racer.speed = Math.max(-12, Math.min(speedCap, racer.speed));

    // Sem velocidade mínima de steer o carro parado nunca realinha
    const steerPower = Math.max(
      racer.finished ? 0 : 0.4,
      Math.min(1, Math.abs(racer.speed) / 10)
    );
    const turningLeft = !!input.left && !input.right;
    const turningRight = !!input.right && !input.left;
    const isTurning = turningLeft || turningRight;

    if (turningLeft) {
      racer.mesh.rotation.y -= app.PHYSICS.turnRate * steerPower * dt;
    }
    if (turningRight) {
      racer.mesh.rotation.y += app.PHYSICS.turnRate * steerPower * dt;
    }

    // Perda de velocidade na curva: proporcional à intensidade do giro e ao tempo.
    // Vale para todos os carros (jogador e bots usam applyDrive).
    // Forma aditiva: a aceleração não "cancela" a curva por completo.
    if (isTurning && Math.abs(racer.speed) > 0.5) {
      const turnNorm = Math.min(1, Math.max(0, steerPower));
      const lossRate =
        app.PHYSICS.cornerDrag * turnNorm * Math.abs(racer.speed);
      racer.speed -= Math.sign(racer.speed) * lossRate * dt;
      if (Math.abs(racer.speed) < 0.2) racer.speed = 0;
    }

    let targetRoll = 0;
    if (turningLeft) targetRoll = 0.18;
    if (turningRight) targetRoll = -0.18;
    racer.mesh.rotation.z +=
      (targetRoll - racer.mesh.rotation.z) * Math.min(1, 8 * dt);

    const forward = new BABYLON.Vector3(
      Math.sin(racer.mesh.rotation.y),
      0,
      Math.cos(racer.mesh.rotation.y)
    );
    racer.mesh.position.addInPlace(forward.scale(racer.speed * dt));

    let sampleOnPath;
    let movingForwardOnLoop = true;
    let crossedLoopForward = false;
    if (world.track.closedPath3D) {
      const loop = world.track.closedPath3D;
      const loopLength = loop.length();
      const distance = app.distanceAlongPath(loop, racer.mesh.position);
      const previous = racer.closedPathDistance == null ? distance : racer.closedPathDistance;
      let delta = distance - previous;
      racer.lapBacktracks = racer.lapBacktracks || 0;
      if (delta > loopLength / 2) {
        // Cruzou a emenda de trás para a frente do array, na contramão.
        delta -= loopLength;
        racer.lapBacktracks += 1;
        racer.lapArmed = false;
      } else if (delta < -loopLength / 2) {
        delta += loopLength;
        crossedLoopForward = true;
        if (racer.lapBacktracks > 0) racer.lapBacktracks -= 1;
      }
      movingForwardOnLoop = delta > 0;
      racer.closedPathDistance = distance;
      racer.distAlong = world.track.startDist + Math.min(distance, world.track.lapLength);
      racer.pathHint = racer.distAlong;
      sampleOnPath = app.samplePath(loop, distance);
    } else if (world.track.totalLaps > 1) {
      if (racer.pathHint == null) racer.pathHint = world.track.startDist;
      racer.distAlong = app.distanceAlongPathHinted(
        world.path3D,
        racer.mesh.position,
        racer.pathHint,
        35,
        110
      );
      racer.pathHint = racer.distAlong;
    } else {
      racer.distAlong = app.distanceAlongPath(world.path3D, racer.mesh.position);
    }

    sampleOnPath = sampleOnPath || app.samplePath(world.path3D, racer.distAlong);
    const closest = sampleOnPath.position;
    const tan = sampleOnPath.tangent;
    const side = sampleOnPath.binormal;
    const lateral = BABYLON.Vector3.Dot(
      racer.mesh.position.subtract(closest),
      side
    );

    const laneLimit = app.getActiveLaneLimit();
    const hittingWall = Math.abs(lateral) > laneLimit;
    if (hittingWall) {
      const excess = Math.abs(lateral) - laneLimit;
      racer.mesh.position.addInPlace(
        side.scale(-Math.sign(lateral) * excess)
      );
      // Som só na entrada do contato (evita eco enquanto raspa a lateral)
      const hitSpeed = Math.abs(racer.speed);
      if (
        !racer.againstWall &&
        racer.wallHitCooldown <= 0 &&
        hitSpeed > 6 &&
        excess > 0.02
      ) {
        if (racer.bench) racer.bench.wallHits += 1;
        if (!app.botBench.active) {
          const intensity = Math.min(
            1,
            hitSpeed / app.getRacerMaxSpeed(racer)
          );
          let playHit = racer.isPlayer;
          if (!playHit) {
            const distToPlayer = BABYLON.Vector3.Distance(
              world.player.mesh.position,
              racer.mesh.position
            );
            playHit = distToPlayer < 28;
          }
          if (playHit) {
            GameAudio.playWallHit(intensity, racer.isPlayer);
          }
        }
        racer.wallHitCooldown = 0.28;
      }
      if (racer.bench && hitSpeed > 4) {
        racer.bench.scrapeTime += dt;
      }
      racer.againstWall = true;
      // Mantém a perda original de 3% a cada 1/60s, independente do FPS.
      racer.speed *= Math.pow(0.97, dt * 60);
      racer.collisionBlinkT += dt;
      // Pisca branco ~8×/s enquanto colide
      const blinkOn =
        Math.sin(racer.collisionBlinkT * Math.PI * 16) > 0;
      world.setRacerCollisionFlash(racer, blinkOn);
    } else {
      world.setRacerCollisionFlash(racer, false);
      racer.againstWall = false;
      racer.collisionBlinkT = 0;
    }

    // Arraste: contínuo enquanto raspa a lateral (só jogador)
    if (racer.isPlayer && !app.botBench.active) {
      const scrapeSpeed = Math.abs(racer.speed);
      const scraping = hittingWall && scrapeSpeed > 4;
      GameAudio.setWallScrape(
        scraping,
        scraping
          ? Math.min(1, scrapeSpeed / app.getRacerMaxSpeed(racer))
          : 0
      );
    }

    if (racer.bench && !racer.finished) {
      const absSpeed = Math.abs(racer.speed);
      racer.bench.distTraveled += absSpeed * dt;
      if (absSpeed < 4) racer.bench.stuckTime += dt;
    }

    // Segue o relevo da pista (morro suave) sem física extra
    racer.mesh.position.y = closest.y;
    racer.mesh.rotation.x = app.pitchFromTangent(tan);

    // Chegada / voltas
    const toFinish = racer.mesh.position.subtract(world.finishSample.position);
    const finishSide = BABYLON.Vector3.Dot(toFinish, world.finishSample.tangent);
    const nearFinish = racer.distAlong > world.track.finishDist - 40;
    const crossedPlane =
      nearFinish && racer.prevFinishSide < 0 && finishSide >= 0;
    const pastFinishDist = racer.distAlong >= world.track.finishDist;

    if (world.track.totalLaps > 1) {
      if (
        !racer.lapArmed &&
        !racer.lapBacktracks &&
        movingForwardOnLoop &&
        racer.distAlong > world.track.startDist + world.track.lapLength * 0.4
      ) {
        racer.lapArmed = true;
      }
      if (
        !racer.finished &&
        racer.lapArmed &&
        !racer.lapBacktracks &&
        movingForwardOnLoop &&
        (crossedPlane || pastFinishDist || crossedLoopForward)
      ) {
        racer.lapsCompleted += 1;
        racer.lapArmed = false;
        if (racer.lapsCompleted >= world.track.totalLaps) {
          world.markRacerFinished(racer, world.raceTime);
        } else {
          let playCp = racer.isPlayer;
          if (!playCp) {
            playCp =
              BABYLON.Vector3.Distance(
                world.player.mesh.position,
                racer.mesh.position
              ) < 35;
          }
          if (playCp && !app.botBench.active) {
            GameAudio.playCheckpoint(racer.isPlayer);
          }
          world.wrapRacerToLapStart(racer);
        }
      }
    } else if (!racer.finished && (crossedPlane || pastFinishDist)) {
      world.markRacerFinished(racer, world.raceTime);
    }
    racer.prevFinishSide = finishSide;

    if (!racer.finished) {
      racer.progress =
        world.track.totalLaps > 1
          ? app.raceProgressFromLaps(racer, world.track)
          : app.raceProgressFromDistance(racer.distAlong, world.track);
    } else {
      racer.progress = 1;
    }
  };
}

export function initializePhysics(app) {
  app.PHYSICS = {
    maxSpeed: 70,
    accel: 28,
    brake: 40,
    friction: 10,
    turnRate: 1.2,
    // Fração da velocidade perdida por segundo a pleno giro
    cornerDrag: 0.5,
    laneLimit: 5.5,
  };
}
