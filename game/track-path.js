// Sistema: track-path. Dependências compartilhadas recebidas explicitamente.

export function installApp(app) {
  app.getActiveTrackData = function getActiveTrackData() {
    const id = window.NEON_RUSH_ACTIVE_TRACK;
    const data = window.NEON_RUSH_TRACKS && window.NEON_RUSH_TRACKS[id];
    if (!data) {
      throw new Error("Pista não encontrada: " + id);
    }
    return data;
  };

  app.findDistNearPoint = function findDistNearPoint(path3D, target, minDist) {
    const total = path3D.length();
    const startAt = Math.max(0, Math.min(total - 1, minDist || 0));
    let bestD = startAt;
    let bestScore = Infinity;
    const step = Math.max(1, total / 400);
    for (let d = startAt; d <= total; d += step) {
      const p = path3D.getPointAt(Math.max(0, Math.min(1, d / total)));
      const score = BABYLON.Vector3.DistanceSquared(p, target);
      if (score < bestScore) {
        bestScore = score;
        bestD = d;
      }
    }
    return bestD;
  };

  app.buildTrackFromData = function buildTrackFromData(trackData) {
    const controls = trackData.controlPoints.map(function (p) {
      return new BABYLON.Vector3(p[0], p[1], p[2]);
    });
    const curve = BABYLON.Curve3.CreateCatmullRomSpline(controls, 25, false);
    const path3D = new BABYLON.Path3D(
      curve.getPoints(),
      new BABYLON.Vector3(0, 1, 0)
    );

    const startPos = new BABYLON.Vector3(
      trackData.startPoint[0],
      trackData.startPoint[1],
      trackData.startPoint[2]
    );
    const finishPos = new BABYLON.Vector3(
      trackData.finishPoint[0],
      trackData.finishPoint[1],
      trackData.finishPoint[2]
    );

    const startDist = app.findDistNearPoint(path3D, startPos, 0);
    const finishDist = app.findDistNearPoint(
      path3D,
      finishPos,
      startDist + 80
    );
    const lapLength = Math.max(1, finishDist - startDist);
    const feats = trackData.features || {};
    const totalLaps =
      typeof feats.laps === "number" && feats.laps > 1
        ? Math.floor(feats.laps)
        : 1;

    // O oval usa a mesma volta fechada no cenário e na colisão. Os trechos
    // auxiliares do spline original não são ramais dirigíveis desse circuito.
    let closedPath3D = null;
    if (feats.ovalArena) {
      const loopPoints = path3D.slice(startDist / path3D.length(), finishDist / path3D.length()).getCurve();
      loopPoints.push(loopPoints[0].clone());
      closedPath3D = new BABYLON.Path3D(loopPoints, new BABYLON.Vector3(0, 1, 0));
    }

    return {
      data: trackData,
      path3D: path3D,
      closedPath3D,
      trackLength: path3D.length(),
      startDist: startDist,
      finishDist: finishDist,
      lapLength: lapLength,
      totalLaps: totalLaps,
      raceLength: lapLength * totalLaps,
    };
  };

  app.lateralFromTangent = function lateralFromTangent(tangent) {
    const side = new BABYLON.Vector3(tangent.z, 0, -tangent.x);
    const len = side.length();
    if (len < 1e-5) return new BABYLON.Vector3(1, 0, 0);
    return side.scaleInPlace(1 / len);
  };

  app.samplePath = function samplePath(path3D, distance) {
    const total = path3D.length();
    const t = Math.max(0, Math.min(1, distance / total));
    const tangent = path3D.getTangentAt(t).normalize();
    return {
      total,
      t,
      position: path3D.getPointAt(t),
      tangent: tangent,
      normal: path3D.getNormalAt(t).normalize(),
      binormal: app.lateralFromTangent(tangent),
    };
  };

  app.yawFromTangent = function yawFromTangent(tangent) {
    return Math.atan2(tangent.x, tangent.z);
  };

  app.pitchFromTangent = function pitchFromTangent(tangent) {
    const horiz = Math.sqrt(
      tangent.x * tangent.x + tangent.z * tangent.z
    );
    return -Math.atan2(tangent.y, Math.max(0.0001, horiz));
  };

  app.distanceAlongPath = function distanceAlongPath(path3D, worldPos) {
    return path3D.getDistanceAt(path3D.getClosestPositionTo(worldPos));
  };

  app.distanceAlongPathHinted = function distanceAlongPathHinted(path3D, worldPos, hintDist, back, fwd) {
    const total = path3D.length();
    const hint = Math.max(0, Math.min(total, hintDist || 0));
    const lo = Math.max(0, hint - (back || 30));
    const hi = Math.min(total, hint + (fwd || 100));
    let bestD = hint;
    let best = Infinity;
    const step = 2;
    for (let d = lo; d <= hi; d += step) {
      const p = path3D.getPointAt(Math.max(0, Math.min(1, d / total)));
      const score = BABYLON.Vector3.DistanceSquared(p, worldPos);
      if (score < best) {
        best = score;
        bestD = d;
      }
    }
    return bestD;
  };

  app.raceProgressFromDistance = function raceProgressFromDistance(distAlong, track) {
    return Math.max(
      0,
      Math.min(1, (distAlong - track.startDist) / track.raceLength)
    );
  };

  app.raceProgressFromLaps = function raceProgressFromLaps(racer, track) {
    // Cruzamentos da emenda na contramão precisam ser recuperados antes de
    // avançar o progresso; voltar à chegada não equivale a completar uma volta.
    const local = Math.max(
      0,
      Math.min(
        0.999,
        (racer.distAlong - track.startDist) / track.lapLength
      )
    );
    return Math.max(
      0,
      Math.min(1, (racer.lapsCompleted - (racer.lapBacktracks || 0) + local) / track.totalLaps)
    );
  };

  app.normalizeAngle = function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  };
}

