# Módulos do jogo

O `../game.js` é o ponto de entrada ES module carregado pelo HTML. Ele registra
os sistemas e inicializa a aplicação na mesma ordem usada pelo jogo original.
`scene.js` faz a composição dos sistemas da cena. Não há etapa de build.
Execute o projeto por um servidor HTTP, como no teste `tools/menu_ui_check.py`;
o carregamento de módulos pelo navegador não é compatível com abrir via `file://`.

| Módulo | Responsabilidade |
| --- | --- |
| `ui.js` | Elementos da interface e medidores do HUD |
| `input.js` | Teclado, controles virtuais e navegação dos menus |
| `profile.js` | Persistência, moedas, coleção, vitórias e itens consumíveis |
| `track-selection.js` | Seleção e persistência da pista ativa |
| `track-path.js` | Curvas, amostragem do percurso e progresso das voltas |
| `geometry.js` | Materiais e construção dos elementos do cenário |
| `world.js` | Montagem, limpeza, tema e troca do cenário da pista |
| `racers.js` | Criação dos pilotos e seleção dos carros adversários |
| `garage.js` | Prévia e equipamento dos carros |
| `shop.js` | Ofertas, compras e navegação da loja |
| `shop-previews.js` | Modelos dos itens exibidos na loja |
| `cameras.js` | Câmeras do menu, acompanhamento e chegada |
| `race.js` | Grid, voltas, contagem e início da corrida |
| `post-race.js` | Estado da corrida, espectador e estimativa de chegada |
| `ai.js` | Decisões de direção, aceleração e frenagem dos bots |
| `physics.js` | Movimento, contato com as bordas e detecção da chegada |
| `results.js` | Classificação, conclusão e recompensas |
| `diagnostics.js` | Medições de FPS, benchmark de bots e exportação CSV |
| `loop.js` | Atualização por quadro e renderização |

Os sistemas recebem dois contextos explícitos:

- `app`: interface, motor Babylon, perfil, configurações e diagnósticos.
- `world`: cena, pista atual, pilotos, câmeras, menus e estado da corrida.

`installApp` e `installScene` registram funções nesses contextos sem executar
a inicialização. As funções de inicialização são chamadas pelos pontos de
composição somente depois de todos os sistemas terem sido registrados. Isso
permite chamadas entre sistemas sem dependências circulares entre imports.

Referências mutáveis, como `world.track` e `world.player`, devem ser consultadas
no momento do uso: guardar uma cópia durante o registro pode ficar desatualizado
depois de trocar de pista ou carro. Babylon, os catálogos, os modelos dos carros,
o áudio e os controles de toque continuam sendo carregados pelo HTML.
