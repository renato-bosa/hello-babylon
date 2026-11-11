/**
 * Efeitos sonoros do Neon Rush (Web Audio API — sem arquivos externos)
 * - Motor de cada carro (jogador + rivais)
 * - Bips da contagem 3-2-1-VAI!
 * - Som ao cruzar a linha de chegada
 * - Batida / arraste na lateral da pista
 * - Checkpoint de volta
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

  function createScrapeVoice(ctx, master) {
    const dur = 0.35;
    const buffer = ctx.createBuffer(
      1,
      Math.floor(ctx.sampleRate * dur),
      ctx.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 700;
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();

    return { source: source, filter: filter, gain: gain };
  }

  const GameAudio = {
    ctx: null,
    master: null,
    engines: {},
    scrape: null,
    engineReady: false,

    // Mesma família de nota + leve desafinação (não brigam entre si)
    engineProfiles: {
      player: { baseFreq: 34, maxVol: 0.15 },
      rivalA: { baseFreq: 33, maxVol: 0.1 },
      rivalB: { baseFreq: 35, maxVol: 0.1 },
      rivalC: { baseFreq: 32, maxVol: 0.09 },
      rivalD: { baseFreq: 36, maxVol: 0.09 },
      rivalE: { baseFreq: 31, maxVol: 0.085 },
      rivalF: { baseFreq: 37, maxVol: 0.085 },
    },

    unlock: function () {
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
        this._buildEngines();
        this.scrape = createScrapeVoice(this.ctx, this.master);
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
      this.setWallScrape(false, 0);
    },

    /** Arraste contínuo na lateral (volume/timbre seguem a velocidade) */
    setWallScrape: function (active, intensity) {
      if (!this.scrape || !this.ctx) return;
      const t = this.ctx.currentTime;
      const force = Math.max(0, Math.min(1, intensity || 0));
      if (!active || force < 0.05) {
        this.scrape.gain.gain.setTargetAtTime(0, t, 0.08);
        return;
      }
      const vol = 0.015 + force * 0.07;
      const freq = 480 + force * 520;
      this.scrape.filter.frequency.setTargetAtTime(freq, t, 0.06);
      this.scrape.gain.gain.setTargetAtTime(vol, t, 0.06);
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

    /** Impacto curto ao bater na lateral */
    playWallHit: function (intensity, isPlayer) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const force = Math.max(0.15, Math.min(1, intensity || 0.5));
      const vol = (isPlayer ? 0.42 : 0.18) * force;

      // Ruído curto (raspão)
      const noiseDur = 0.12;
      const buffer = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * noiseDur),
        ctx.sampleRate
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 420 + force * 380;
      noiseFilter.Q.value = 0.8;
      const noiseGain = ctx.createGain();
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.master);
      noiseGain.gain.setValueAtTime(0.0001, t0);
      noiseGain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      noise.start(t0);
      noise.stop(t0 + noiseDur);

      // Thump grave
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120 + force * 40, t0);
      osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.1);
      osc.connect(oscGain);
      oscGain.connect(this.master);
      oscGain.gain.setValueAtTime(0.0001, t0);
      oscGain.gain.exponentialRampToValueAtTime(vol * 0.85, t0 + 0.01);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.start(t0);
      osc.stop(t0 + 0.16);
    },

    /** Blip de checkpoint ao completar uma volta (não a chegada final) */
    playCheckpoint: function (isPlayer) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      const vol = isPlayer ? 0.2 : 0.1;
      const notes = isPlayer ? [880, 1174.66] : [740, 988];

      notes.forEach(function (freq, i) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(GameAudio.master);

        const start = t0 + i * 0.07;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(vol, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
        osc.start(start);
        osc.stop(start + 0.18);
      });
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
