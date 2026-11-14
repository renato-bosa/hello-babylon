# Comparação da estrada contínua

Abra `report.html` para as imagens antes/depois com divisor móvel e a tabela de
desempenho. `before/metrics.json` e `after/metrics.json` contêm todas as amostras.
`comparison.json` contém as medianas utilizadas no relatório.

O teste mede uma cena estática de cada pista, com resolução, câmera e cenário
aleatório fixados. Usa Chrome headless com SwiftShader (renderização por CPU),
portanto **não representa o FPS na GPU do jogador nem o custo da simulação de
uma corrida completa**. O tempo de `scene.render()` inclui submissão à engine;
não é uma medição isolada de GPU. Há 4 segundos de aquecimento e três amostras de
4 segundos por pista. Praia é o controle sem mudança de geometria.

A referência original foi registrada antes da implementação. As passagens
iniciais, preservadas nos arquivos `pilot-metrics.json`,
`initial-before-metrics.json` e `exploratory-after-metrics.json`, não entram na
tabela final: o piloto tinha câmera em movimento e contador cumulativo, e as
primeiras passagens ainda não isolavam o consumo aleatório da engine ao criar
meshes. Após corrigir o teste, as duas versões foram executadas em sequência.
`pre-fix-after-metrics.json` também fica excluído: antecede a adoção de
coordenadas locais por trecho. As capturas finais são lidas diretamente do
canvas logo após renderizar, evitando artefatos de captura do compositor.
A vista superior do oval desliga a neblina apenas para inspecionar a emenda;
as medições e as vistas de corrida mantêm a neblina original.

## Reprodução

Requer Node.js, Playwright e Chrome/Chromium. Configure `NODE_PATH` se Playwright
não estiver no caminho de módulos do Node, `BROWSER_PATH` com o executável do
navegador e `BABYLON_SOURCE` com uma cópia local do script Babylon usado pelo
jogo. O hash e a versão efetiva ficam registrados nas métricas. Sem
`BABYLON_SOURCE`, o benchmark usa o CDN e perde a garantia de engine fixada.

```powershell
node tools/road_benchmark.cjs before
node tools/road_benchmark.cjs after
node tools/road_report.cjs
node tools/road_geometry_check.cjs
node tools/road_benchmark.cjs after --smoke
```

O servidor temporário injeta acesso aos contextos somente para os testes.
`before/source/` preserva os dois módulos originais e é servido somente na fase
`before`; os demais arquivos vêm do repositório atual. Não alterar esses
snapshots ao atualizar a implementação. Os testes não mudam o perfil real do
jogador: cada pista abre um contexto isolado do navegador.

O teste geométrico verifica emendas, fechamento do oval, normais, integridade do
percurso e descarte. O smoke test verifica largada, movimento, bloqueio de
conclusão antes da chegada do jogador e reconstrução da pista com descarte das
meshes anteriores. Resultados em `smoke.json`.

## Implementação

`game/geometry.js` constrói a superfície e as bordas em seções de até 2 unidades.
Agrupa a geometria em trechos de até 112 unidades, conservando descarte espacial
pela câmera e materiais compartilhados. As marcações centrais conservam sua
distribuição e dimensões. A subdivisão aumenta triângulos para suavizar curvas;
o agrupamento reduz meshes e chamadas de desenho. `game/world.js` usa o mesmo
percurso visual fechado do oval e mantém toda a extensão dos percursos abertos,
incluindo a estrada antes da largada. Física e regras da corrida não mudaram.
