// Verifica que agrupar meshes não muda vértices, normais, índices ou materiais.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const B = require(process.env.BABYLON_SOURCE);
const root = path.resolve(__dirname, '..');
const load = geometry => {
  const app = {};
  const context = vm.createContext({BABYLON:B, window:{}, app});
  for (const file of ['game/track-path.js', geometry]) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replaceAll('export function ', 'function ') + '\ninstallApp(app);', context);
  }
  for (const file of fs.readdirSync(path.join(root,'tracks')).filter(f=>f.endsWith('.js'))) vm.runInContext(fs.readFileSync(path.join(root,'tracks',file),'utf8'),context);
  return {app, tracks:context.window.NEON_RUSH_TRACKS};
};
const original = load('tools/benchmarks/neon-performance/baseline-source/geometry.js');
const current = load('game/geometry.js');
const engine = new B.NullEngine();
const scene = new B.Scene(engine);
const road = new B.StandardMaterial('road',scene), edge = new B.StandardMaterial('edge',scene);
const close = (a,b) => {assert.equal(a.length,b.length);a.forEach((v,i)=>assert(Math.abs(v-b[i])<1e-6));};
for (const data of Object.values(current.tracks)) {
  if (data.features?.beach) continue;
  const track = current.app.buildTrackFromData(data);
  let visualPath = track.path3D;
  const closed = !!data.features?.ovalArena;
  if (closed) {
    const points = visualPath.slice(track.startDist/track.trackLength,track.finishDist/track.trackLength).getCurve();
    points.push(points[0].clone());
    visualPath = new B.Path3D(points,new B.Vector3(0,1,0));
  }
  const args = [scene,visualPath,road,edge,data.features?.roadWidth||14,{closed,dashStep:closed?visualPath.length()/Math.ceil(visualPath.length()/7):7}];
  const before=original.app.createContinuousRoad(...args), after=current.app.createContinuousRoad(...args);
  assert.equal(before.length,after.length);
  before.forEach((group,i)=>{
    close(group.position.asArray(),after[i].position.asArray());
    for(const material of [road,edge]) {
      const old=group.getChildMeshes().filter(m=>m.material===material);
      const merged=after[i].getChildMeshes().find(m=>m.material===material);
      for(const kind of [B.VertexBuffer.PositionKind,B.VertexBuffer.NormalKind]) close(old.flatMap(m=>Array.from(m.getVerticesData(kind))),Array.from(merged.getVerticesData(kind)));
      let offset=0;
      const indices=old.flatMap(m=>{const result=Array.from(m.getIndices(),n=>n+offset);offset+=m.getTotalVertices();return result;});
      close(indices,Array.from(merged.getIndices()));
      assert(merged.isWorldMatrixFrozen);
      close(old[0].computeWorldMatrix(true).asArray(),merged.getWorldMatrix().asArray());
    }
  });
  [...before,...after].forEach(g=>g.dispose());
  console.log(data.id+': geometria, normais, índices, materiais e transformação equivalentes');
}
engine.dispose();
