import test from "node:test";
import assert from "node:assert/strict";
import BABYLON from "babylonjs";
import { createSimulation, TRACK_IDS, tracks } from "../simulation.js";
import { LocalPrediction, RemoteMotion, updateNetworkCamera } from "../../game/network-motion.js";
import { capturePhysics, STEP, MAX_PENDING } from "../../game/network-physics.js";
import { RaceRoom } from "../race-room.js";

test("queued input cannot advance server physics faster than elapsed time", () => {
  const sim = createSimulation("neon-circuit-1", [{id:"local"}]);
  const player = {inputAt:Date.now(), credit:0, received:120, ack:0,
    queue:Array.from({length:120}, (_,i) => ({seq:i+1,input:{up:true}}))};
  const room = {phase:"racing", accumulator:0, tick:0, sim,
    players:new Map([["local",player]]), checkFinished(){}};
  for (let i=0;i<4;i++) RaceRoom.prototype.update.call(room,250);
  assert(player.ack <= 60, "flooding the queue cannot create extra steps");
  assert(sim.world.player.speed <= 28.01);
  assert(player.queue.length >= 60);
});

test("prediction responds before an ACK, then replays only pending input on every track", () => {
  for (const id of TRACK_IDS) {
    const sim = createSimulation(id, [{ id: "local" }]);
    const racer = sim.world.player;
    const state = { id: racer.id, ack: 0, physics: capturePhysics(racer) };
    const predictor = new LocalPrediction(tracks[id], state);
    const start = racer.mesh.position.clone();
    for (let i = 0; i < 18; i++) {
      const input = { up: true, left: i > 10 };
      predictor.advance(STEP, input, i * 1000 / 60, true);
      if (i < 6) sim.world.applyDrive(racer, input, STEP);
    }
    assert(predictor.racer.mesh.position.subtract(start).length() > 1, id);
    const before = capturePhysics(predictor.racer);
    predictor.reconcile({ ...state, ack: 6, physics: capturePhysics(racer) }, 300);
    assert.equal(predictor.pending.length, 12);
    assert.deepEqual(capturePhysics(predictor.racer), before, id + " deterministic replay");
    assert(predictor.lastCorrection < 1e-9);
    // A rejected/invalid predicted path must be corrected, never sent as truth.
    predictor.racer.mesh.position.x += 2;
    predictor.reconcile({ ...state, ack: 6, physics: capturePhysics(racer) }, 350);
    assert(Math.abs(predictor.lastCorrection - 2) < 1e-9);
    for (let i = 0; i < 60; i++) predictor.render({position:new BABYLON.Vector3(),rotation:new BABYLON.Vector3()}, STEP);
    assert(predictor.offset.length() < 0.001);
  }
});

test("prediction has bounded history and fixed-step behavior at 30/60/144 FPS", () => {
  const states = [];
  for (const fps of [30, 60, 144]) {
    const sim = createSimulation("neon-circuit-1", [{ id: "local" }]);
    const predictor = new LocalPrediction(tracks["neon-circuit-1"], {id:"local", physics:capturePhysics(sim.world.player)});
    for (let frame = 0; frame < fps; frame++) predictor.advance(1/fps, {up:true,right:true}, frame/fps*1000, true);
    assert.equal(predictor.seq, 60);
    states.push(capturePhysics(predictor.racer));
    for (let frame = 0; frame < 500; frame++) predictor.advance(0.1, {up:true}, 2000+frame*100, true);
    assert.equal(predictor.pending.length, MAX_PENDING);
  }
  assert.deepEqual(states[0], states[1]);
  assert.deepEqual(states[1], states[2]);
});

test("buffered remote movement removes 20 Hz velocity pulses and handles angle wrap", () => {
  const motion = new RemoteMotion();
  const mesh = { position:new BABYLON.Vector3(), rotation:new BABYLON.Vector3() };
  let oldPosition = 0, oldTarget = 0, previousOld = 0, previousNew = 0;
  const oldSpeeds = [], newSpeeds = [];
  for (let frame = 0; frame < 600; frame++) {
    const time = frame / 60;
    if (frame % 3 === 0) {
      oldTarget = time * 30;
      motion.push(time, {position:[0,0,oldTarget],rotation:[0,Math.PI - 0.01,0]});
    }
    oldPosition += (oldTarget-oldPosition)*(1-Math.exp(-STEP*25));
    motion.render(mesh, STEP);
    if (frame > 120) {
      oldSpeeds.push((oldPosition-previousOld)/STEP);
      newSpeeds.push((mesh.position.z-previousNew)/STEP);
    }
    previousNew = mesh.position.z;
    previousOld = oldPosition;
  }
  const spread = values => Math.max(...values)-Math.min(...values);
  assert(spread(newSpeeds) < spread(oldSpeeds)*0.1);
  console.log(`Remote velocity variation: old=${spread(oldSpeeds).toFixed(2)}, buffered=${spread(newSpeeds).toFixed(2)} units/s`);
  motion.push(10, {position:[0,0,300],rotation:[0,-Math.PI+0.01,0]});
  motion.render(mesh, STEP);
  assert(Math.abs(mesh.rotation.y) > 3, "yaw must cross the short arc");
});

test("online camera converges independently of frame rate", () => {
  const target = {position:new BABYLON.Vector3(10,0,20),rotation:new BABYLON.Vector3()};
  const positions = [];
  for (const fps of [30,60,144]) {
    const camera = {position:new BABYLON.Vector3(),setTarget(){},lockedTarget:target};
    for (let i=0;i<fps;i++) updateNetworkCamera(camera,target,1/fps);
    assert.equal(camera.lockedTarget,null);
    positions.push(camera.position);
  }
  assert(BABYLON.Vector3.Distance(positions[0],positions[2])<1e-8);
});

test("finished players can steer while coasting; reconciliation preserves inputs and finish results", () => {
  const sim = createSimulation("neon-circuit-1", [{ id: "local" }]);
  const racer = sim.world.player;
  sim.world.placeRacer(racer, sim.world.track.finishDist + 2, 0);
  racer.finished = true;
  racer.finishTime = 12;
  racer.speed = 20;
  const state = { id: "local", ack: 0, finished: true, physics: capturePhysics(racer) };
  const predictor = new LocalPrediction(tracks["neon-circuit-1"], state);
  const yaw = racer.mesh.rotation.y;
  for (let i = 0; i < 6; i++) predictor.advance(STEP, { up: true, right: true }, i * STEP * 1000, true);
  assert(predictor.racer.mesh.rotation.y > yaw, "steering still responds after finish");
  assert(predictor.racer.speed < 20, "accelerator cannot override coasting");
  const predicted = capturePhysics(predictor.racer);
  predictor.reconcile(state, 100);
  assert.deepEqual(capturePhysics(predictor.racer), predicted, "unacknowledged steering is replayed after finish");
  assert.equal(predictor.racer.finishTime, 12);
  assert.equal(predictor.pending.length, 6);
  for (const command of predictor.pending) sim.world.applyDrive(racer, command, STEP);
  assert.deepEqual(capturePhysics(racer), predicted, "server and client retain identical coasting physics");
  predictor.reconcile({ ...state, ack: 6, physics: capturePhysics(racer) }, 120);
  assert.equal(predictor.pending.length, 0);
  assert.equal(predictor.racer.finishTime, 12);
});
