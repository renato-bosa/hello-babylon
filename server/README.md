# Multiplayer público e privado — primeira versão

O frontend continua estático no GitHub Pages. O servidor Node.js usa Colyseus
com WebSocket seguro (WSS na hospedagem), uma sala por corrida e 2–4 jogadores.
As seis pistas estão disponíveis; quem cria a sala escolhe a pista no menu antes
de abri-la. Todos confirmam **Pronto** e o anfitrião inicia a contagem.
Ao criar, escolha **Pública** (padrão) ou **Privada**. Salas públicas com vagas
aparecem na lista do multiplayer, atualizada a cada 5 segundos ou pelo botão
Atualizar. Basta clicar em Entrar, sem compartilhar código. Salas cheias ou já
iniciadas saem da lista; uma vaga liberada no lobby faz a sala reaparecer.

## Executar localmente

Requer Node.js >= 22.13 e pnpm 11.25.0.

```sh
npx --yes pnpm@11.25.0 install --frozen-lockfile
node server/index.js
```

O servidor usa `PORT` ou 2567. Em outro terminal, sirva a raiz do repositório:

```sh
python -m http.server 8000
```

Abra `http://localhost:8000` em dois navegadores/abas, clique em **Multiplayer**,
crie uma sala e entre na outra aba com o código. Em localhost, o frontend usa
automaticamente `http://localhost:2567`. Para testar em outros dispositivos,
configure `multiplayer-config.js` com um endereço acessível por eles.

## Publicar no Render Free

1. Faça commit/push desta versão no GitHub.
2. No Render, crie um **Blueprint** apontando para o repositório. O `render.yaml`
   na raiz define um Web Service Node, plano Free, região Virginia e `/health`.
   Alternativamente, crie um Web Service manualmente com a **raiz do repositório**
   como diretório de trabalho (o servidor importa módulos de `game/` e `tracks/`).
3. Build: `npx --yes pnpm@11.25.0 install --frozen-lockfile`.
   Start: `node server/index.js`. Node: 22.16.0. Não fixe `PORT`: o Render fornece.
4. Abra `https://SEU-SERVICO.onrender.com/health` e confirme
   `{"ok":true,"protocol":2}`.
5. Coloque `https://SEU-SERVICO.onrender.com` em
   `window.NEON_RUSH_MULTIPLAYER_URL`, no arquivo `multiplayer-config.js`.
   Esse endereço é público e não contém credenciais.
6. Faça commit/push da configuração para publicar o frontend no Pages.
7. Valide uma corrida entre dispositivos em redes diferentes, incluindo celular.

A publicação não foi executada automaticamente: a URL depende do serviço criado
na conta Render. Sem URL configurada, o modo solo funciona normalmente e o botão
online informa indisponibilidade. O SDK do navegador está versionado em
`vendor/colyseus.js`, evitando depender de um CDN adicional para iniciar o solo.
Para atualizá-lo após trocar a versão do SDK, execute `node tools/vendor-multiplayer.cjs`.
O workflow do Pages publica somente os arquivos do frontend.

## Comportamento e limites desta versão

- Código de 10 caracteres. Salas privadas não aparecem no endpoint `/rooms`.
  Clientes antigos que não enviam visibilidade continuam criando salas privadas.
  Quem possui o código
  pode entrar enquanto houver vaga e a corrida não tiver começado. Não há contas
  ou autenticação de identidade; o nome é apenas um apelido.
- Servidor autoritativo: recebe somente acelerar/frear/virar; aplica a mesma
  física e geometria do solo a 60 passos por segundo. Envia snapshots a 20 Hz.
  Posições, voltas e chegada não são aceitas do navegador.
- O cliente prevê o próprio movimento com a mesma física a 60 Hz e envia lotes
  de até 6 comandos numerados por quadro (no máximo 60 mensagens/s). O servidor
  limita os passos ao tempo decorrido e confirma o último comando processado.
  O cliente restaura esse estado e reaplica apenas os comandos pendentes; pequenas
  correções são suavizadas em 120 ms. Resultados e voltas exibidos continuam sendo
  confirmados pelo servidor, sem recompensas disparadas pela previsão.
- Adversários são interpolados com um buffer de aproximadamente 100 ms. A câmera
  online usa suavização baseada no tempo; a câmera e a física do solo não mudaram.
  Atrasos longos ainda podem produzir correções: a previsão para após 500 ms sem
  snapshots e limita o histórico a 120 comandos. Abas ocultas deixam de enviar
  comandos; após 500 ms sem comandos o servidor desacelera o carro.
- O protocolo agora é **2**: publique servidor e frontend juntos e recarregue os
  navegadores. Clientes do protocolo 1 são rejeitados para evitar corridas com
  formatos incompatíveis. Não há promessa de capacidade no Render Free.
- Sem bots, recompensas, consumo de tickets/pneu, registro de vitórias ou avanço
  de missões online. Todos usam a velocidade padrão. A coleção e o equipamento
  locais selecionam o visual; sua propriedade não é autenticada pelo servidor.
- Após chegar, o jogador espera 5 segundos e passa a assistir a quem ainda corre.
  Não é permitido estimar a chegada de humanos. A corrida só termina quando
  todos chegarem ou abandonarem; ninguém conectado é encerrado por estar atrás.
- Sair ou perder a conexão marca abandono. Nesta versão não há retomada de corrida
  após reconexão. A perda do servidor devolve o cliente ao menu com uma mensagem.
  Quem já chegou preserva seu resultado mesmo que saia.
- O anfitrião é transferido se sair do lobby. Após a largada, o servidor mantém a
  corrida sem depender do anfitrião. Salas vazias são descartadas; lobbies expiram
  após 30 minutos. Para outra corrida, crie outra sala.
- O frontend aguarda até 90 segundos para o servidor despertar, permite cancelar
  e repetir a conexão. Suspensão/reinício do Render perde as salas em memória.
  Não há banco de dados nesta versão.
- Uma instância/processo, sem Redis ou escalonamento horizontal. O plano Free é
  usado para testes privados. Publicação ampla requer avaliar limites de criação
  de salas, autenticação, carga, latência e custos.

## Verificação

```sh
node --test server/test/*.test.js
```

Testa as seis pistas com a física compartilhada e clientes Colyseus reais:
salas privadas, lotação, anfitrião, prontidão, largada, movimento, expiração de
comandos, rejeição de posição/chegada enviada pelo cliente, abandono e descarte.

Teste de navegador (Playwright deve estar disponível; `NODE_PATH` pode apontar
para uma instalação existente, `CHROME_PATH` pode selecionar o executável):

```sh
node tools/multiplayer_ui_check.cjs
```

Executa quatro navegadores, retrato/paisagem/desktop, corrida e resultados,
proteção de apelidos como texto, retorno ao solo e preservação da economia.
Capturas ficam em `test-results/multiplayer/` (ignorado pelo Git).

Defina `NETWORK_LATENCY_MS=100` para simular 100 ms por direção, mais variação
de entrega. O teste verifica que os quatro WebSockets passam pela simulação e
que os controles locais respondem antes da confirmação. Os testes unitários de
`network-motion.test.js` cobrem reconciliação nas seis pistas, limite de tempo
do servidor, 30/60/144 FPS, interpolação e câmera.

Os testes de chegada reposicionam pilotos **dentro da fixture de teste no servidor**
perto da linha para exercitar a física; não existe esse comando no protocolo.
Para regressão do jogo solo, também há `tools/missions_physics_check.cjs` e
`tools/oval_collision_check.cjs` (dependem de `BABYLON_SOURCE`).
