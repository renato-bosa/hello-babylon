import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@colyseus/sdk";
import { matchMaker } from "@colyseus/core";
import { startServer } from "../index.js";
import { createSimulation, TRACK_IDS } from "../simulation.js";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Timed out waiting for multiplayer state");
    await delay(20);
  }
}

test("shared simulation: all tracks, independent worlds, movement and server finish", () => {
  for (const id of TRACK_IDS) {
    const { world } = createSimulation(id, [{ id: "one" }, { id: "two" }, { id: "three" }, { id: "four" }]);
    const racer = world.racers[0];
    const start = racer.mesh.position.clone();
    for (let i = 0; i < 60; i++) {
      world.raceTime += 1 / 60;
      world.applyDrive(racer, { up: true }, 1 / 60);
    }
    assert(racer.mesh.position.subtract(start).length() > 5, id);
    assert(Number.isFinite(racer.progress));
    assert(!racer.finished);
  }
  const a = createSimulation("neon-circuit-1", [{ id: "a" }]);
  const b = createSimulation("neon-oval", [{ id: "b" }]);
  assert.notEqual(a.app.getActiveLaneLimit(), b.app.getActiveLaneLimit());
  const racer = a.world.racers[0];
  a.world.placeRacer(racer, a.world.track.finishDist - 0.1, 0);
  racer.speed = 30;
  a.world.raceTime = 50;
  a.world.applyDrive(racer, { up: true }, 1 / 60);
  assert(racer.finished);
  assert.equal(racer.finishTime, 50);
});

test("real Colyseus clients: private lobby, 2–4 players, authority, abandonment and cleanup", { timeout: 25000 }, async () => {
  const server = await startServer(0);
  const address = server.transport.server.address();
  const url = `http://127.0.0.1:${address.port}`;
  const client = new Client(url);
  const options = { protocol: 1, trackId: "neon-circuit-1", name: "Piloto", carId: "starter" };
  const joined = [];
  async function watch(promise) {
    const room = await promise;
    room.reconnection.enabled = false;
    room.onMessage("snapshot", snapshot => { room.latest = snapshot; });
    room.send("sync");
    joined.push(room);
    await until(() => room.latest);
    return room;
  }
  try {
    assert.equal((await (await fetch(url + "/health")).json()).protocol, 1);
    await assert.rejects(client.create("private_race", { ...options, protocol: 999 }));
    await assert.rejects(client.create("private_race", { ...options, trackId: "unknown" }));
    const host = await watch(client.create("private_race", options));
    assert.match(host.roomId, /^[A-F0-9]{10}$/);
    assert.equal((await matchMaker.query({ name: "private_race", private: false })).length, 0);
    host.send("ready", true);
    host.send("start");
    await delay(100);
    assert.equal(host.latest.phase, "lobby", "cannot start alone");
    const guest = await watch(client.joinById(host.roomId, { ...options, name: "<img src=x>" }));
    guest.send("start");
    await delay(100);
    assert.equal(host.latest.phase, "lobby", "guest cannot start");
    const third = await watch(client.joinById(host.roomId, options));
    const fourth = await watch(client.joinById(host.roomId, options));
    await assert.rejects(client.joinById(host.roomId, options));
    host.send("start");
    await delay(100);
    assert.equal(host.latest.phase, "lobby", "must wait until all are ready");
    for (const room of [guest, third, fourth]) room.send("ready", true);
    await until(() => host.latest.players.length === 4 && host.latest.players.every(p => p.ready));
    host.send("start");
    await until(() => host.latest.phase === "countdown");
    await assert.rejects(client.joinById(host.roomId, options));
    await until(() => host.latest.phase === "racing");
    const start = host.latest.players.find(p => p.id === host.sessionId).position;
    const timer = setInterval(() => host.send("input", { up: true, position: [9999, 0, 9999], finished: true }), 40);
    await delay(600);
    clearInterval(timer);
    const moved = host.latest.players.find(p => p.id === host.sessionId);
    assert(moved.position[2] > start[2]);
    assert(moved.position[2] < 100);
    assert.equal(moved.finished, false, "client cannot claim a finish");
    await delay(600);
    const localRoom = matchMaker.getLocalRoomById(host.roomId);
    const speed = localRoom.sim.world.racers[0].speed;
    await delay(200);
    assert(localRoom.sim.world.racers[0].speed < speed, "stale input is released");
    await third.leave();
    await fourth.leave();
    await until(() => host.latest.players.filter(p => p.dnf).length === 2);
    assert.equal(host.latest.phase, "racing");
    // Move only the fixture to its finish approach. The shared physics must
    // detect the crossing; there is no production message for claiming a finish.
    const finish = racer => {
      localRoom.sim.world.placeRacer(racer, localRoom.sim.world.track.finishDist - 0.1, 0);
      racer.speed = 30;
    };
    finish(localRoom.sim.world.racers.find(r => r.id === host.sessionId));
    await until(() => host.latest.players.find(p => p.id === host.sessionId).finished);
    assert.equal(host.latest.phase, "racing", "remaining human must be allowed to finish");
    finish(localRoom.sim.world.racers.find(r => r.id === guest.sessionId));
    await until(() => host.latest.phase === "finished");
    assert.deepEqual(host.latest.order, [host.sessionId, guest.sessionId]);
    await host.leave();
    await guest.leave();
    await until(() => !matchMaker.getLocalRoomById(host.roomId));

    const owner = await watch(client.create("private_race", options));
    const replacement = await watch(client.joinById(owner.roomId, options));
    await owner.leave();
    await until(() => replacement.latest.hostId === replacement.sessionId);
    assert.equal(replacement.latest.players.length, 1);
    await assert.rejects(client.joinById("0000000000", options));
  } finally {
    for (const room of joined) await room.leave();
    await server.gracefullyShutdown(false);
  }
});
