import BABYLON from "babylonjs";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { installApp as installPath } from "../game/track-path.js";
import { installApp as installPhysics, installScene as installDrive, initializePhysics } from "../game/physics.js";
import { installScene as installRace } from "../game/race.js";

// Only vector/path math is used on the server: no engine, canvas or meshes.
globalThis.BABYLON = BABYLON;
const catalog = { window: {} };
vm.createContext(catalog);
export const TRACK_IDS = ["neon-circuit-1", "sunset-rush", "tunnel-rush", "praia-rush", "natal-race", "neon-oval"];
for (const id of TRACK_IDS) {
  vm.runInContext(readFileSync(new URL(`../tracks/${id}.js`, import.meta.url), "utf8"), catalog);
}
vm.runInContext(readFileSync(new URL("../cars/catalog.js", import.meta.url), "utf8"), catalog);
export const cars = catalog.window.NEON_RUSH_CARS;
export const tracks = catalog.window.NEON_RUSH_TRACKS;

export function createSimulation(trackId, players) {
  const app = { botBench: { active: true } };
  installPath(app);
  installPhysics(app);
  initializePhysics(app);
  const track = app.buildTrackFromData(tracks[trackId]);
  const features = track.data.features || {};
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
    // All competitors start abreast at the same distance.
    const lane = (index - (players.length - 1) / 2) * Math.min(2.4, app.getActiveLaneLimit() * 2 / players.length);
    world.placeRacer(racer, track.startDist, lane);
    return racer;
  });
  world.player = world.racers[0];
  return { app, world };
}
