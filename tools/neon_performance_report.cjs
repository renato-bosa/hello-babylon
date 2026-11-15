const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, 'benchmarks/neon-performance');
const median = values => {const s=[...values].sort((a,b)=>a-b);const m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const groups = new Map();
for (const dir of fs.readdirSync(base)) {
  const file = path.join(base,dir,'metrics.json');
  if (!fs.existsSync(file)) continue;
  const report=JSON.parse(fs.readFileSync(file));
  const match=dir.match(/^(?:(culling|default)-)?\d+-(legacy|baseline|optimized|candidate)$/);
  if (!match) continue;
  const stage=match[1]||'software', variant=match[2];
  const key=stage+'/'+variant;
  if (!groups.has(key)) groups.set(key,{stage,variant,runs:[],passes:[],gpu:report.results[0].gpu});
  const group=groups.get(key), track=report.results[0];
  group.runs.push(...track.runs);group.passes.push(dir);
  group.meshes=track.roadMeshes;group.triangles=track.roadTriangles;
}
const summary=[...groups.values()].map(g=>({...g,runs:undefined,samples:g.runs.length,
  fps:median(g.runs.map(r=>r.fps)),fpsMin:Math.min(...g.runs.map(r=>r.fps)),fpsMax:Math.max(...g.runs.map(r=>r.fps)),
  cpuMs:median(g.runs.map(r=>r.cpuMsP50)),drawCalls:median(g.runs.map(r=>r.drawCalls)),activeTriangles:median(g.runs.map(r=>r.activeTriangles))}));
fs.writeFileSync(path.join(base,'summary.json'),JSON.stringify(summary,null,2));
const rows=summary.map(g=>`| ${g.stage} | ${g.variant} | ${g.samples} | ${g.fps.toFixed(1)} (${g.fpsMin.toFixed(1)}–${g.fpsMax.toFixed(1)}) | ${g.cpuMs.toFixed(2)} | ${g.drawCalls} | ${g.activeTriangles} |`).join('\n');
const gpu=[...new Set(summary.map(g=>g.gpu))].map(g=>'- '+g).join('\n');
fs.writeFileSync(path.join(base,'README.md'),`# Investigação do Neon Circuit

Comparação com câmera e cenário fixos, 1280 × 720, semente determinística,
6 segundos de aquecimento e três amostras de 4 segundos por passagem.
Cada passagem abre um contexto limpo. As séries software e culling alternam
a ordem das variantes para expor variações de carga e aquecimento.
FPS inclui renderização, submissão, instrumentação e espera entre quadros.
CPU é a mediana da duração de scene.render(), não o tempo exclusivo de GPU.
Triângulos ativos são os triângulos dos meshes selecionados pela câmera;
não representam pixels efetivamente rasterizados.

## Variantes

- legacy: estrada original em retângulos sobrepostos (somente referência).
- baseline: estrada contínua entregue anteriormente, preservada em baseline-source.
- optimized: mesma geometria de baseline; bordas e marcações no mesmo mesh,
  com matrizes de mundo congeladas porque os trechos são estáticos.
- candidate: experimento com trechos de 28 em vez de 112 unidades, arquivado
  em candidate-source; não incorporado ao jogo.

## Medições

Mediana de todas as amostras, com intervalo mínimo–máximo entre parênteses.
Não comparar números de séries diferentes como se fossem um teste simultâneo.

| Série | Variante | Amostras | FPS | CPU P50 (ms) | Draw calls | Triângulos ativos |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows}

Renderizadores efetivamente informados pelo WebGL:

${gpu}

## Interpretação e decisão

A diferença pontual anterior (41,9 → 27,7 FPS) não basta para atribuir uma queda
de 34% à estrada contínua. As repetições mostram dispersão e mudança do ritmo
da máquina entre passagens. Há, contudo, aumento real de geometria: a superfície
mais detalhada e os blocos maiores selecionam mais triângulos no enquadramento.
Isso é um custo plausível para o renderizador por software, não uma causa
isolada comprovada por temporização de GPU.

Com o renderizador padrão, o Chrome utilizou a Intel UHD via Direct3D 11.
Baseline e optimized mantiveram aproximadamente 60 FPS no enquadramento testado.
Portanto, a queda original não foi observada nessa GPU e nessa cena estática.
O limite de aproximadamente 60 FPS impede inferir a capacidade máxima ou
garantir o mesmo resultado durante toda a corrida ou em outros dispositivos.

Mantida a otimização que preserva exatamente os vértices, normais, índices dos
triângulos e materiais: meshes de estrada 27 → 18 e draw calls totais 86 → 82
no enquadramento do Neon Circuit. O total de triângulos da estrada não muda.
Congelar somente matrizes mantém o descarte pela câmera, a troca de tema,
visibilidade e reconstrução da pista. Física, percurso, voltas e pré-largada
não foram modificados.

O candidato de 28 unidades reduz triângulos ativos, mas aumenta meshes e
chamadas de desenho. A série alternada não mostrou vantagem consistente
suficiente para adotar essa troca. Não afirmar ganho universal de FPS para
a otimização mantida: a redução estrutural é garantida; FPS depende do
renderizador e da carga da máquina.

## Validação e reprodução

Equivalência geométrica nas cinco pistas de asfalto: vértices, normais,
índices, materiais e matrizes. A comparação pixel a pixel do enquadramento
do Neon Circuit está em visual-equivalence.json. As imagens baseline e
optimized estão junto dos JSONs de cada passagem. A referência histórica
em continuous-road não foi sobrescrita.
O smoke test das seis pistas está em validation/smoke.json e verifica largada,
movimento, bloqueio da conclusão antes da chegada do jogador, troca de pista
e descarte dos meshes antigos.

Configure NODE_PATH (Playwright), BROWSER_PATH e BABYLON_SOURCE como no
benchmark anterior. O Babylon deve ser o mesmo nos dois lados; seu hash e
a versão do navegador são registrados em cada metrics.json.

\`\`\`powershell
node tools/neon_performance.cjs
$env:BENCH_RUN_PREFIX = 'culling-'
node tools/neon_performance.cjs candidate optimized optimized candidate
$env:BENCH_RUN_PREFIX = 'default-'
$env:BENCH_RENDERER = 'default'
node tools/neon_performance.cjs baseline optimized candidate legacy
node tools/neon_performance_report.cjs
node tools/road_geometry_check.cjs
node tools/road_geometry_equivalence.cjs
\`\`\`

BENCH_RENDERER=default permite que o Chrome escolha o renderizador; isso
não garante aceleração física. Verifique sempre o campo gpu da medição.
`);
console.log(JSON.stringify(summary,null,2));
