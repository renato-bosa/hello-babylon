// Presentation only: never run audio inside prediction/reconciliation replays.
export class NetworkEffects {
  constructor(audio, engineId, isPlayer) {
    this.audio = audio;
    this.engineId = engineId;
    this.isPlayer = isPlayer;
    this.againstWall = false;
    this.hitCooldown = 0;
    this.contactSoundPlayed = false;
  }

  impact(physics, maxSpeed) {
    if (this.hitCooldown > 0 || this.contactSoundPlayed || !(physics?.wallHitCooldown > 0)) return;
    this.audio.playWallHit(Math.min(1, Math.abs(physics.speed) / maxSpeed), this.isPlayer);
    this.hitCooldown = 0.28;
    this.contactSoundPlayed = true;
  }

  update(physics, { dt, enabled, maxSpeed, playerDistance, listenerDistance }) {
    const speed = enabled ? Math.abs(physics?.speed || 0) : 0;
    const hittingWall = enabled && !!physics?.againstWall;
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);
    if (hittingWall && !this.againstWall && this.hitCooldown === 0 &&
        physics.wallHitCooldown > 0 && (this.isPlayer || playerDistance < 28)) {
      this.impact(physics, maxSpeed);
    }
    // Keep this state outside the physics snapshots, so a replay cannot reset it.
    this.againstWall = hittingWall;
    if (!hittingWall) this.contactSoundPlayed = false;
    if (this.isPlayer) {
      const scraping = hittingWall && speed > 4;
      this.audio.setWallScrape(scraping, scraping ? Math.min(1, speed / maxSpeed) : 0);
    }
    this.audio.setEngineSpeed(this.engineId, speed, maxSpeed,
      this.isPlayer ? undefined : listenerDistance);
  }

  receive(previous, current, playerDistance, maxSpeed) {
    // Reconciliation or a slow frame can skip a short impact before rendering.
    // Use its confirmation as a fallback, sharing the rendered sound's cooldown.
    if (previous && !current.dnf && (this.isPlayer || playerDistance < 28) &&
        current.physics?.againstWall && !previous.physics?.againstWall) {
      this.impact(current.physics, maxSpeed);
    }
    if (previous && !current.dnf && !current.finished && current.laps > previous.laps &&
        (this.isPlayer || playerDistance < 35)) {
      this.audio.playCheckpoint(this.isPlayer);
    }
  }
}
