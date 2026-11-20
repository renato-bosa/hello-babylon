import BABYLON from "babylonjs";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createPhysicsSimulation } from "../game/network-physics.js";

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
  return createPhysicsSimulation(tracks[trackId], players);
}
