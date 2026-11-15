// Reutiliza NODE_PATH, BROWSER_PATH e BABYLON_SOURCE do road_benchmark.cjs.
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const base = path.join(__dirname, 'benchmarks/neon-performance');
// Alternância ajuda a detectar aquecimento e variação de carga da máquina.
const order = process.argv.length > 2 ? process.argv.slice(2) : ['legacy', 'baseline', 'optimized', 'optimized', 'baseline', 'legacy', 'baseline', 'optimized'];
for (const [i, variant] of order.entries()) {
  const env = {...process.env, BENCH_OUTPUT: path.join(base, `${process.env.BENCH_RUN_PREFIX || ''}${i}-${variant}`), BENCH_WARMUP_MS: '6000'};
  delete env.BENCH_SOURCE;
  if (variant === 'baseline') env.BENCH_SOURCE = path.join(base, 'baseline-source');
  if (variant === 'candidate') env.BENCH_SOURCE = path.join(base, 'candidate-source');
  console.log(`Passagem ${i + 1}/${order.length}: ${variant}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, 'road_benchmark.cjs'), variant === 'legacy' ? 'before' : 'after', '--track=neon-circuit-1'], {cwd:root, env, stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
