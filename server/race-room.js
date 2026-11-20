import { Room } from "@colyseus/core";
import { randomBytes } from "node:crypto";
import { cars, tracks, createSimulation } from "./simulation.js";

export const PROTOCOL = 1;
const idleInput = () => ({ up: false, down: false, left: false, right: false });

export class RaceRoom extends Room {
  async onCreate(options = {}) {
    if (options.protocol !== PROTOCOL) throw new Error("Atualize o jogo para entrar.");
    if (!Object.hasOwn(tracks, options.trackId)) throw new Error("Pista inválida.");
    this.roomId = randomBytes(5).toString("hex").toUpperCase();
    this.maxClients = 4;
    this.maxMessagesPerSecond = 90;
    this.visibility = options.visibility === "public" ? "public" : "private";
    await this.setPrivate(this.visibility !== "public");
    await this.setMetadata({ trackId: options.trackId, protocol: PROTOCOL });
    this.trackId = options.trackId;
    this.players = new Map();
    this.phase = "lobby";
    this.hostId = null;
    this.accumulator = 0;
    this.tick = 0;
    this.onMessage("sync", client => client.send("snapshot", this.snapshot()));
    this.onMessage("ready", (client, ready) => {
      if (this.phase !== "lobby" || typeof ready !== "boolean") return;
      this.players.get(client.sessionId).ready = ready;
      this.publish();
    });
    this.onMessage("start", client => {
      if (client.sessionId !== this.hostId || this.phase !== "lobby") return;
      if (this.players.size < 2 || ![...this.players.values()].every(p => p.ready)) return;
      this.phase = "countdown";
      this.lock();
      this.sim = createSimulation(this.trackId, [...this.players.values()]);
      this.startAt = Date.now() + 4000;
      this.publish();
    });
    this.onMessage("input", (client, input) => {
      const player = this.players.get(client.sessionId);
      if (!player || this.phase !== "racing" || !input || typeof input !== "object") return;
      player.input = Object.fromEntries(["up", "down", "left", "right"].map(key => [key, input[key] === true]));
      player.inputAt = Date.now();
    });
    // Clock owns these timers and clears them when the room is disposed.
    this.setSimulationInterval(dt => this.update(dt), 1000 / 60);
    this.clock.setInterval(() => this.publish(), 50);
    // Empty/abandoned lobbies should not occupy a free instance forever.
    this.clock.setTimeout(() => {
      if (this.phase === "lobby") this.disconnect();
    }, 30 * 60 * 1000);
  }

  onAuth(client, options) {
    return options.protocol === PROTOCOL && this.phase === "lobby";
  }

  onJoin(client, options = {}) {
    const name = typeof options.name === "string" ? options.name.trim().slice(0, 20) : "";
    this.players.set(client.sessionId, {
      id: client.sessionId, name: name || "Piloto", ready: false, connected: true,
      carId: Object.hasOwn(cars, options.carId) ? options.carId : "starter",
      input: idleInput(), inputAt: 0,
    });
    this.hostId ||= client.sessionId;
    this.publish();
  }

  onLeave(client) {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    if (this.phase === "lobby") {
      this.players.delete(client.sessionId);
      if (this.hostId === client.sessionId) this.hostId = this.players.keys().next().value || null;
    } else {
      player.connected = false;
      player.input = idleInput();
      const racer = this.sim.world.racers.find(r => r.id === client.sessionId);
      if (!racer.finished) racer.dnf = true;
      this.checkFinished();
    }
    this.publish();
  }

  update(dt) {
    if (this.phase === "countdown") {
      if (Date.now() < this.startAt) return;
      this.phase = "racing";
      this.publish();
    }
    if (this.phase !== "racing") return;
    // Fixed steps preserve the existing physics; never integrate a long stall.
    this.accumulator += Math.min(dt, 250) / 1000;
    while (this.accumulator >= 1 / 60) {
      this.sim.world.raceTime += 1 / 60;
      for (const racer of this.sim.world.racers) {
        if (racer.dnf) continue;
        const player = this.players.get(racer.id);
        const input = Date.now() - player.inputAt < 500 ? player.input : idleInput();
        this.sim.world.applyDrive(racer, input, 1 / 60);
      }
      this.accumulator -= 1 / 60;
      this.tick++;
      this.checkFinished();
      if (this.phase === "finished") break;
    }
  }

  checkFinished() {
    if (!this.sim || this.phase === "finished") return;
    if (this.sim.world.racers.every(r => r.finished || r.dnf)) {
      this.phase = "finished";
      this.publish();
    }
  }

  snapshot() {
    return {
      protocol: PROTOCOL, roomId: this.roomId, trackId: this.trackId, visibility: this.visibility,
      hostId: this.hostId, phase: this.phase, serverTime: Date.now(), startAt: this.startAt || 0,
      raceTime: this.sim?.world.raceTime || 0, tick: this.tick,
      order: this.sim?.world.finishOrder || [],
      players: [...this.players.values()].map(player => {
        const racer = this.sim?.world.racers.find(r => r.id === player.id);
        return {
          id: player.id, name: player.name, carId: player.carId,
          ready: player.ready, connected: player.connected,
          ...(racer ? {
            position: racer.mesh.position.asArray(), rotation: racer.mesh.rotation.asArray(),
            speed: racer.speed, progress: racer.progress, laps: racer.lapsCompleted,
            finished: racer.finished, finishTime: racer.finishTime, dnf: !!racer.dnf,
          } : {}),
        };
      }),
    };
  }

  publish() { this.broadcast("snapshot", this.snapshot()); }
}
