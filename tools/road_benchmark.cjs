// Uso: node tools/road_benchmark.cjs before|after
// Requer Playwright. BROWSER_PATH e BABYLON_SOURCE permitem fixar navegador/CDN.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const phase = process.argv[2];
const smoke = process.argv.includes('--smoke');
const captureOnly = process.argv.includes('--capture');
const selectedTrack = process.argv.find(arg => arg.startsWith('--track='))?.slice(8);
if (selectedTrack && !captureOnly && !process.env.BENCH_OUTPUT) throw Error('Use BENCH_OUTPUT para não sobrescrever a referência completa');
if (!['before', 'after'].includes(phase)) throw new Error('Informe before ou after');
const base = path.join(__dirname, 'benchmarks/continuous-road');
const output = process.env.BENCH_OUTPUT ? path.resolve(process.env.BENCH_OUTPUT) : path.join(base, phase);
fs.mkdirSync(output, { recursive: true });
const hook = `
  window.__roadBenchmark = { app, world };
`;
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  let file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) {
    response.writeHead(404); response.end(); return;
  }
  if (phase === 'before' && ['/game/geometry.js', '/game/world.js'].includes(pathname)) {
    file = path.join(base, 'before/source', path.basename(file));
  }
  if (process.env.BENCH_SOURCE && ['/game/geometry.js', '/game/world.js'].includes(pathname)) {
    file = path.join(path.resolve(process.env.BENCH_SOURCE), path.basename(file));
  }
  let data = fs.readFileSync(file);
  if (pathname === '/game/world.js') {
    // A engine também usa Math.random ao criar meshes. Recomeçar antes do
    // cenário mantém prédios e pilotos iguais com qualquer malha de estrada.
    data = data.toString().replace('const tunnel = world.getTunnelRange();',
      'window.__resetRoadRandom(987654321);\n    const tunnel = world.getTunnelRange();');
  }
  if (pathname === '/game/scene.js') {
    const source = data.toString();
    if (!source.includes('return world.scene;')) throw new Error('Ponto de instrumentação ausente');
    data = source.replace('return world.scene;', hook + 'return world.scene;');
  }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
  response.end(data);
});
const tracks = [
  ['neon-circuit-1', 0.38], ['sunset-rush', 0.35], ['tunnel-rush', 0.22],
  ['praia-rush', 0.38], ['natal-race', 0.3], ['neon-oval', 0.86],
];
let browser;
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_PATH || undefined,
    args: process.env.BENCH_RENDERER === 'default' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const report = {
    phase, date: new Date().toISOString(), browser: browser.version(),
    viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    renderer: process.env.BENCH_RENDERER === 'default' ? 'Padrão do navegador; renderer efetivo em results[].gpu' : 'ANGLE / SwiftShader (software)', seed: 123456789,
    source: process.env.BENCH_SOURCE || (phase === 'before' ? 'legacy snapshot' : 'workspace'),
    warmupMs: Number(process.env.BENCH_WARMUP_MS || 4000), sampleMs: 4000, repeats: 3,
    scenario: 'Câmera de corrida estática; simulação e animações do menu pausadas. Renderização e animações dos modelos permanecem ativas.',
    babylonSha256: process.env.BABYLON_SOURCE ? crypto.createHash('sha256').update(fs.readFileSync(process.env.BABYLON_SOURCE)).digest('hex') : null,
    results: [],
  };
  for (const [id, fraction] of tracks) {
    if (selectedTrack && selectedTrack !== id) continue;
    const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: 1 });
    if (process.env.BABYLON_SOURCE) await context.route('https://cdn.babylonjs.com/babylon.js', route => route.fulfill({ path: process.env.BABYLON_SOURCE, contentType: 'application/javascript' }));
    await context.route('https://fonts.googleapis.com/**', route => route.abort());
    await context.route('https://fonts.gstatic.com/**', route => route.abort());
    await context.addInitScript(({ id, seed }) => {
      let state = seed;
      window.__resetRoadRandom = seed => { state = seed; };
      Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
      localStorage.setItem('neonRush.activeTrack', id);
    }, { id, seed: report.seed });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__roadBenchmark);
    await page.evaluate(async fraction => {
      const { app, world } = window.__roadBenchmark;
      app.perfTestRunning = true;
      app.mainMenu.classList.remove('show');
      world.setRivalVisibility(true);
      const distance = world.track.startDist + world.track.lapLength * fraction;
      world.placeRacer(world.player, distance, 0);
      world.getActiveRivals().forEach((racer, i) => world.placeRacer(racer, distance + 18 + i * 9, racer.preferredLane));
      const sample = app.samplePath(world.path3D, distance);
      const eye = sample.position.subtract(sample.tangent.scale(14)).add(new BABYLON.Vector3(0, 10, 0));
      const camera = new BABYLON.FreeCamera('benchmarkCamera', eye, world.scene);
      camera.setTarget(sample.position.add(new BABYLON.Vector3(0, 0.8, 0)));
      world.scene.activeCamera = camera;
      await world.scene.whenReadyAsync();
      const original = world.scene.render.bind(world.scene);
      window.__renderSamples = [];
      world.scene.render = function (...args) {
        const start = performance.now();
        const previousDrawCalls = app.engine._drawCalls.current;
        original(...args);
        if (window.__recordRoadBenchmark) window.__renderSamples.push({
          start, cpuMs: performance.now() - start,
          drawCalls: app.engine._drawCalls.current - previousDrawCalls,
          activeMeshes: world.scene.getActiveMeshes().length,
          activeTriangles: world.scene.getActiveMeshes().data.slice(0, world.scene.getActiveMeshes().length)
            .reduce((sum, mesh) => sum + mesh.getTotalIndices() / 3, 0),
        });
      };
    }, fraction);
    if (smoke) {
      const checks = await page.evaluate(() => {
        const {app, world} = window.__roadBenchmark;
        const check = (condition, message) => { if (!condition) throw Error(message); };
        app.engine.stopRenderLoop();
        const ticketCost = app.getTrackTicketCost();
        const ticketChecks = {};
        if (ticketCost > 0) {
          app.saveOvalTickets(0);
          const coinsBefore = app.coins;
          const alert = window.alert;
          const alerts = [];
          window.alert = message => alerts.push(message);
          try { world.startRaceFromMenu(); } finally { window.alert = alert; }
          check(alerts.length === 1, 'Bloqueio sem ticket não foi informado');
          check(world.inMenu && !world.countdownActive, 'Oval iniciou sem ticket');
          check(app.getOvalTickets() === 0 && app.coins === coinsBefore, 'Bloqueio alterou o saldo');
          app.addOvalTickets(ticketCost + 1);
          ticketChecks.blockedWithoutTicket = true;
        } else {
          app.saveOvalTickets(2);
        }
        const ticketsBefore = app.getOvalTickets();
        world.startRaceFromMenu();
        check(!world.inMenu && world.countdownActive, 'Largada não iniciou');
        check(app.getOvalTickets() === ticketsBefore - ticketCost, 'Consumo incorreto de tickets');
        check(Number(localStorage.getItem(app.OVAL_TICKETS_KEY)) === ticketsBefore - ticketCost, 'Consumo não persistido');
        ticketChecks.exactTicketConsumption = true;
        if (!ticketCost) ticketChecks.freeTrackPreservesTickets = true;
        world.countdownActive = false;
        const initial = world.player.mesh.position.clone();
        for (let i = 0; i < 60; i++) world.applyDrive(world.player, {up:true}, 1/60);
        check(BABYLON.Vector3.Distance(initial, world.player.mesh.position) > 1, 'Jogador não se moveu');
        world.raceTime = 1000;
        check(!world.canConcludeRace(), 'Conclusão permitida antes de o jogador terminar');
        const old = [...world.roadPieces];
        const oldMeshes = old.flatMap(g => g.getChildMeshes());
        check(app.switchTrackInScene(world.track.data.id, {force:true}), 'Troca de pista falhou');
        check(oldMeshes.every(m => m.isDisposed()), 'Meshes antigos permaneceram na cena');
        check(world.roadPieces.every(g => g.getChildMeshes().every(m => m.material && world.scene.materials.includes(m.material))), 'Material descartado na troca');
        world.scene.render();
        if (world.track.data.id === 'neon-circuit-1') {
          const epics = Object.values(window.NEON_RUSH_CARS).filter(car => car.rarity === 'epic').map(car => car.id);
          app.savePurchasedCars(epics);
          app.saveMissionState({epicBaseline:epics.length,ticketMissionId:'buy-epic-2'});
          // Exercita a criação e a atualização do cartão, em contexto isolado.
          for (let i = 0; i < 2; i++) {
            app.refreshMissionsPanel();
            const action = document.querySelector('[data-mission-id="buy-epic-2"] .mission-claim');
            check(action && action.disabled && action.textContent === 'Encerrada', 'Missão esgotada não foi encerrada na interface');
          }
          ticketChecks.retiredMissionUI = true;
        }
        return { start:true, drive:true, playerFinishGuard:true, trackSwitch:true, disposal:true, ...ticketChecks };
      });
      if (errors.length) throw Error(errors.join('\n'));
      report.results.push({id, checks});
      fs.writeFileSync(path.join(process.env.BENCH_OUTPUT ? output : base, 'smoke.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify({id, checks}));
      await context.close();
      continue;
    }
    await page.waitForTimeout(report.warmupMs);
    const runs = [];
    for (let run = 0; run < (captureOnly ? 0 : report.repeats); run++) {
      await page.evaluate(() => { window.__renderSamples = []; window.__recordRoadBenchmark = true; });
      await page.waitForTimeout(report.sampleMs);
      runs.push(await page.evaluate(() => {
        window.__recordRoadBenchmark = false;
        const rows = window.__renderSamples;
        const intervals = rows.slice(1).map((r, i) => r.start - rows[i].start);
        const percentile = (values, p) => values.slice().sort((a,b) => a-b)[Math.floor((values.length-1)*p)];
        const mean = values => values.reduce((a,b) => a+b,0) / values.length;
        return {
          frames: rows.length, fps: 1000 / mean(intervals),
          frameMsP50: percentile(intervals,.5), frameMsP95: percentile(intervals,.95),
          cpuMsP50: percentile(rows.map(r=>r.cpuMs),.5), cpuMsP95: percentile(rows.map(r=>r.cpuMs),.95),
          drawCalls: mean(rows.map(r=>r.drawCalls)), activeMeshes: mean(rows.map(r=>r.activeMeshes)),
          activeTriangles: mean(rows.map(r=>r.activeTriangles)),
        };
      }));
    }
    const stats = await page.evaluate(() => {
      const { app, world } = window.__roadBenchmark;
      const meshes = world.roadPieces.flatMap(node => node.getChildMeshes());
      const gl = app.engine._gl;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        babylonVersion: BABYLON.Engine.Version,
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        meshes: world.scene.meshes.length, materials: world.scene.materials.length,
        roadMeshes: meshes.length, roadVertices: meshes.reduce((n,m)=>n+m.getTotalVertices(),0),
        roadTriangles: meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),
        raceLength: world.track.raceLength, laps: world.track.totalLaps,
        camera: app.scene.activeCamera.position.asArray(),
      };
    });
    const screenshot = await page.evaluate(() => {
      const {app, world} = window.__roadBenchmark;
      app.engine.stopRenderLoop();
      world.scene.render();
      return app.canvas.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(path.join(output, id + '.png'), Buffer.from(screenshot, 'base64'));
    if (id === 'neon-oval') {
      await page.evaluate(() => {
        const {world}=window.__roadBenchmark;
        // Vista diagnóstica extra: sem neblina para revelar a emenda da volta.
        // Feita após as medições e a captura normal da corrida.
        world.scene.fogEnabled=false;
        const camera=new BABYLON.ArcRotateCamera('benchmarkOverview',-Math.PI/2,.01,470,new BABYLON.Vector3(90,0,0),world.scene);
        world.scene.activeCamera=camera;
        world.scene.render();
      });
      await page.waitForTimeout(250);
      const overview = await page.evaluate(() => {const {app,world}=window.__roadBenchmark;world.scene.render();return app.canvas.toDataURL('image/png').split(',')[1];});
      fs.writeFileSync(path.join(output, id + '-overview.png'), Buffer.from(overview, 'base64'));
    }
    if (errors.length) throw new Error(errors.join('\n'));
    const result = { id, fraction, ...stats, runs };
    report.results.push(result);
    if (!captureOnly) fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ phase, id, fps: runs.map(r=>+r.fps.toFixed(1)), roadMeshes: stats.roadMeshes }));
    await context.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  server.close();
});
