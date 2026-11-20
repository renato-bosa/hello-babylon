// Private, unranked races. The solo loop and economy never run in this mode.
const PROTOCOL = 1;
let sdkPromise;

function loadSdk() {
  if (window.Colyseus) return Promise.resolve(window.Colyseus);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("../vendor/colyseus.js", import.meta.url).href;
    script.onload = () => resolve(window.Colyseus);
    script.onerror = () => { sdkPromise = null; script.remove(); reject(new Error("Não foi possível carregar o multiplayer.")); };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function initializeMultiplayer(app, world) {
  const el = id => document.getElementById(id);
  const dialog = el("mpDialog");
  const status = el("mpStatus");
  const mp = world.multiplayer = {
    open: false, racing: false, room: null, snapshot: null,
    remotes: new Map(), operation: 0, lastReceive: 0, sendElapsed: 0,
  };
  let savedTrack = null;
  let prepared = false;
  let lastCountdown = "";
  let busy = false;
  const originalMenu = world.showMainMenu;

  function endpoint() {
    const configured = window.NEON_RUSH_MULTIPLAYER_URL;
    if (configured) return configured.replace(/\/$/, "");
    if (["localhost", "127.0.0.1"].includes(location.hostname)) return `http://${location.hostname}:2567`;
    return "";
  }

  function controls() {
    el("mpConnect").hidden = !!mp.room;
    el("mpLobby").hidden = !mp.room;
    el("mpCreate").disabled = el("mpJoin").disabled = busy;
    el("mpName").disabled = el("mpCode").disabled = busy;
    el("mpReady").disabled = !mp.snapshot?.players.some(p => p.id === mp.room?.sessionId);
  }

  function open(message = "") {
    if (!world.inMenu || app.perfTestRunning || app.botBench.active) return;
    world.closeGarage();
    world.closeShop();
    world.closeMissions();
    world.closeAccount();
    mp.open = true;
    status.textContent = message || (endpoint()
      ? "Crie uma sala ou entre com o código de um amigo."
      : "Multiplayer ainda não está disponível neste endereço.");
    el("mpTrack").textContent = "Pista: " + app.getActiveTrackData().name;
    el("mpName").value ||= localStorage.getItem("neonRush.multiplayerName") || "Piloto";
    controls();
    if (!dialog.open) dialog.showModal();
  }

  function closeDialog() {
    mp.open = false;
    dialog.close();
  }

  function cleanup() {
    mp.operation++;
    mp.abort?.abort();
    const room = mp.room;
    mp.room = null;
    room?.leave();
    mp.racing = false;
    document.body.classList.remove("mp-racing", "mp-finished");
    mp.snapshot = null;
    busy = false;
    for (const racer of mp.remotes.values()) racer.mesh.dispose();
    mp.remotes.clear();
    world.player.name = "Você";
    world.player.finished = false;
    world.player.finishTime = null;
    world.player.speed = 0;
    app.keys = { up: false, down: false, left: false, right: false };
    world.raceOver = false;
    world.inMenu = true;
    world.syncActiveRacers();
    if (savedTrack) {
      window.NEON_RUSH_ACTIVE_TRACK = savedTrack;
      app.switchTrackInScene(savedTrack, { force: true });
      app.refreshTrackLabel();
    }
    savedTrack = null;
    prepared = false;
    el("mpLeaveRace").hidden = true;
    closeDialog();
    originalMenu();
  }

  world.showMainMenu = function () {
    if (mp.room || mp.open || mp.racing) cleanup();
    else originalMenu();
  };

  async function wake(url, signal) {
    const deadline = performance.now() + 90000;
    status.textContent = "Conectando ao servidor… A primeira conexão pode levar cerca de um minuto.";
    while (performance.now() < deadline) {
      signal.throwIfAborted();
      try {
        const response = await fetch(url + "/health", {
          cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        });
        if (response.ok) {
          const health = await response.json();
          if (health.protocol !== PROTOCOL) throw new Error("Atualize o jogo para conectar.");
          if (health.ok) return;
        }
      } catch (error) {
        if (error.message === "Atualize o jogo para conectar.") throw error;
        signal.throwIfAborted();
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    throw new Error("O servidor não respondeu. Tente novamente em instantes.");
  }

  async function connect(create) {
    if (busy || mp.room) return;
    const url = endpoint();
    if (!url) { status.textContent = "Multiplayer ainda não está disponível neste endereço."; return; }
    const code = el("mpCode").value.trim().toUpperCase();
    if (!create && !/^[A-F0-9]{10}$/.test(code)) {
      status.textContent = "Informe o código de 10 caracteres da sala.";
      return;
    }
    busy = true;
    controls();
    const operation = ++mp.operation;
    mp.abort = new AbortController();
    try {
      await wake(url, mp.abort.signal);
      const sdk = await loadSdk();
      if (operation !== mp.operation) return;
      const client = new sdk.Client(url);
      const name = el("mpName").value.trim().slice(0, 20) || "Piloto";
      localStorage.setItem("neonRush.multiplayerName", name);
      const options = { protocol: PROTOCOL, name, carId: world.equippedCarId, trackId: window.NEON_RUSH_ACTIVE_TRACK };
      const room = create ? await client.create("private_race", options) : await client.joinById(code, options);
      if (operation !== mp.operation) { room.leave(); return; }
      mp.room = room;
      // A dropped connection is an abandonment in this first version.
      if (room.reconnection) room.reconnection.enabled = false;
      savedTrack = window.NEON_RUSH_ACTIVE_TRACK;
      room.onMessage("snapshot", snapshot => {
        if (mp.room !== room) return;
        try { receive(snapshot); }
        catch (error) {
          console.error("Multiplayer scene:", error);
          cleanup();
          open("Não foi possível preparar a corrida. Volte a entrar na sala.");
        }
      });
      room.onError(() => { status.textContent = "Falha na conexão com a sala."; });
      room.onLeave(() => {
        if (mp.room !== room) return;
        mp.room = null;
        cleanup();
        open("Conexão encerrada. Sua participação foi encerrada; crie ou entre em outra sala.");
      });
      room.send("sync");
    } catch (error) {
      if (operation === mp.operation) status.textContent = create
        ? error.message || "Não foi possível criar a sala."
        : "Não foi possível entrar: confira o código; a sala pode estar cheia, encerrada ou já em corrida.";
    } finally {
      if (operation === mp.operation) { busy = false; controls(); }
    }
  }

  function prepare(snapshot) {
    if (prepared) return;
    if (!window.NEON_RUSH_TRACKS[snapshot.trackId]) throw new Error("Pista desconhecida.");
    window.NEON_RUSH_ACTIVE_TRACK = snapshot.trackId;
    app.switchTrackInScene(snapshot.trackId, { force: true });
    if (world.player.carModelId !== world.equippedCarId) {
      world.rebuildPlayerCar(world.equippedCarId, { saveEquip: false });
    }
    world.player.maxSpeed = app.PHYSICS.maxSpeed;
    prepared = true;
  }

  function receive(snapshot) {
    mp.lastReceive = performance.now();
    mp.snapshot = snapshot;
    prepare(snapshot);
    if (snapshot.phase === "lobby") {
      el("mpRoomCode").textContent = snapshot.roomId;
      el("mpLobbyTrack").textContent = window.NEON_RUSH_TRACKS[snapshot.trackId].name;
      const list = el("mpPlayers");
      list.replaceChildren();
      for (const player of snapshot.players) {
        const row = document.createElement("li");
        row.textContent = `${player.name}${player.id === snapshot.hostId ? " (anfitrião)" : ""} — ${player.ready ? "Pronto" : "Preparando"}`;
        list.appendChild(row);
      }
      const me = snapshot.players.find(p => p.id === mp.room.sessionId);
      el("mpReady").textContent = me?.ready ? "Cancelar pronto" : "Pronto";
      el("mpStart").hidden = snapshot.hostId !== mp.room.sessionId;
      el("mpStart").disabled = snapshot.players.length < 2 || !snapshot.players.every(p => p.ready);
      status.textContent = "Compartilhe o código. A corrida começa com 2 a 4 jogadores prontos.";
      controls();
      return;
    }
    if (!mp.racing) begin(snapshot);
    for (const state of snapshot.players) {
      const racer = state.id === mp.room.sessionId ? world.player : mp.remotes.get(state.id);
      if (!racer) continue;
      const justFinished = !racer.finished && state.finished;
      Object.assign(racer, {
        speed: state.speed, progress: state.progress, lapsCompleted: state.laps,
        finished: state.finished, finishTime: state.finishTime, dnf: state.dnf,
      });
      racer.netState = state;
      racer.mesh.setEnabled(!state.dnf);
      if (justFinished) GameAudio.playFinish(racer.isPlayer);
    }
    world.raceTime = snapshot.raceTime;
    world.raceOver = snapshot.phase === "finished";
    if (world.player.finished || world.raceOver) drawRanking(snapshot);
    if (world.raceOver) {
      document.body.classList.add("mp-finished");
      app.hud.classList.remove("show");
      window.setMobileControlsVisible?.(false);
      app.rankingPanel.classList.add("centered");
      app.rankingPanel.classList.remove("racing");
      app.rankingHint.textContent = "Corrida amistosa concluída. Saldo e missões preservados.";
      app.rankingHint.classList.add("show");
      el("mpLeaveRace").textContent = "Voltar ao menu";
    }
  }

  function begin(snapshot) {
    mp.racing = true;
    document.body.classList.add("mp-racing");
    mp.sendElapsed = 0;
    lastCountdown = "";
    closeDialog();
    GameAudio.unlock();
    world.resetPostRaceView();
    world.inMenu = false;
    world.raceOver = false;
    world.countdownActive = false;
    world.finishOrder.length = 0;
    app.mainMenu.classList.remove("show");
    app.hud.classList.add("show");
    app.setCanvasInteractive(true);
    world.rivals.forEach(r => r.mesh.setEnabled(false));
    world.racers = snapshot.players.map(state => {
      const own = state.id === mp.room.sessionId;
      const racer = own ? world.player : world.makeRacer(state.id, state.name, state.carId, false, null);
      if (!own) mp.remotes.set(state.id, racer);
      racer.name = own ? "Você" : state.name;
      racer.finished = false;
      racer.netState = state;
      racer.mesh.position.copyFromFloats(...state.position);
      racer.mesh.rotation.copyFromFloats(...state.rotation);
      return racer;
    });
    world.unlockCameraFollow();
    world.scene.activeCamera = world.camera;
    app.rankingPanel.classList.remove("show", "centered", "racing");
    app.rankingHint.classList.remove("show");
    el("mpLeaveRace").hidden = false;
    el("mpLeaveRace").textContent = "Sair da corrida";
    world.syncMobileControlsVisibility();
  }

  function drawRanking(snapshot) {
    app.rankingPanel.classList.add("show", "racing");
    app.rankingList.replaceChildren();
    const ordered = [...snapshot.players].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished) return snapshot.order.indexOf(a.id) - snapshot.order.indexOf(b.id);
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      return b.progress - a.progress;
    });
    ordered.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "ranking-row" + (player.id === mp.room.sessionId ? " you" : "");
      for (const [className, text] of [
        ["pos", player.finished ? `${index + 1}º` : "—"],
        ["", player.id === mp.room.sessionId ? "Você" : player.name],
        ["time", player.dnf ? "Abandonou" : player.finished ? `${player.finishTime.toFixed(1)}s` : "Correndo"],
      ]) {
        const span = document.createElement("span");
        span.className = className;
        span.textContent = text;
        row.appendChild(span);
      }
      app.rankingList.appendChild(row);
    });
  }

  mp.update = function (dt) {
    const snapshot = mp.snapshot;
    if (!snapshot || !mp.room) return;
    const silentFor = performance.now() - mp.lastReceive;
    if (silentFor > 15000) {
      cleanup();
      open("O servidor parou de responder. Volte a entrar em uma sala.");
      return;
    }
    const countdown = snapshot.phase === "countdown"
      ? String(Math.max(1, Math.ceil((snapshot.startAt - snapshot.serverTime - silentFor) / 1000))) : "";
    app.countdownOverlay.classList.toggle("show", !!countdown);
    if (countdown !== lastCountdown) {
      app.countdownNumber.textContent = countdown;
      GameAudio.playCountdownBeep(!countdown);
      lastCountdown = countdown;
    }
    mp.sendElapsed += dt;
    if (mp.sendElapsed >= 1 / 30 && snapshot.phase === "racing") {
      mp.sendElapsed = 0;
      const input = document.hidden ? {} : app.mergeDriveInput(app.keys);
      mp.room.send("input", input);
    }
    // Smooth authoritative snapshots. No client can report a position or finish.
    const alpha = 1 - Math.exp(-Math.min(dt, 0.1) * 25);
    for (const racer of world.racers) {
      const state = racer.netState;
      if (!state?.position) continue;
      const target = BABYLON.Vector3.FromArray(state.position);
      racer.mesh.position.copyFrom(BABYLON.Vector3.Lerp(racer.mesh.position, target, alpha));
      for (const [index, axis] of ["x", "y", "z"].entries()) {
        racer.mesh.rotation[axis] += app.normalizeAngle(state.rotation[index] - racer.mesh.rotation[axis]) * alpha;
      }
    }
    if (world.player.finished) {
      if (world.raceTime - world.player.finishTime < 5 || world.raceOver) world.lockCameraAtFinish();
      else {
        const next = world.racers.filter(r => !r.isPlayer && !r.finished && !r.dnf).sort((a, b) => b.progress - a.progress)[0];
        if (next) { world.unlockCameraFollow(); world.camera.lockedTarget = next.mesh; }
      }
    }
    const place = 1 + world.racers.filter(r => !r.isPlayer && !r.dnf && (
      r.finished && !world.player.finished ||
      r.finished && world.player.finished && r.finishTime < world.player.finishTime ||
      !r.finished && !world.player.finished && r.progress > world.player.progress
    )).length;
    app.placeLabel.textContent = silentFor > 2000 ? "Aguardando conexão…" : `Posição: ${place}º / ${world.racers.length}`;
    app.setSpeedHud(world.player.speed, app.PHYSICS.maxSpeed);
    app.setProgressHud(world.player.progress || 0, `${Math.round((world.player.progress || 0) * 100)}%`,
      world.player.finished ? "Chegou! Aguardando jogadores" : world.track.totalLaps > 1
        ? `Volta ${Math.min(world.track.totalLaps, world.player.lapsCompleted + 1)}/${world.track.totalLaps}` : "Progresso");
    GameAudio.setEngineSpeed("player", world.player.speed, app.PHYSICS.maxSpeed);
  };

  el("btnMultiplayer").addEventListener("click", () => open());
  el("mpClose").addEventListener("click", cleanup);
  el("mpLeaveRace").addEventListener("click", cleanup);
  dialog.addEventListener("cancel", event => { event.preventDefault(); cleanup(); });
  el("mpCreate").addEventListener("click", () => connect(true));
  el("mpJoin").addEventListener("click", () => connect(false));
  el("mpReady").addEventListener("click", () => {
    const me = mp.snapshot?.players.find(p => p.id === mp.room?.sessionId);
    if (me) mp.room.send("ready", !me.ready);
  });
  el("mpStart").addEventListener("click", () => mp.room?.send("start"));
  el("mpCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(mp.room.roomId);
      status.textContent = "Código copiado.";
    } catch { status.textContent = "Copie o código exibido acima e envie aos amigos."; }
  });
  window.addEventListener("blur", () => {
    if (mp.racing) {
      app.keys = { up: false, down: false, left: false, right: false };
      mp.room?.send("input", {});
    }
  });
}
