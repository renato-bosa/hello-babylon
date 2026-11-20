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
    await host.locator('#mpStart').click();
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__game.world.multiplayer.snapshot?.phase === 'racing')));
    await host.keyboard.down('ArrowUp');
    await host.waitForTimeout(900);
    await host.keyboard.up('ArrowUp');
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
    await pages[2].locator('#mpLeaveRace').click();
    await pages[3].locator('#mpLeaveRace').click();
    await host.waitForTimeout(5500);
    assert.equal(await host.evaluate(() => window.__game.world.raceOver), false);
    assert.equal(await pages[1].evaluate(() => window.__game.world.player.finished), false);
    assert.equal(await host.locator('#btnFinishRace').isVisible(), false, 'cannot estimate human finishes');
    finish(await pages[1].evaluate(() => window.__game.world.multiplayer.room.sessionId));
    await host.waitForFunction(() => window.__game.world.raceOver);
    await host.waitForTimeout(600);
    await host.screenshot({path:path.join(out,'results.png')});
    await host.locator('#mpLeaveRace').click();
    await pages[1].locator('#mpLeaveRace').click();
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
    console.log('PASS: four browsers, mobile portrait/landscape, authoritative movement, finish order, DNF, unchanged economy, solo Oval return and transport loss.');
  } finally {
    await browser.close();
    await new Promise(resolve => web.close(resolve));
    await gameServer.gracefullyShutdown(false);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
