// BABYLON_SOURCE deve apontar para a mesma versão usada no navegador.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const B = require(process.env.BABYLON_SOURCE);
const root = path.resolve(__dirname, '..');
const app = {};
const context = vm.createContext({ BABYLON: B, window: {}, app });
for (const file of ['game/track-path.js', 'game/geometry.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8').replaceAll('export function ', 'function ') + '\ninstallApp(app);', context);
}
for (const file of fs.readdirSync(path.join(root, 'tracks')).filter(f => f.endsWith('.js'))) {
  vm.runInContext(fs.readFileSync(path.join(root, 'tracks', file), 'utf8'), context);
}
const engine = new B.NullEngine();
const scene = new B.Scene(engine);
const roadMat = new B.StandardMaterial('road', scene);
const edgeMat = new B.StandardMaterial('edge', scene);
for (const data of Object.values(context.window.NEON_RUSH_TRACKS)) {
  if (data.features?.beach) continue;
  const track = app.buildTrackFromData(data);
  let visualPath = track.path3D;
  const closed = !!data.features?.ovalArena;
  if (closed) {
    const points = visualPath.slice(track.startDist / track.trackLength, track.finishDist / track.trackLength).getCurve();
    points.push(points[0].clone());
    visualPath = new B.Path3D(points, new B.Vector3(0, 1, 0));
  }
  const before = JSON.stringify(track.path3D.getCurve());
  const groups = app.createContinuousRoad(scene, visualPath, roadMat, edgeMat, data.features?.roadWidth || 14,
    { closed, dashStep: closed ? visualPath.length() / Math.ceil(visualPath.length() / 7) : 7 });
  const roads = groups.map(g => g.getChildMeshes().find(m => m.name.startsWith('road_')));
  const worldPositions = road => Array.from(road.getVerticesData(B.VertexBuffer.PositionKind),
    (value, i) => value + road.parent.position.asArray()[i % 3]);
  // Buffers e matrizes de renderização usam float32.
  const sameSection = (a,b) => assert(a.every((v,i) => Math.abs(v-b[i]) < 1e-4), 'Emenda aberta');
  let last;
  for (const road of roads) {
    const positions = worldPositions(road);
    assert(positions.every(Number.isFinite));
    assert(road.getIndices().every(i => i >= 0 && i < positions.length / 3));
    if (last) sameSection(positions.slice(0, 6), last);
    last = positions.slice(-6);
    const normals = road.getVerticesData(B.VertexBuffer.NormalKind);
    for (let i = 1; i < normals.length; i += 3) assert(normals[i] > 0.5, 'Normal do asfalto invertida');
  }
  if (closed) sameSection(last, worldPositions(roads[0]).slice(0, 6));
  else assert(track.startDist > 0, 'Pré-largada ausente');
  assert.equal(JSON.stringify(track.path3D.getCurve()), before, 'Percurso da corrida alterado');
  const meshes = groups.flatMap(g => g.getChildMeshes());
  groups.forEach(g => g.dispose());
  assert(meshes.every(m => m.isDisposed()));
  assert(scene.materials.includes(roadMat) && scene.materials.includes(edgeMat));
  console.log(data.id + ': continuidade, normais, percurso e descarte OK');
}
engine.dispose();
