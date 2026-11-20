import { createPhysicsSimulation, restorePhysics, sanitizeInput, STEP, MAX_PENDING } from "./network-physics.js";

const angle = value => Math.atan2(Math.sin(value), Math.cos(value));

export class LocalPrediction {
  constructor(data, state) {
    this.sim = createPhysicsSimulation(data, [{ id: state.id }]);
    this.racer = this.sim.world.player;
    restorePhysics(this.racer, state.physics);
    this.sim.world.finishOrder.length = 0;
    this.pending = [];
    this.seq = state.ack || 0;
    this.accumulator = 0;
    this.offset = new BABYLON.Vector3();
    this.rotationOffset = new BABYLON.Vector3();
    this.lastCorrection = 0;
    this.ackMs = 0;
  }

  reconcile(state, now) {
    const position = this.racer.mesh.position.clone();
    const rotation = this.racer.mesh.rotation.clone();
    const acknowledged = this.pending.find(command => command.seq === state.ack);
    if (acknowledged) this.ackMs = now - acknowledged.sentAt;
    this.pending = this.pending.filter(command => command.seq > state.ack);
    restorePhysics(this.racer, state.physics);
    // Only unacknowledged inputs are replayed. Replay has no sound/UI effects.
    if (!state.finished && !state.dnf) {
      for (const command of this.pending) this.sim.world.applyDrive(this.racer, command, STEP);
    } else this.pending.length = 0;
    const error = position.subtract(this.racer.mesh.position);
    this.lastCorrection = error.length();
    if (error.length() > 8 || state.dnf) {
      this.offset.setAll(0);
      this.rotationOffset.setAll(0);
    } else {
      this.offset.addInPlace(error);
      for (const axis of ["x", "y", "z"]) {
        this.rotationOffset[axis] = angle(this.rotationOffset[axis] + rotation[axis] - this.racer.mesh.rotation[axis]);
      }
    }
  }

  advance(dt, input, now, active) {
    const commands = [];
    if (!active) { this.accumulator = 0; return commands; }
    this.accumulator += Math.min(dt, 0.1);
    while (this.accumulator + 1e-9 >= STEP && commands.length < 6) {
      this.accumulator -= STEP;
      if (this.pending.length >= MAX_PENDING) continue;
      const command = { ...sanitizeInput(input), seq: ++this.seq, sentAt: now };
      this.pending.push(command);
      commands.push(command);
      this.sim.world.applyDrive(this.racer, command, STEP);
    }
    return commands;
  }

  render(mesh, dt) {
    const decay = Math.exp(-Math.min(dt, 0.1) / 0.12);
    this.offset.scaleInPlace(decay);
    this.rotationOffset.scaleInPlace(decay);
    mesh.position.copyFrom(this.racer.mesh.position).addInPlace(this.offset);
    mesh.rotation.copyFrom(this.racer.mesh.rotation).addInPlace(this.rotationOffset);
    // Extrapolate less than one physics step, keeping render cadence independent
    // of the 60 Hz simulation, including 144 Hz screens.
    mesh.position.x += Math.sin(this.racer.mesh.rotation.y) * this.racer.speed * this.accumulator;
    mesh.position.z += Math.cos(this.racer.mesh.rotation.y) * this.racer.speed * this.accumulator;
  }
}

export class RemoteMotion {
  constructor() { this.samples = []; this.time = null; }

  push(time, state) {
    const last = this.samples.at(-1);
    if (last && time <= last.time) return;
    this.samples.push({ time, state });
    if (this.samples.length > 30) this.samples.shift();
    this.time ??= time - 0.1;
  }

  render(mesh, dt) {
    if (!this.samples.length) return;
    const latest = this.samples.at(-1);
    const gap = latest.time - 0.1 - this.time;
    if (Math.abs(gap) > 0.3) this.time = latest.time - 0.1;
    this.time += Math.min(dt, 0.1) * Math.max(0.9, Math.min(1.1, 1 + gap * 2));
    this.time = Math.min(this.time, latest.time);
    while (this.samples.length > 2 && this.samples[1].time <= this.time) this.samples.shift();
    const first = this.samples[0];
    const second = this.samples[1] || first;
    const t = second.time > first.time ? Math.max(0, Math.min(1, (this.time - first.time) / (second.time - first.time))) : 1;
    // A lap wrap/teleport should not draw a car through the scenery.
    const jump = BABYLON.Vector3.Distance(BABYLON.Vector3.FromArray(first.state.position), BABYLON.Vector3.FromArray(second.state.position)) > 15;
    const blend = jump ? (t < 1 ? 0 : 1) : t;
    for (const [i, axis] of ["x", "y", "z"].entries()) {
      mesh.position[axis] = first.state.position[i] + (second.state.position[i] - first.state.position[i]) * blend;
      mesh.rotation[axis] = first.state.rotation[i] + angle(second.state.rotation[i] - first.state.rotation[i]) * blend;
    }
  }
}

// Use one time-based camera update instead of FollowCamera's frame-based spring
// chasing packet-driven targets. The solo FollowCamera is left untouched.
export function updateNetworkCamera(camera, target, dt, snap = false) {
  const yaw = target.rotation.y;
  const desired = target.position.add(new BABYLON.Vector3(-Math.sin(yaw) * 14, 10, -Math.cos(yaw) * 14));
  camera.lockedTarget = null;
  camera.position.copyFrom(BABYLON.Vector3.Lerp(camera.position, desired, snap ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 8)));
  camera.setTarget(target.position.add(new BABYLON.Vector3(0, 1, 0)));
}
