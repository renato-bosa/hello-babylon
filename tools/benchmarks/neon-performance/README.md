# Investigação do Neon Circuit

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
| software | legacy | 6 | 30.4 (29.0–38.7) | 2.90 | 123 | 2362 |
| software | baseline | 9 | 27.9 (26.4–29.2) | 1.50 | 86 | 6744 |
| software | optimized | 9 | 27.3 (23.4–28.7) | 1.50 | 82 | 6744 |
| culling | candidate | 6 | 24.8 (23.1–29.4) | 2.65 | 86 | 3744 |
| culling | optimized | 6 | 24.5 (23.1–25.4) | 2.70 | 82 | 6744 |
| default | baseline | 3 | 60.0 (60.0–60.0) | 3.00 | 86 | 6744 |
| default | optimized | 3 | 60.0 (60.0–60.0) | 2.80 | 82 | 6744 |
| default | candidate | 3 | 60.0 (60.0–60.0) | 3.20 | 86 | 3744 |
| default | legacy | 3 | 60.0 (60.0–60.0) | 5.50 | 123 | 2362 |

Renderizadores efetivamente informados pelo WebGL:

- ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
- ANGLE (Intel, Intel(R) UHD Graphics (0x000046B3) Direct3D11 vs_5_0 ps_5_0, D3D11)

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

```powershell
node tools/neon_performance.cjs
$env:BENCH_RUN_PREFIX = 'culling-'
node tools/neon_performance.cjs candidate optimized optimized candidate
$env:BENCH_RUN_PREFIX = 'default-'
$env:BENCH_RENDERER = 'default'
node tools/neon_performance.cjs baseline optimized candidate legacy
node tools/neon_performance_report.cjs
node tools/road_geometry_check.cjs
node tools/road_geometry_equivalence.cjs
```

BENCH_RENDERER=default permite que o Chrome escolha o renderizador; isso
não garante aceleração física. Verifique sempre o campo gpu da medição.
