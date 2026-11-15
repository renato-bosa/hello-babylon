// Sistema: missões. Progresso persistido + painel no hub.
// Recompensa base em moedas; 1 missão aleatória pode oferecer ticket.
// Após resgatar, a missão reinicia em 30 minutos.

export function installApp(app) {
  app.MISSION_RESET_MS = 30 * 60 * 1000;

  app.MISSION_DEFS = [
    {
      id: "tunnel-first",
      title: "As do túnel",
      description: "Fique em 1º na Túnel Rush",
      target: 1,
      rewardCoins: 50,
    },
    {
      id: "first-streak-5",
      title: "Sequência neon",
      description: "Termine 5 partidas em 1º seguidas",
      target: 5,
      rewardCoins: 135,
    },
    {
      id: "third-x3",
      title: "Pódio bronze",
      description: "Fique 3 vezes em 3º",
      target: 3,
      rewardCoins: 50,
    },
    {
      id: "buy-epic-2",
      title: "Colecionador épico",
      description: "Compre 2 carros épicos",
      target: 2,
      rewardCoins: 100,
    },
    {
      id: "praia-flyght-2",
      title: "Voo na praia",
      description: "Fique em 1º na Praia Rush 2 vezes com o Flyght",
      target: 2,
      rewardCoins: 100,
    },
  ];

  app.loadMissionState = function loadMissionState() {
    try {
      const saved = JSON.parse(localStorage.getItem(app.MISSIONS_KEY) || "{}");
      if (saved && typeof saved === "object") return saved;
    } catch (e) {}
    return {
      progress: {},
      claimed: {},
      claimedAt: {},
      firstStreak: 0,
      epicBaseline: 0,
      ticketMissionId: null,
    };
  };

  app.saveMissionState = function saveMissionState(state) {
    localStorage.setItem(app.MISSIONS_KEY, JSON.stringify(state));
  };

  app.pickRandomTicketMissionId = function pickRandomTicketMissionId(
    preferExcludeId
  ) {
    const ids = app.MISSION_DEFS.map(function (m) {
      return m.id;
    });
    let pool = ids;
    if (preferExcludeId && ids.length > 1) {
      pool = ids.filter(function (id) {
        return id !== preferExcludeId;
      });
    }
    return pool[Math.floor(Math.random() * pool.length)];
  };

  app.ensureTicketMissionVariant = function ensureTicketMissionVariant(state) {
    const valid = app.MISSION_DEFS.some(function (m) {
      return m.id === state.ticketMissionId;
    });
    if (!valid) {
      state.ticketMissionId = app.pickRandomTicketMissionId(null);
      return true;
    }
    return false;
  };

  app.isMissionTicketReward = function isMissionTicketReward(missionId) {
    const state = app.reconcileMissionResets();
    return state.ticketMissionId === missionId;
  };

  app.getMissionRewardLabel = function getMissionRewardLabel(mission) {
    if (app.isMissionTicketReward(mission.id)) return "+1 ticket";
    return "+" + mission.rewardCoins + " moedas";
  };

  app.resetMissionCycle = function resetMissionCycle(state, missionId) {
    state.progress = state.progress || {};
    state.claimed = state.claimed || {};
    state.claimedAt = state.claimedAt || {};
    delete state.claimed[missionId];
    delete state.claimedAt[missionId];
    state.progress[missionId] = 0;
    if (missionId === "first-streak-5") {
      state.firstStreak = 0;
    }
    if (missionId === "buy-epic-2") {
      state.epicBaseline = app.countPurchasedEpicCars();
    }
    // Se a variante de ticket era esta, sorteia outra (ou a mesma) de novo
    if (state.ticketMissionId === missionId) {
      state.ticketMissionId = app.pickRandomTicketMissionId(null);
    }
  };

  app.reconcileMissionResets = function reconcileMissionResets() {
    const state = app.loadMissionState();
    state.claimed = state.claimed || {};
    state.claimedAt = state.claimedAt || {};
    const now = Date.now();
    let changed = app.ensureTicketMissionVariant(state);
    app.MISSION_DEFS.forEach(function (mission) {
      if (!state.claimed[mission.id]) return;
      const at = state.claimedAt[mission.id] || 0;
      if (now - at >= app.MISSION_RESET_MS) {
        app.resetMissionCycle(state, mission.id);
        changed = true;
      }
    });
    if (changed) app.saveMissionState(state);
    return state;
  };

  app.getMissionCooldownMs = function getMissionCooldownMs(missionId) {
    const state = app.reconcileMissionResets();
    if (!(state.claimed && state.claimed[missionId])) return 0;
    const at = (state.claimedAt && state.claimedAt[missionId]) || 0;
    const left = app.MISSION_RESET_MS - (Date.now() - at);
    return left > 0 ? left : 0;
  };

  app.formatMissionCooldown = function formatMissionCooldown(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return min + ":" + String(sec).padStart(2, "0");
  };

  app.countPurchasedEpicCars = function countPurchasedEpicCars() {
    return app.loadPurchasedCars().filter(function (id) {
      const def = app.getCarDef(id);
      return def && def.rarity === "epic";
    }).length;
  };

  app.getMissionProgress = function getMissionProgress(missionId) {
    const state = app.reconcileMissionResets();
    if (missionId === "buy-epic-2") {
      const baseline = state.epicBaseline || 0;
      return Math.min(
        2,
        Math.max(0, app.countPurchasedEpicCars() - baseline)
      );
    }
    if (missionId === "first-streak-5") {
      return Math.min(5, state.firstStreak || 0);
    }
    const value = state.progress && state.progress[missionId];
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  app.isMissionClaimed = function isMissionClaimed(missionId) {
    const state = app.reconcileMissionResets();
    return !!(state.claimed && state.claimed[missionId]);
  };

  app.setMissionProgressValue = function setMissionProgressValue(
    missionId,
    value
  ) {
    const state = app.reconcileMissionResets();
    if (state.claimed && state.claimed[missionId]) {
      app.saveMissionState(state);
      return;
    }
    state.progress = state.progress || {};
    const def = app.MISSION_DEFS.find(function (m) {
      return m.id === missionId;
    });
    const cap = def ? def.target : value;
    state.progress[missionId] = Math.max(
      0,
      Math.min(cap, Math.floor(value))
    );
    app.saveMissionState(state);
  };

  app.recordMissionRaceResult = function recordMissionRaceResult(info) {
    const place = info && info.place;
    const trackId = info && info.trackId;
    const carId = info && info.carId;
    if (!place) return;

    const state = app.reconcileMissionResets();
    state.progress = state.progress || {};
    state.claimed = state.claimed || {};

    if (!(state.claimed["first-streak-5"])) {
      if (place === 1) {
        state.firstStreak = (state.firstStreak || 0) + 1;
      } else {
        state.firstStreak = 0;
      }
    }

    if (
      !(state.claimed["tunnel-first"]) &&
      place === 1 &&
      trackId === "tunnel-rush"
    ) {
      state.progress["tunnel-first"] = Math.max(
        state.progress["tunnel-first"] || 0,
        1
      );
    }

    if (!(state.claimed["third-x3"]) && place === 3) {
      state.progress["third-x3"] = Math.min(
        3,
        (state.progress["third-x3"] || 0) + 1
      );
    }

    if (
      !(state.claimed["praia-flyght-2"]) &&
      place === 1 &&
      trackId === "praia-rush" &&
      carId === "flyght"
    ) {
      state.progress["praia-flyght-2"] = Math.min(
        2,
        (state.progress["praia-flyght-2"] || 0) + 1
      );
    }

    app.saveMissionState(state);
    if (typeof app.refreshMissionsPanel === "function") {
      app.refreshMissionsPanel();
    }
  };

  app.recordMissionCarPurchase = function recordMissionCarPurchase(carId) {
    const def = app.getCarDef(carId);
    if (!def || def.rarity !== "epic") return;
    if (typeof app.refreshMissionsPanel === "function") {
      app.refreshMissionsPanel();
    }
  };

  app.claimMissionReward = function claimMissionReward(missionId) {
    const def = app.MISSION_DEFS.find(function (m) {
      return m.id === missionId;
    });
    if (!def) return false;
    if (app.isMissionClaimed(missionId)) return false;
    if (app.getMissionProgress(missionId) < def.target) return false;

    const state = app.reconcileMissionResets();
    state.claimed = state.claimed || {};
    state.claimedAt = state.claimedAt || {};
    state.claimed[missionId] = true;
    state.claimedAt[missionId] = Date.now();
    if (missionId === "buy-epic-2") {
      state.epicBaseline = app.countPurchasedEpicCars();
    }
    if (missionId === "first-streak-5") {
      state.firstStreak = 0;
    }
    app.saveMissionState(state);

    if (app.isMissionTicketReward(missionId)) {
      app.addOvalTickets(1);
      if (typeof app.refreshTrackLabel === "function") {
        app.refreshTrackLabel();
      }
    } else {
      app.coins += def.rewardCoins || 0;
      app.saveCoins(app.coins);
    }
    app.refreshMoneyLabel();
    if (typeof app.refreshMissionsPanel === "function") {
      app.refreshMissionsPanel();
    }
    return true;
  };

  app.missionsCarouselIndex = 0;

  app.getMissionsCarouselCount = function getMissionsCarouselCount() {
    return app.MISSION_DEFS.length;
  };

  app.clampMissionsCarouselIndex = function clampMissionsCarouselIndex(index) {
    const max = Math.max(0, app.getMissionsCarouselCount() - 1);
    return Math.max(0, Math.min(max, index | 0));
  };

  app.applyMissionsCarouselTransform = function applyMissionsCarouselTransform(
    dragOffsetPx
  ) {
    const track = document.getElementById("missionsList");
    const viewport = document.getElementById("missionsViewport");
    if (!track || !viewport) return;
    const width = viewport.clientWidth || 1;
    const offset =
      -app.missionsCarouselIndex * width + (dragOffsetPx || 0);
    track.style.transform = "translate3d(" + offset + "px, 0, 0)";
  };

  app.updateMissionsCarouselChrome = function updateMissionsCarouselChrome() {
    const prev = document.getElementById("btnMissionsPrev");
    const next = document.getElementById("btnMissionsNext");
    const dots = document.getElementById("missionsDots");
    app.missionsCarouselIndex = app.clampMissionsCarouselIndex(
      app.missionsCarouselIndex
    );
    if (prev) prev.disabled = app.getMissionsCarouselCount() <= 1;
    if (next) next.disabled = app.getMissionsCarouselCount() <= 1;
    if (dots) {
      const buttons = dots.querySelectorAll(".missions-dot");
      buttons.forEach(function (dot, i) {
        dot.classList.toggle("active", i === app.missionsCarouselIndex);
      });
    }
    app.applyMissionsCarouselTransform(0);
  };

  app.setMissionsCarouselIndex = function setMissionsCarouselIndex(index) {
    app.missionsCarouselIndex = app.clampMissionsCarouselIndex(index);
    app.updateMissionsCarouselChrome();
  };

  app.stepMissionsCarousel = function stepMissionsCarousel(delta) {
    const count = app.getMissionsCarouselCount();
    if (count <= 0) return;
    const next =
      ((app.missionsCarouselIndex + delta) % count + count) % count;
    app.setMissionsCarouselIndex(next);
  };

  app.buildMissionCard = function buildMissionCard(mission) {
    const progress = app.getMissionProgress(mission.id);
    const claimed = app.isMissionClaimed(mission.id);
    const cooldownMs = claimed ? app.getMissionCooldownMs(mission.id) : 0;
    const done = progress >= mission.target;
    const ticketReward = app.isMissionTicketReward(mission.id);

    const slide = document.createElement("div");
    slide.className = "missions-slide";
    slide.dataset.missionId = mission.id;

    const row = document.createElement("div");
    row.className =
      "mission-card" +
      (claimed ? " claimed" : "") +
      (done && !claimed ? " ready" : "") +
      (ticketReward ? " ticket-reward" : "");

    const head = document.createElement("div");
    head.className = "mission-card-head";

    const title = document.createElement("strong");
    title.className = "mission-title";
    title.textContent = mission.title;

    const reward = document.createElement("span");
    reward.className = "mission-reward" + (ticketReward ? " ticket" : "");
    reward.textContent = app.getMissionRewardLabel(mission);

    head.appendChild(title);
    head.appendChild(reward);

    const desc = document.createElement("p");
    desc.className = "mission-desc";
    desc.textContent = mission.description;

    const foot = document.createElement("div");
    foot.className = "mission-card-foot";

    const prog = document.createElement("span");
    prog.className = "mission-progress";
    if (claimed && cooldownMs > 0) {
      prog.textContent = "Volta em " + app.formatMissionCooldown(cooldownMs);
    } else {
      prog.textContent =
        Math.min(progress, mission.target) + " / " + mission.target;
    }

    const action = document.createElement("button");
    action.type = "button";
    action.className = "mission-claim";
    if (claimed) {
      action.textContent = "Aguardando";
      action.disabled = true;
    } else if (done) {
      action.textContent = "Receber";
      action.addEventListener("click", function () {
        app.claimMissionReward(mission.id);
      });
    } else {
      action.textContent = "Em andamento";
      action.disabled = true;
    }

    foot.appendChild(prog);
    foot.appendChild(action);
    row.appendChild(head);
    row.appendChild(desc);
    row.appendChild(foot);
    slide.appendChild(row);
    return slide;
  };

  app.updateMissionCardContent = function updateMissionCardContent(
    slide,
    mission
  ) {
    const progress = app.getMissionProgress(mission.id);
    const claimed = app.isMissionClaimed(mission.id);
    const cooldownMs = claimed ? app.getMissionCooldownMs(mission.id) : 0;
    const done = progress >= mission.target;
    const ticketReward = app.isMissionTicketReward(mission.id);
    const card = slide.querySelector(".mission-card");
    if (!card) return;

    card.className =
      "mission-card" +
      (claimed ? " claimed" : "") +
      (done && !claimed ? " ready" : "") +
      (ticketReward ? " ticket-reward" : "");

    const reward = card.querySelector(".mission-reward");
    if (reward) {
      reward.className = "mission-reward" + (ticketReward ? " ticket" : "");
      reward.textContent = app.getMissionRewardLabel(mission);
    }

    const prog = card.querySelector(".mission-progress");
    if (prog) {
      if (claimed && cooldownMs > 0) {
        prog.textContent = "Volta em " + app.formatMissionCooldown(cooldownMs);
      } else {
        prog.textContent =
          Math.min(progress, mission.target) + " / " + mission.target;
      }
    }

    const action = card.querySelector(".mission-claim");
    if (action) {
      const nextLabel = claimed
        ? "Aguardando"
        : done
          ? "Receber"
          : "Em andamento";
      const shouldEnable = !claimed && done;
      if (
        action.textContent !== nextLabel ||
        action.disabled !== !shouldEnable
      ) {
        const fresh = document.createElement("button");
        fresh.type = "button";
        fresh.className = "mission-claim";
        fresh.textContent = nextLabel;
        fresh.disabled = !shouldEnable;
        if (shouldEnable) {
          fresh.addEventListener("click", function () {
            app.claimMissionReward(mission.id);
          });
        }
        action.replaceWith(fresh);
      }
    }
  };

  app.refreshMissionsDots = function refreshMissionsDots() {
    const dots = document.getElementById("missionsDots");
    if (!dots) return;
    dots.innerHTML = "";
    app.MISSION_DEFS.forEach(function (_mission, i) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className =
        "missions-dot" + (i === app.missionsCarouselIndex ? " active" : "");
      dot.setAttribute("aria-label", "Missão " + (i + 1));
      dot.addEventListener("click", function () {
        app.setMissionsCarouselIndex(i);
      });
      dots.appendChild(dot);
    });
  };

  app.refreshMissionsPanel = function refreshMissionsPanel() {
    const list = document.getElementById("missionsList");
    if (!list) return;
    app.reconcileMissionResets();

    const existing = list.querySelectorAll(".missions-slide");
    const canPatch =
      existing.length === app.MISSION_DEFS.length &&
      Array.prototype.every.call(existing, function (slide, i) {
        return slide.dataset.missionId === app.MISSION_DEFS[i].id;
      });

    if (canPatch) {
      existing.forEach(function (slide, i) {
        app.updateMissionCardContent(slide, app.MISSION_DEFS[i]);
      });
    } else {
      list.innerHTML = "";
      app.MISSION_DEFS.forEach(function (mission) {
        list.appendChild(app.buildMissionCard(mission));
      });
      app.refreshMissionsDots();
    }

    app.missionsCarouselIndex = app.clampMissionsCarouselIndex(
      app.missionsCarouselIndex
    );
    app.updateMissionsCarouselChrome();
  };
}

export function installScene(app, world) {
  world.bindMissionsCarouselInteractions = function bindMissionsCarouselInteractions() {
    if (world.missionsCarouselBound) return;
    world.missionsCarouselBound = true;

    const viewport = document.getElementById("missionsViewport");
    const track = document.getElementById("missionsList");
    if (!viewport || !track) return;

    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let dragX = 0;
    let dragging = false;
    let axisLocked = null;

    function endDrag(finish) {
      if (pointerId == null) return;
      track.classList.remove("dragging");
      if (finish) {
        const width = viewport.clientWidth || 1;
        const threshold = Math.max(40, width * 0.18);
        if (dragX <= -threshold) app.stepMissionsCarousel(1);
        else if (dragX >= threshold) app.stepMissionsCarousel(-1);
        else app.updateMissionsCarouselChrome();
      } else {
        app.updateMissionsCarouselChrome();
      }
      pointerId = null;
      dragging = false;
      axisLocked = null;
      dragX = 0;
    }

    viewport.addEventListener(
      "pointerdown",
      function (e) {
        if (e.button != null && e.button !== 0) return;
        if (e.target && e.target.closest && e.target.closest("button")) return;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        dragX = 0;
        dragging = true;
        axisLocked = null;
        track.classList.add("dragging");
        try {
          viewport.setPointerCapture(e.pointerId);
        } catch (err) {}
      },
      { passive: true }
    );

    viewport.addEventListener(
      "pointermove",
      function (e) {
        if (!dragging || e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!axisLocked) {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          axisLocked = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
          if (axisLocked === "y") {
            endDrag(false);
            return;
          }
        }
        if (axisLocked !== "x") return;
        dragX = dx;
        app.applyMissionsCarouselTransform(dragX);
      },
      { passive: true }
    );

    function onPointerUp(e) {
      if (e.pointerId !== pointerId) return;
      endDrag(true);
    }

    viewport.addEventListener("pointerup", onPointerUp);
    viewport.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("resize", function () {
      if (!world.missionsOpen) return;
      app.updateMissionsCarouselChrome();
    });
  };

  world.openMissions = function openMissions() {
    if (!world.inMenu || app.perfTestRunning) return;
    world.closeGarage({ restoreCar: true });
    world.closeShop({ restoreCar: true });
    world.missionsOpen = true;
    document.getElementById("mainMenu").classList.add("missions-open");
    const panel = document.getElementById("missionsPanel");
    panel.classList.add("show");
    panel.setAttribute("aria-hidden", "false");
    world.bindMissionsCarouselInteractions();
    app.refreshMissionsPanel();
    app.setMissionsCarouselIndex(app.missionsCarouselIndex || 0);
    if (world.missionsRefreshTimer) {
      clearInterval(world.missionsRefreshTimer);
    }
    world.missionsRefreshTimer = setInterval(function () {
      if (!world.missionsOpen) return;
      app.refreshMissionsPanel();
    }, 1000);
    world.syncMobileControlsVisibility();
  };

  world.closeMissions = function closeMissions() {
    world.missionsOpen = false;
    if (world.missionsRefreshTimer) {
      clearInterval(world.missionsRefreshTimer);
      world.missionsRefreshTimer = null;
    }
    const panel = document.getElementById("missionsPanel");
    if (panel) {
      panel.classList.remove("show");
      panel.setAttribute("aria-hidden", "true");
    }
    document.getElementById("mainMenu").classList.remove("missions-open");
    world.syncMobileControlsVisibility();
  };
}

export function initializeMissions(app) {
  app.MISSIONS_KEY = "neonRush.missions";
  const originalPurchase = app.purchaseCar;
  app.purchaseCar = function purchaseCar(carId) {
    const before = app.loadPurchasedCars().slice();
    originalPurchase(carId);
    const after = app.loadPurchasedCars();
    if (after.length > before.length) {
      app.recordMissionCarPurchase(carId);
    }
  };
  app.reconcileMissionResets();
}

export function initializeMissionsScene(app, world) {
  world.missionsOpen = false;
  world.missionsRefreshTimer = null;
}

export function bindMissionsControls(app, world) {
  const btn = document.getElementById("btnMissions");
  if (btn) {
    btn.addEventListener("click", function () {
      world.openMissions();
    });
  }
  const closeBtn = document.getElementById("btnMissionsClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      world.closeMissions();
    });
  }
  const prevBtn = document.getElementById("btnMissionsPrev");
  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      app.stepMissionsCarousel(-1);
    });
  }
  const nextBtn = document.getElementById("btnMissionsNext");
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      app.stepMissionsCarousel(1);
    });
  }
}
