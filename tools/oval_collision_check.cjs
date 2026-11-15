// Regressão: contramão no checkpoint não pode selecionar a pré-largada.
// BABYLON_SOURCE aponta para o Babylon usado pelo jogo.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const B = require(process.env.BABYLON_SOURCE);
const root = path.resolve(__dirname, '..');
const app = {botBench:{active:true}};
const world = {};
const context = vm.createContext({BABYLON:B, app, world, window:{}, GameAudio:{}});
const run = file => vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replaceAll('export function ', 'function '),context);
run('game/track-path.js');vm.runInContext('installApp(app);',context);
run('game/physics.js');vm.runInContext('installApp(app); installScene(app, world); initializePhysics(app);',context);
run('game/race.js');vm.runInContext('installScene(app, world);',context);
for(const file of fs.readdirSync(path.join(root,'tracks')).filter(f=>f.endsWith('.js'))) run('tracks/'+file);
const engine = new B.NullEngine();
const scene = new B.Scene(engine);
context.window.NEON_RUSH_ACTIVE_TRACK = 'neon-oval';
world.track = app.buildTrackFromData(context.window.NEON_RUSH_TRACKS['neon-oval']);
world.path3D = world.track.path3D;
world.finishSample = app.samplePath(world.path3D,world.track.finishDist);
world.raceTime = 10;
world.player = {mesh:new B.TransformNode('player',scene),isPlayer:true};
world.markRacerFinished = racer => {racer.finished=true;racer.finishTime=world.raceTime;};
const racer=world.player, loop=world.track.closedPath3D, length=loop.length();
const reset = () => world.placeRacer(racer,world.track.startDist,0);
// Percorre posições sucessivas da via real, executando a projeção/colisão e
// detecção de voltas de produção. dt=0 isola a colisão do motor e da direção.
const step = (distance,lateral=0) => {
  const d=((distance%length)+length)%length;
  const sample=app.samplePath(loop,d);
  racer.mesh.position.copyFrom(sample.position.add(sample.binormal.scale(lateral)));
  world.applyDrive(racer,{},0);
  return sample;
};
reset();
// Uma volta legítima, incluindo o wrap que dispara o problema relatado.
for(let d=2;d<length+2 && racer.lapsCompleted===0;d+=2) step(d);
assert.equal(racer.lapsCompleted,1);
assert.equal(racer.lapBacktracks,0);
const wrapDistance=racer.closedPathDistance;
let worstCenterError=0;
for(let offset=1;offset<190;offset++) {
  const sample=step(wrapDistance-offset);
  worstCenterError=Math.max(worstCenterError,B.Vector3.Distance(racer.mesh.position,sample.position));
  assert(!racer.againstWall,'Mureta invisível no centro da curva em contramão');
}
assert(worstCenterError<1e-4);
assert.equal(racer.lapsCompleted,1);
assert.equal(racer.lapBacktracks,1);
// Movimento integrado real: volta em contramão a 40 unidades/s após o wrap.
reset();racer.lapsCompleted=1;world.wrapRacerToLapStart(racer);
for(let frame=0;frame<240;frame++) {
  const sample=app.samplePath(loop,racer.closedPathDistance);
  racer.mesh.rotation.y=app.yawFromTangent(sample.tangent)+Math.PI;
  racer.speed=40;
  world.applyDrive(racer,{},1/60);
  assert(!racer.againstWall,'Colisão invisível durante movimento integrado');
}
assert.equal(racer.lapsCompleted,1);
assert.equal(racer.lapBacktracks,1);
assert(racer.closedPathDistance<length-140);
// Ambas as bordas, inclusive na curva onde o ramal pré-largada divergia.
for(const side of [-1,1]) {
  for(let d=length-180;d<length;d+=3) {
    const sample=step(d,side*16);
    assert(racer.againstWall,'Colisão ausente além da borda');
    const local=app.samplePath(loop,racer.closedPathDistance);
    const lateral=B.Vector3.Dot(racer.mesh.position.subtract(local.position),local.binormal);
    assert(Math.abs(lateral)<=13.00001,'Colisão fora da largura desenhada');
  }
}
// Cruzar repetidamente a emenda nos dois sentidos não concede voltas.
reset();racer.lapsCompleted=1;world.wrapRacerToLapStart(racer);
for(let pass=0;pass<5;pass++) {
  for(let d=2;d>=-30;d--) step(d);
  for(let d=-30;d<=3;d++) step(d);
  assert.equal(racer.lapsCompleted,1);
  assert.equal(racer.lapBacktracks,0);
}
// Recuperar uma volta inteira feita ao contrário não conta como volta nova.
reset();racer.lapsCompleted=1;world.wrapRacerToLapStart(racer);
for(let d=2;d>=-length-15;d-=2) step(d);
assert.equal(racer.lapsCompleted,1);
for(let d=-length-15;d<=3;d+=2) step(d);
assert.equal(racer.lapsCompleted,1);
assert.equal(racer.lapBacktracks,0);
// Cinco voltas normais continuam encerrando somente na quinta chegada.
reset();
for(let lap=1;lap<=5;lap++) {
  for(let d=5;d<length+2 && racer.lapsCompleted<lap;d+=2) step(d);
  assert.equal(racer.lapsCompleted,lap);
  assert.equal(racer.finished,lap===5);
}
// Um quadro longo pode atravessar chegada e emenda sem perder a volta.
reset();step(length-10);racer.lapArmed=true;step(8);
assert.equal(racer.lapsCompleted,1);
// Pistas abertas mantêm o percurso e a estrada de pré-largada originais.
for(const data of Object.values(context.window.NEON_RUSH_TRACKS)) {
  if(data.features?.ovalArena) continue;
  const track=app.buildTrackFromData(data);
  assert.equal(track.closedPath3D,null);
  assert(track.startDist>0);
}
console.log(JSON.stringify({reverseCenterMaxError:worstCenterError,reverseDriving:true,wallBothSides:true,checkpointOscillation:true,reverseLapDebt:true,fiveLaps:true,longFrame:true,openTrackPreStart:true},null,2));
engine.dispose();
