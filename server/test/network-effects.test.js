import test from "node:test";
import assert from "node:assert/strict";
import { NetworkEffects } from "../../game/network-effects.js";

function fixture(isPlayer = true) {
  const calls = { playWallHit: [], setWallScrape: [], setEngineSpeed: [], playCheckpoint: [] };
  const audio = Object.fromEntries(Object.keys(calls).map(name => [name, (...args) => calls[name].push(args)]));
  const effects = new NetworkEffects(audio, isPlayer ? "player" : "rivalA", isPlayer);
  const options = { dt: 1 / 60, enabled: true, maxSpeed: 60, playerDistance: 10, listenerDistance: 12 };
  const physics = { speed: 30, againstWall: true, wallHitCooldown: 0.28 };
  return { calls, effects, options, physics };
}

test("wall audio plays once per contact, suppresses correction chatter, and allows a later impact", () => {
  const { calls, effects, options, physics } = fixture();
  for (let i = 0; i < 60; i++) effects.update({ ...physics }, options);
  assert.equal(calls.playWallHit.length, 1, "repeated snapshots must not replay impact audio");
  assert.deepEqual(calls.setWallScrape.at(-1), [true, 0.5]);
  effects.update({ ...physics, againstWall: false }, options);
  assert.deepEqual(calls.setWallScrape.at(-1), [false, 0]);
  effects.update(physics, options);
  assert.equal(calls.playWallHit.length, 2);
  effects.update({ ...physics, againstWall: false }, options);
  effects.update(physics, options);
  assert.equal(calls.playWallHit.length, 2, "a correction immediately after impact must stay silent");
});

test("slow contact does not create an impact, and inactive racing silences engines and scrape", () => {
  const { calls, effects, options, physics } = fixture();
  effects.update({ ...physics, speed: 3, wallHitCooldown: 0 }, options);
  assert.equal(calls.playWallHit.length, 0);
  assert.deepEqual(calls.setWallScrape.at(-1), [false, 0]);
  effects.update(physics, { ...options, enabled: false });
  assert.deepEqual(calls.setWallScrape.at(-1), [false, 0]);
  assert.equal(calls.setEngineSpeed.at(-1)[1], 0);
});

test("confirmed impact survives replay without duplicating an already predicted sound", () => {
  const { calls, effects, options, physics } = fixture();
  const before = { laps: 0, physics: { againstWall: false } };
  const after = { laps: 0, physics };
  effects.receive(before, after, 0, 60);
  effects.update(physics, options);
  effects.receive(after, after, 0, 60);
  assert.deepEqual(calls.playWallHit, [[0.5, true]]);
  const predicted = fixture();
  predicted.effects.update(physics, options);
  predicted.effects.receive(before, after, 0, 60);
  assert.equal(predicted.calls.playWallHit.length, 1);
  const remote = fixture(false);
  remote.effects.receive(before, after, 10, 60);
  remote.effects.update(physics, options);
  assert.deepEqual(remote.calls.playWallHit, [[0.5, false]]);
});

test("remote engines use existing voices and distance; remote scrape never controls local scrape", () => {
  const { calls, effects, options, physics } = fixture(false);
  effects.update(physics, { ...options, playerDistance: 100 });
  assert.equal(calls.playWallHit.length, 0);
  assert.equal(calls.setWallScrape.length, 0);
  assert.deepEqual(calls.setEngineSpeed.at(-1), ["rivalA", 30, 60, 12]);
  effects.update({ ...physics, againstWall: false }, options);
  effects.update(physics, options);
  assert.deepEqual(calls.playWallHit, [[0.5, false]]);
});

test("checkpoint sound uses confirmed lap transitions, excluding duplicates, finish, dropout and distant opponents", () => {
  const { calls, effects } = fixture(false);
  effects.receive({ laps: 0 }, { laps: 1 }, 10);
  effects.receive({ laps: 1 }, { laps: 1 }, 10);
  effects.receive({ laps: 1 }, { laps: 2, finished: true }, 10);
  effects.receive({ laps: 1 }, { laps: 2, dnf: true }, 10);
  effects.receive({ laps: 1 }, { laps: 2 }, 100);
  effects.receive(undefined, { laps: 2 }, 10);
  assert.deepEqual(calls.playCheckpoint, [[false]]);
});
