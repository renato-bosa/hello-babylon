import { installScene as installPhysics } from "./physics.js";
import { installScene as installInput, initializeMenuInput } from "./input.js";
import { installScene as installDiagnostics, initializePerformanceDiagnostics, initializeBotBenchmark } from "./diagnostics.js";
import { installScene as installWorld, initializeWorld, bindTrackSwitch } from "./world.js";
import { installScene as installRacers, initializeRacers } from "./racers.js";
import { installScene as installGarage, initializeGarage } from "./garage.js";
import { installScene as installShop, initializeShop } from "./shop.js";
import {
  installScene as installMissions,
  initializeMissionsScene,
  bindMissionsControls,
} from "./missions.js";
import { bindAccountControls } from "./profile.js";
import { installScene as installCameras, initializeCameras } from "./cameras.js";
import { installScene as installPostRace, initializeRaceState } from "./post-race.js";
import { installScene as installRace, bindRaceControls } from "./race.js";
import { installScene as installAi } from "./ai.js";
import { installScene as installResults } from "./results.js";
import { startRaceLoop } from "./loop.js";

export function createScene(app) {
  // Estado da cena: pista, pilotos, câmeras e corrida.
  const world = {};
  installPhysics(app, world);
  installInput(app, world);
  installDiagnostics(app, world);
  installWorld(app, world);
  installRacers(app, world);
  installGarage(app, world);
  installShop(app, world);
  installMissions(app, world);
  installCameras(app, world);
  installPostRace(app, world);
  installRace(app, world);
  installAi(app, world);
  installResults(app, world);

  initializeWorld(app, world);
  initializeRacers(app, world);
  initializeGarage(app, world);
  initializeShop(app, world);
  initializeMissionsScene(app, world);
  initializeCameras(app, world);
  initializeRaceState(app, world);
  initializeMenuInput(app, world);
  bindRaceControls(app, world);
  bindAccountControls(app, world);
  bindMissionsControls(app, world);
  initializePerformanceDiagnostics(app, world);
  startRaceLoop(app, world);
  bindTrackSwitch(app, world);
  initializeBotBenchmark(app, world);
  return world.scene;
}
