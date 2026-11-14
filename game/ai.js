// Sistema: ai. Dependências compartilhadas recebidas explicitamente.

export function installScene(app, world) {
  world.getAIInput = function getAIInput(racer, dt) {
    let distNow;
    if (world.track.totalLaps > 1) {
      distNow =
        racer.pathHint != null ? racer.pathHint : racer.distAlong;
    } else {
      distNow = world.path3D.getDistanceAt(
        world.path3D.getClosestPositionTo(racer.mesh.position)
      );
    }
    const lookDist = Math.min(
      world.trackLength - 1,
      distNow + racer.lookAhead
    );
    const sampleNow = app.samplePath(world.path3D, distNow);
    const sampleLook = app.samplePath(world.path3D, lookDist);

    const tanNow = sampleNow.tangent;
    const tanAhead = sampleLook.tangent;
    const bend = 1 - BABYLON.Vector3.Dot(tanNow, tanAhead);

    const laneOffset =
      racer.preferredLane +
      Math.sin(world.raceTime * racer.wobbleSpeed + racer.wobblePhase) *
        racer.wobbleAmount;

    const target = sampleLook.position.add(
      sampleLook.binormal.scale(laneOffset)
    );

    const toTarget = target.subtract(racer.mesh.position);
    const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
    let yawError = app.normalizeAngle(desiredYaw - racer.mesh.rotation.y);

    if (!racer.finished) {
      if (racer.mistakeTimer > 0) {
        racer.mistakeTimer -= dt;
        yawError *= -0.35;
      } else if (
        // A chance original é por quadro a 60 FPS; converte para o tempo real.
        Math.random() < 1 - Math.pow(1 - racer.mistakeChance, dt * 60)
      ) {
        racer.mistakeTimer = 0.2 + Math.random() * 0.25;
      }
    }

    const left = yawError < -racer.steerDeadzone;
    const right = yawError > racer.steerDeadzone;

    const sharpCurve = bend > racer.curveCaution;
    const badlyAligned = Math.abs(yawError) > 0.55;
    const almostStopped = Math.abs(racer.speed) < 4;
    // Evita deadlock: parado + desalinhado nunca mais acelerava/virava
    const up =
      !racer.finished &&
      (almostStopped || (!sharpCurve && !badlyAligned));
    const down =
      !racer.finished &&
      !almostStopped &&
      sharpCurve &&
      bend > racer.curveCaution + 0.08;

    return { up, down, left, right };
  };
}

