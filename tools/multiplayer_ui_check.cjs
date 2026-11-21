// Run with Playwright available (or NODE_PATH pointing at its installation).
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'test-results/multiplayer');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const { startServer } = await import('../server/index.js');
  const { matchMaker } = await import('@colyseus/core');
  const gameServer = await startServer(0);
  const endpoint = `http://127.0.0.1:${gameServer.transport.server.address().port}`;
  const web = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    let data = fs.readFileSync(file);
    if (pathname === '/game/scene.js') data = data.toString().replace('return world.scene;', 'window.__game = {app, world}; return world.scene;');
    if (pathname === '/multiplayer-config.js') data = `window.NEON_RUSH_MULTIPLAYER_URL = ${JSON.stringify(endpoint)};`;
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
  await new Promise(resolve => web.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {}) });
  const errors = [];
  let delayedConnections = 0;
  const pages = [];
  const profile = page => page.evaluate(() => Object.fromEntries(['coins','fichas','wins','ovalTickets','coinMultiplierNext','calibratedTireNext','activeTrack'].map(k => [k,localStorage.getItem('neonRush.'+k)])));
  try {
    for (const [index, [width, height]] of [[568,320],[390,844],[1280,720],[844,390]].entries()) {
      const context = await browser.newContext({ viewport: {width,height}, hasTouch: width < 1000, isMobile: width < 1000 });
      await context.route('https://cdn.babylonjs.com/babylon.js', route => route.fulfill({path:require.resolve('babylonjs'),contentType:'application/javascript'}));
      await context.route('https://fonts.googleapis.com/**', route => route.abort());
      await context.addInitScript(index => {
        for (const [key,value] of Object.entries({coins:999,fichas:17,wins:4,ovalTickets:3,coinMultiplierNext:3,calibratedTireNext:1,activeTrack:index === 1 ? 'neon-oval':'neon-circuit-1'})) localStorage.setItem('neonRush.'+key,String(value));
      }, index);
      const page = await context.newPage();
      const latency = Number(process.env.NETWORK_LATENCY_MS || 0);
      if (latency) {
        await page.routeWebSocket(/^ws:\/\/127\.0\.0\.1:/, socket => {
          delayedConnections++;
          const remote = socket.connectToServer();
          function delayed(send) {
            let due = 0, sequence = 0;
            return message => {
              due = Math.max(due + 1, Date.now() + latency + ((sequence++ % 3) * 10));
              setTimeout(() => { try { send(message); } catch {} }, due - Date.now());
            };
          }
          socket.onMessage(delayed(message => remote.send(message)));
          remote.onMessage(delayed(message => socket.send(message)));
        });
      }
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${web.address().port}/`);
      await page.waitForFunction(() => window.__game);
      pages.push(page);
    }
    const before = await Promise.all(pages.map(profile));
    const host = pages[0];
    for (const [index,page] of pages.entries()) {
      await page.locator('#btnMultiplayer').click();
      await page.locator('#mpName').fill(index === 1 ? '<img src=x>' : 'Piloto '+(index+1));
      if (index === 0) {
        await page.locator('#mpCreate').click();
        await page.waitForFunction(() => window.__game.world.multiplayer.snapshot?.players.length === 1);
      } else {
        const code = await host.locator('#mpRoomCode').textContent();
        if (index === 1) {
          await page.getByRole('button', {name:`Entrar na sala ${code}`,exact:true}).click();
        } else {
          await page.locator('#mpCode').fill(code);
          await page.locator('#mpJoin').click();
        }
        await page.waitForFunction(() => window.__game.world.multiplayer.room !== null);
      }
      await page.locator('#mpReady').click();
    }
    await host.waitForFunction(() => window.__game.world.multiplayer.snapshot.players.length === 4 && window.__game.world.multiplayer.snapshot.players.every(p=>p.ready));
    assert.equal(await pages[1].locator('#mpPlayers img').count(), 0, 'names are text, not HTML');
    for (const [index,page] of pages.entries()) await page.screenshot({path:path.join(out,`lobby-${index}.png`)});
    for (const page of pages) await page.evaluate(() => {
      const {app, world} = window.__game;
      window.__parity = {go:false, speed:null, progress:null};
      for (const [method, key] of [['setSpeedHud','speed'],['setProgressHud','progress']]) {
        const original = app[method];
        app[method] = function(...args) {
          window.__parity[key] = args;
          return original.apply(this, args);
        };
      }
      world.scene.onAfterRenderObservable.add(() => {
        if (app.countdownNumber.textContent === 'VAI!' && app.countdownOverlay.classList.contains('show')) window.__parity.go = true;
      });
    });
    await host.locator('#mpStart').click();
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__game.world.multiplayer.snapshot?.phase === 'racing')));
    await host.evaluate(() => {
      const {world,app} = window.__game;
      window.__response = {start:performance.now(), local:null, server:null};
      app.keys.up = true;
      const observer = world.scene.onAfterRenderObservable.add(() => {
        const metric = window.__response;
        if (metric.local === null && world.multiplayer.prediction.racer.speed > 0) metric.local = performance.now()-metric.start;
        if (metric.server === null && world.player.speed > 0) metric.server = performance.now()-metric.start;
        if (metric.local !== null && metric.server !== null) world.scene.onAfterRenderObservable.remove(observer);
      });
    });
    await host.waitForTimeout(900);
    for (const page of pages) {
      await page.waitForFunction(() => window.__parity.go && !window.__game.app.countdownOverlay.classList.contains('show'));
    }
    await host.keyboard.up('ArrowUp');
    const response = await host.evaluate(() => window.__response);
    console.log('Input response (ms):', JSON.stringify(response));
    if (Number(process.env.NETWORK_LATENCY_MS || 0)) {
      assert(delayedConnections >= 4, 'all four WebSockets must pass through the latency proxy');
      assert(response.local !== null && response.server !== null);
      assert(response.local < response.server, 'local controls must respond before server confirmation');
      assert(response.server >= Number(process.env.NETWORK_LATENCY_MS) * 2, 'confirmation must include both directions of simulated latency');
    }
    const hostId = await host.evaluate(() => window.__game.world.multiplayer.room.sessionId);
    for (const page of pages) {
      assert.equal(await page.evaluate(() => window.__game.world.racers.length), 4);
      assert(await page.evaluate(id => window.__game.world.multiplayer.snapshot.players.find(p=>p.id===id).progress > 0, hostId));
    }
    for (const [index,page] of pages.entries()) await page.screenshot({path:path.join(out,`race-${index}.png`)});
    const code = await host.evaluate(() => window.__game.world.multiplayer.room.roomId);
    const room = matchMaker.getLocalRoomById(code);
    const finish = id => {
      const racer = room.sim.world.racers.find(r=>r.id===id);
      room.sim.world.placeRacer(racer, room.sim.world.track.finishDist-0.1, 0);
      racer.speed = 30;
    };
    finish(hostId);
    await host.waitForFunction(() => window.__game.world.player.finished);
    const finishedRacer = room.sim.world.racers.find(r => r.id === hostId);
    const finishTime = finishedRacer.finishTime;
    const finishYaw = finishedRacer.mesh.rotation.y;
    await host.evaluate(() => {
      const {app} = window.__game;
      app.keys.right = true;
      app.keys.up = true;
      window.dispatchEvent(new KeyboardEvent('keydown', {code:'Enter'}));
    });
    await host.waitForFunction(yaw => Math.abs(window.__game.world.player.netState.physics.rotation[1] - yaw) > 0.01, finishYaw);
    assert(finishedRacer.speed < 30, 'finished racer coasts despite holding accelerator');
    assert.equal(finishedRacer.finishTime, finishTime, 'steering must not change the result');
    await host.evaluate(() => { window.__game.app.keys.right = false; window.__game.app.keys.up = false; });
    await pages[2].locator('#mpLeaveRace').click();
    await pages[3].locator('#mpLeaveRace').click();
    await host.waitForTimeout(5500);
    assert.equal(await host.evaluate(() => window.__game.world.raceOver), false);
    assert.equal(await pages[1].evaluate(() => window.__game.world.player.finished), false);
    assert.equal(await host.locator('#btnFinishRace').isVisible(), false, 'cannot estimate human finishes');
    await host.waitForFunction(() => {
      const {app,world} = window.__game;
      const target = world.multiplayer.cameraTarget;
      return !target.isPlayer && app.placeLabel.textContent === `Assistindo: ${target.name}` &&
        window.__parity.speed[0] === target.speed && window.__parity.progress[0] === target.progress &&
        window.__parity.progress[2] !== 'Chegou! Aguardando jogadores';
    });
    finish(await pages[1].evaluate(() => window.__game.world.multiplayer.room.sessionId));
    await host.waitForFunction(() => window.__game.world.raceOver);
    await host.waitForTimeout(600);
    await host.screenshot({path:path.join(out,'results.png')});
    await host.keyboard.press('Enter');
    await pages[1].keyboard.press('Space');
    for (const page of pages.slice(0,2)) await page.waitForFunction(() => !window.__game.world.multiplayer.racing && window.__game.world.inMenu);
    for (const [index,page] of pages.entries()) assert.deepEqual(await profile(page), before[index], 'multiplayer must not mutate solo progress');
    // Return to the previously selected Oval and use the existing solo start.
    await pages[1].locator('#btnStartRace').click();
    assert.equal(await pages[1].evaluate(() => window.__game.world.countdownActive), true);
    assert.equal(await pages[1].evaluate(() => window.__game.world.multiplayer.racing), false);
    assert.equal((await profile(pages[1])).ovalTickets, '2');
    assert.equal((await profile(pages[1])).calibratedTireNext, null);
    // Abrupt transport loss restores menu instead of stranding the player.
    await host.locator('#btnMultiplayer').click();
    await host.locator('#mpCreate').click();
    await host.waitForFunction(() => window.__game.world.multiplayer.room !== null);
    const lostCode = await host.evaluate(() => window.__game.world.multiplayer.room.roomId);
    await matchMaker.getLocalRoomById(lostCode).disconnect();
    await host.waitForFunction(() => !window.__game.world.multiplayer.room && document.getElementById('mpStatus').textContent.includes('Conexão encerrada'));
    assert.deepEqual(errors, []);
    console.log('PASS: four browsers, GO display, post-finish steering, spectator HUD, Enter/Space return, mobile portrait/landscape, authoritative movement, finish order, DNF, unchanged economy, solo Oval return and transport loss.');
  } finally {
    await browser.close();
    await new Promise(resolve => web.close(resolve));
    await gameServer.gracefullyShutdown(false);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
