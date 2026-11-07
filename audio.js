/**
 * Efeitos sonoros do Neon Rush (Web Audio API — sem arquivos externos)
 * - Motor de cada carro (jogador + rivais)
 * - Bips da contagem 3-2-1-VAI!
 * - Som ao cruzar a linha de chegada
 */
(function (global) {
  const AudioCtx = global.AudioContext || global.webkitAudioContext;

  function createEngineVoice(ctx, master, baseFreq) {
    // Triangle + seno suave (evita a dissonância do sawtooth/square)
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = baseFreq;

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.value = baseFreq * 2;

    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.28; // harmônico bem mais baixo que o tom principal

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    filter.Q.value = 0.7; // Q baixo = som mais "redondo"

    const gain = ctx.createGain();
    gain.gain.value = 0;

    osc.connect(filter);
    osc2.connect(harmGain);
    harmGain.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    osc.start();
    osc2.start();

    return {
      baseFreq: baseFreq,
      osc: osc,
      osc2: osc2,
      filter: filter,
      gain: gain,
    };
  }

  const GameAudio = {
    ctx: null,
    master: null,
    engines: {},
    engineReady: false,

    // Mesma família de nota + leve desafinação (não brigam entre si)
    engineProfiles: {
      player: { baseFreq: 34, maxVol: 0.15 },
      rivalA: { baseFreq: 33, maxVol: 0.1 },
      rivalB: { baseFreq: 35, maxVol: 0.1 },
    },

    unlock: function () {
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        this._buildEngines();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    },

    _buildEngines: function () {
      const self = this;
      Object.keys(this.engineProfiles).forEach(function (id) {
        const profile = self.engineProfiles[id];
        self.engines[id] = createEngineVoice(
          self.ctx,
          self.master,
          profile.baseFreq
        );
      });
      this.engineReady = true;
    },

    /**
     * Atualiza o motor de um carro.
     * distance: distância até o jogador (rivais ficam mais baixos longe)
     */
    setEngineSpeed: function (id, speed, maxSpeed, distance) {
      if (!this.engineReady || !this.ctx) return;
      const voice = this.engines[id];
      const profile = this.engineProfiles[id];
      if (!voice || !profile) return;

      const t = this.ctx.currentTime;
      const abs = Math.abs(speed);
      const ratio = Math.min(1, abs / maxSpeed);
      const base = profile.baseFreq;

      // Harmônico sempre em oitava exata → soa limpo junto
      const freq = base + ratio * 70;
      const freq2 = freq * 2;
      const filterFreq = 180 + ratio * 520;

      let vol = abs < 0.5 ? 0 : 0.04 + ratio * profile.maxVol;

      // Rivais: mais altos perto, mais baixos longe
      if (typeof distance === "number") {
        const near = Math.max(0, 1 - distance / 55);
        vol *= 0.25 + near * 0.75;
      }

      voice.osc.frequency.setTargetAtTime(freq, t, 0.05);
      voice.osc2.frequency.setTargetAtTime(freq2, t, 0.05);
      voice.filter.frequency.setTargetAtTime(filterFreq, t, 0.08);
      voice.gain.gain.setTargetAtTime(vol, t, 0.08);
    },

    stopEngines: function () {
      if (!this.engineReady || !this.ctx) return;
      const t = this.ctx.currentTime;
      const self = this;
      Object.keys(this.engines).forEach(function (id) {
        self.engines[id].gain.gain.setTargetAtTime(0, t, 0.15);
      });
    },

    /** bip da contagem; isGo = som do VAI! */
    playCountdownBeep: function (isGo) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(this.master);

      if (isGo) {
        osc.type = "square";
        osc.frequency.setValueAtTime(440, t0);
        osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.18);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
        osc.start(t0);
        osc.stop(t0 + 0.4);
      } else {
        osc.type = "sine";
        osc.frequency.value = 660;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
        osc.start(t0);
        osc.stop(t0 + 0.25);
      }
    },

    /** Fanfarra curta ao cruzar a chegada */
    playFinish: function (isPlayer) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const notes = isPlayer ? [523.25, 659.25, 783.99, 1046.5] : [392, 494, 587];
      const vol = isPlayer ? 0.16 : 0.1;

      notes.forEach(function (freq, i) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(GameAudio.master);

        const start = t0 + i * 0.09;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    },
  };

  global.GameAudio = GameAudio;
})(window);
