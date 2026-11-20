// Shared headless physics for the authoritative server and local prediction.
// Neither replay nor prediction may touch the UI, audio or solo economy.
import { installApp as installPath } from "./track-path.js";
import { installApp as installPhysics, installScene as installDrive, initializePhysics } from "./physics.js";
import { installScene as installRace } from "./race.js";

export const NETWORK_PROTOCOL = 2;
export const STEP = 1 / 60;
export const MAX_PENDING = 120;
const fields = ["speed", "distAlong", "lapsCompleted", "lapBacktracks", "closedPathDistance",
  "lapArmed", "pathHint", "progress", "finished", "finishTime", "prevFinishSide",
  "againstWall", "wallHitCooldown", "collisionBlinkT"];

export function capturePhysics(racer) {
  const state = Object.fromEntries(fields.map(key => [key, racer[key]]));
  state.position = racer.mesh.position.asArray();
  state.rotation = racer.mesh.rotation.asArray();
  return state;
}

export function restorePhysics(racer, state) {
  for (const key of fields) racer[key] = state[key];
  racer.mesh.position.copyFromFloats(...state.position);
  racer.mesh.rotation.copyFromFloats(...state.rotation);
}

export function sanitizeInput(input = {}) {
  return Object.fromEntries(["up", "down", "left", "right"].map(key => [key, input[key] === true]));
}

export function createPhysicsSimulation(data, players) {
  const app = { botBench: { active: true } };
  installPath(app);
  installPhysics(app);
  initializePhysics(app);
  const track = app.buildTrackFromData(data);
  const features = data.features || {};
  app.getActiveLaneLimit = () => features.laneLimit ?? (features.roadWidth ? features.roadWidth / 2 - 1 : app.PHYSICS.laneLimit);
  const world = {
    track, path3D: track.path3D, raceTime: 0,
    finishSample: app.samplePath(track.path3D, track.finishDist),
    finishOrder: [], racers: [],
  };
  installDrive(app, world);
  installRace(app, world);
  world.setRacerCollisionFlash = () => {};
  world.markRacerFinished = (racer, time) => {
    if (racer.finished) return;
    racer.finished = true;
    racer.finishTime = time;
    racer.progress = 1;
    world.finishOrder.push(racer.id);
  };
  world.racers = players.map((player, index) => {
    const racer = {
      id: player.id, isPlayer: false,
      mesh: { position: new BABYLON.Vector3(), rotation: new BABYLON.Vector3(), setEnabled() {} },
    };
    const lane = (index - (players.length - 1) / 2) * Math.min(2.4, app.getActiveLaneLimit() * 2 / players.length);
    world.placeRacer(racer, track.startDist, lane);
    return racer;
  });
  world.player = world.racers[0];
  return { app, world };
}
