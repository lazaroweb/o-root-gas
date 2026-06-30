# Changelog — Forja

Todas as mudanças notáveis deste projeto.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento [SemVer](https://semver.org/lang/pt-BR/) (MAJOR.MINOR.PATCH).

---

## Como funciona o versionamento (rollback rápido)

Cada `clasp deploy -i <STABLE_ID>` cria uma **nova versão** no projeto Apps Script
(`@N`) e atualiza o deploy estável pra apontar pra ela. **A URL do app continua a
mesma**, mas todas as versões antigas ficam preservadas no histórico.

### Voltar pra uma versão anterior (rollback)

```bash
cd forja
npm run rollback -- 73   # volta o deploy pra versão 73 (v1.4.9)
```

Ou manualmente:

```bash
npx clasp deploy -i AKfycbzlZFNAYt9r_k1nZExgQkhu8jmWnF769zr_ctKMUhldT-ZtPWMixGLcI3Icq6EgFN0k -V 73
```

Pra listar todas as versões disponíveis:

```bash
npx clasp deployments
```

A URL do app sempre será a mesma — só o conteúdo volta no tempo.

---

## [1.225.0] — 2026-06-30

### Melhorado (Registrar recebimento — amarrado ao mês)
- **Recebimento agora é por mês**: o modal tem um seletor "Este pagamento é
  referente a:" (padrão = mês vigente; pode escolher outro mês ou "Todos os
  meses"). A baixa só acontece dentro do mês escolhido — não varre mais o ano
  inteiro sem querer.
- **Conferência do que ficou em aberto**: além da prévia "Vai baixar", o modal
  mostra a lista "Continua em aberto no mês (N)" com o que NÃO foi pago, pra você
  validar o raciocínio antes de confirmar.
- Atalhos "Tudo do mês" / "Metade" e ordem (Antigas/Recentes) agora operam dentro
  do escopo do mês selecionado.

## [1.224.1] — 2026-06-30

### Corrigido
- **"Registrar recebimento" não abria nada**: o popover não montava de forma
  confiável dentro do modal do membro (conflito de portal/z-index). Trocado por um
  **modal dedicado** — abre sempre, com mais espaço pra prévia da distribuição.

## [1.224.0] — 2026-06-30

### Corrigido / Melhorado (Registrar recebimento)
- **Fix do campo sumido**: o `Tooltip` aninhado no botão "Registrar recebimento"
  bloqueava o popover (só aparecia o balão cinza). Removido — agora o popover com
  o campo de valor abre normalmente.
- **Prévia da distribuição (sem adivinhação)**: o popover mostra, ao vivo, exatamente
  quais itens serão baixados (✓ quita / parcial R$x de R$y) conforme você digita o
  valor — então dá pra conferir antes de confirmar.
- **Escolha da ordem**: "Baixar primeiro Mais antigas ou Mais recentes". Para baixa
  cirúrgica de um item específico, o chip por linha continua disponível.

## [1.223.0] — 2026-06-30

### Corrigido / Adicionado (Receitas pessoais)
- **Apagar/editar entradas avulsas**: a lista "Entradas avulsas do mês" agora tem
  botões de editar e remover por linha (antes não dava pra excluir por ali). O
  remover de uma entrada de reembolso avisa que o saldo do membro será estornado.
- **Fix**: a receita criada pelo "Registrar recebimento" usava `tipo: 'receita'`
  e não entrava no total de entradas; agora usa `tipo: 'entrada'` (padrão do
  pessoal), some no caixa e na soma de "Entradas do mês".
- Badge "reembolso" nas entradas avulsas geradas automaticamente.

## [1.222.0] — 2026-06-30

### Adicionado (Recebíveis → Caixa · automação total)
- **"Registrar recebimento" agora lança a receita automaticamente**: ao informar
  quanto o membro pagou, além de baixar o saldo, cria uma entrada em **Receitas**
  (tipo receita, categoria "Reembolso família", método pix, data de hoje) com a
  descrição "Reembolso {nome}". Um lançamento só, em vez de dois.
- **Reversível**: excluir essa receita em Receitas **estorna a alocação** nas
  cobranças (o saldo a receber do membro volta ao que era). Snapshot da
  distribuição é guardado no próprio lançamento.
- Schema `FinPessoalLancamentos` +`reembolsoMembroId` / `reembolsoMeta`
  (append-only) → `SCHEMA_VERSION` v1.93-lancamento-reembolso.

## [1.221.0] — 2026-06-30

### Adicionado (Recebíveis · Recebimento geral)
- **Botão "Registrar recebimento"** no detalhe do membro: lança de uma vez quanto
  a pessoa pagou (ex.: "Malu te pagou R$ 500") e o sistema **distribui automático**
  entre as cobranças em aberto, quitando das mais antigas pras mais novas — sem
  precisar marcar item por item. Atalhos "Tudo" e "Metade", e prévia do que
  restará em aberto.
- Convive sem conflito com o ajuste fino item-a-item (chip): ambos gravam no mesmo
  campo `valorPago`, então saldo, abas e extrato ficam sempre consistentes.
- Nova RPC `registrarRecebimentoMembro(membroId, valor, competencia?)`. Não mexe no
  fluxo de caixa (decisão de projeto) — só baixa o saldo a receber.

## [1.220.0] — 2026-06-30

### Adicionado (Recebíveis · Fase 3 — polish)
- **Indicador de saldo por mês** nas abas do detalhe do membro: cada aba (e o
  "Todos") ganha um ponto âmbar quando ainda há saldo em aberto naquele mês, com
  tooltip mostrando o valor; some quando o mês está quitado.
- **Filtro "Só em aberto"** na barra de ações do detalhe: esconde os itens já
  quitados (saldo ≈ 0) tanto na visão "Por mês" quanto na "Lista", com estado
  vazio dedicado ("Tudo quitado por aqui 🎉"). Régua e abas seguem mostrando o
  ano inteiro pra contexto.

## [1.219.0] — 2026-06-30

### Adicionado (Recebíveis · Fase 2)
- **Saldo a receber acumulado** na seção Recebíveis: painel com Total atribuído ×
  Já recebido × **Em aberto**, e por membro uma barra de progresso (recebido/
  atribuído) com o saldo — somando todas as competências (parcelas futuras e
  pagamentos parciais). Clicar no membro abre o detalhe.
- **Detalhe do membro** mostra agora **"Recebido · Em aberto"** (ou "tudo
  quitado") no lugar do antigo "Já reembolsado".
- **Extrato/PDF** ganhou colunas **Valor / Pago / Saldo** e o cabeçalho passou a
  ser **"Total a pagar"** (soma dos saldos) — a coluna "Pago" só aparece quando
  houve pagamento. Funciona no mês único e no agrupado por competência.

## [1.218.0] — 2026-06-30

### Alterado
- **Família dividida em macro-seções (igual à Empresa).** A aba única e cheia
  virou um grupo "Família" no menu lateral do Pessoal, com três áreas:
  - **Visão geral** — resumo + régua de 12 meses + cards dos membros.
  - **Recebíveis** — quanto cada um já devolveu no ano.
  - **A cobrar** — compras na fatura ainda sem dono (com estado vazio quando
    está tudo atribuído).
  Dá respiro e organiza, sem mudar nada do que cada bloco faz. Os modais de
  membro/cobrança seguem disponíveis em qualquer seção.

## [1.217.0] — 2026-06-30

### Adicionado
- **Pagamento parcial por cobrança (recebíveis do membro).** Cada lançamento do
  membro agora tem um **chip de 3 estados** — Pendente / **Parcial** / Pago —
  no lugar do antigo check binário. Clicar abre um popover pra **registrar o
  valor recebido** (botões "Tudo" e "Em aberto"); se for parcial, a linha mostra
  **"faltam R$ X"**. O status é derivado: 0 = pendente, igual ao valor = pago, no
  meio = parcial.
- Novo campo `valorPago` na cobrança (append-only, `SCHEMA_VERSION`
  `v1.92-cobranca-valorpago`) e RPC `registrarPagamentoCobranca`. O reembolso por
  mês passou a considerar pagamentos parciais (saldo = valor − recebido).
- Sem integração com fluxo de caixa (continua consultivo) — conforme combinado.

## [1.216.2] — 2026-06-30

### Alterado
- **Modal do membro centralizado e contido na janela** (78vh com teto de
  `100vh - 140px`) — não estoura mais pra baixo nem cria barra de rolagem na
  página; mantém margem superior/inferior pra harmonia.
- **Cabeçalho "12 meses" recolhido com mais destaque**: fundo e borda na cor do
  membro, ícone em badge, subtítulo "visão do ano inteiro" e CTA "Ver ano".

## [1.216.1] — 2026-06-30

### Alterado
- **Detalhe do membro com mais espaço pra lista.** A régua "12 meses" virou
  **recolhível e fica recolhida por padrão** (um cabeçalho enxuto "Nome · 12
  meses · visão do ano" com chevron) — a navegação do dia a dia fica nas abas de
  mês. Modal mais alto (86vh). Clicar num mês da régua agora recolhe a régua e
  revela os lançamentos daquele mês logo abaixo.

## [1.216.0] — 2026-06-30

### Alterado
- **Detalhe do membro: topo fixo + abas de mês.** O cabeçalho (custo total/este
  mês/futuro, filtro de cartão, régua "12 meses" e as ações Atribuir/PDF) agora
  fica **fixo** e só a lista de lançamentos rola — igual ao modal da fatura.
- **Novas abas de mês** (Todos · Jun/26 · Jul/26 · Ago/26 …) acima da lista, na
  visão "Por mês": clicar mostra só aquele mês abaixo. Clicar num mês da régua
  também seleciona a aba. Default abre no mês atual quando ele tem itens.

## [1.215.0] — 2026-06-30

### Adicionado
- **PDF de cobrança do membro agora dá pra escolher o mês.** O botão "PDF" virou
  um menu: "Todos os meses (separado por mês)" gera o relatório completo, mas
  agora **agrupado por competência** com subtotal por mês + total geral; abaixo,
  cada mês com cobranças aparece como opção individual ("Junho de 2026 · R$ …")
  pra exportar só aquele mês. O nome do arquivo inclui a competência quando for
  mês único.

## [1.214.0] — 2026-06-30

### Alterado
- **Avatar de membro humano agora mostra a INICIAL do nome** (P = Patricia,
  L = Lazaro, M = Malu) em vez do bonequinho genérico — diferencia melhor quem é
  quem na lista da fatura. Pets (dog/cat/paw) mantêm o mascote. Vale pros chips
  pequenos de atribuição em toda a fatura.

## [1.213.2] — 2026-06-30

### Corrigido
- **Ações da fatura agora ficam fixas de verdade**: os botões "Atribuir a membro"
  e "Remover importados" (e a barra de atribuição em lote) estavam rolando junto
  com a lista — então sumiam e você perdia a ação de contexto. Agora a rolagem
  acontece **só na área das listas de lançamentos**; resumo, abas e ações ficam
  travados no topo.

## [1.213.1] — 2026-06-30

### Alterado
- **Modal da fatura: topo travado, rola só a lista**: o resumo da fatura (números,
  barra de limite, pagar) e a barra de abas agora ficam **fixos**; a rolagem
  acontece **apenas no conteúdo das abas** (a lista de lançamentos). Saiu a
  rolagem geral do corpo — fica mais premium e o contexto do topo nunca some.

## [1.213.0] — 2026-06-30

### Alterado
- **Fatura do cartão agora abre num modal CENTRAL premium** (antes era um drawer
  que deslizava da lateral): centralizado vertical e horizontalmente, mais largo
  (`min(880px, 94vw)`) pra respirar e aproveitar o espaço, com rolagem interna no
  corpo (`maxHeight: 74vh`) — assim as margens superior/inferior e laterais ficam
  harmônicas em qualquer tela. Cantos arredondados (22px) e sombra suave pra um
  acabamento minimalista e premium.

## [1.212.0] — 2026-06-30

### Performance
- **"Meu mês" abre em ~2 chamadas em vez de ~13** (corta os 10-15s no
  navegador): o Apps Script trata cada `google.script.run` como uma **execução
  separada** — recarrega o bundle, reabre a planilha e roda o init a cada uma.
  Abrir o Financeiro Pessoal disparava ~13 dessas. Agora há **2 endpoints
  agregadores** no servidor:
  - `getFinPessoalEssencial(mes)` — resumo, lançamentos, cartões, categorias **e
    a visão "Meu mês" pronta**, numa execução só (libera a tela).
  - `getFinPessoalSecundario(mes)` — orçamentos, recorrências, assinaturas,
    plano de contas, membros e atribuições, em segundo plano.
- **Handle da planilha memoizado**: `getSpreadsheet()` agora reaproveita o mesmo
  handle dentro da execução. Antes, **cada leitura de aba** refazia
  `getProperty` + `SpreadsheetApp.openById` (~100-300ms cada), multiplicando o
  custo por leitura.
- **"Meu mês" não faz mais chamada própria de `getMesExecutivo` ao abrir**: a
  visão já chega no bootstrap essencial; só busca sob demanda ao navegar pra um
  mês ainda não carregado.

## [1.211.0] — 2026-06-30

### Performance
- **"Meu mês" abre muito mais rápido (especialmente no tablet)**: a carga do
  Financeiro Pessoal foi quebrada em **2 ondas**. Antes, abrir disparava **12
  chamadas concorrentes** ao Apps Script (que enfileira) + a chamada própria do
  "Meu mês" (`getMesExecutivo`) — tudo competindo. Agora a **onda 1** traz só o
  essencial (resumo, lançamentos, cartões, categorias) e libera a tela; a
  **onda 2** (pendentes, orçamentos, recorrências, assinaturas, plano, membros e
  atribuições) carrega em segundo plano, sem travar a primeira pintura nem
  competir com o `getMesExecutivo`.
- **Toggle de "pago" instantâneo no "Meu mês"**: marcar/desmarcar uma fatura ou
  lançamento como pago agora atualiza a tela **na hora** (otimista) e reconcilia
  com o servidor em segundo plano — sem o recarregamento pesado bloqueando o
  toque.

## [1.210.0] — 2026-06-29

### Corrigido
- **Avatares dos membros agora têm cores distintas**: um bug antigo no
  `salvarMembro` recalculava a cor por índice de contagem a cada **edição**,
  colando a **mesma cor** em todos os membros editados (por isso Lazaro e Malu
  apareciam ambos verdes). Agora a cor é **preservada** na edição e, quando
  ausente, escolhe-se a primeira cor **livre** da paleta — mantendo cada membro
  com uma cor única.

### Adicionado
- **Seletor de cor no editor de membro**: a modal de novo/editar membro ganhou
  uma fileira de swatches (mesma paleta do backend) com preview do ícone, pra
  você escolher e diferenciar visualmente cada pessoa.
- **Migração v1.210.0 + RPC `redistribuirCoresMembros`**: redistribui cores
  distintas pros membros existentes que ficaram em colisão, mantendo quem já tem
  cor única. Roda automática no init e pode ser re-disparada manualmente.

## [1.209.12] — 2026-06-29

### Alterado
- **Verde = "já teve ação" no selo de assinatura**: o selo de "já é assinatura"
  (`BadgeCheck`) passou de lilás para **verde sálvia**, criando um padrão mental
  consistente com a atribuição a membro (também verde): verde sinaliza que aquela
  linha já foi associada a algum critério. O "+" (marcar assinatura) segue lilás
  como ação ainda disponível. Some a confusão de tudo ser lilás.

## [1.209.11] — 2026-06-29

### Alterado
- **Ícones de assinatura mais premium e harmônicos na fatura**: removida a caixa
  (retângulo tracejado) em volta do "+", que destoava dos demais ícones de ação.
  Agora usa o par combinado lucide `BadgePlus` (marcar como assinatura) e
  `BadgeCheck` (já é assinatura), ambos no mesmo peso visual de editar/excluir, com o
  lilás dando o destaque — limpo, coeso e com identidade.

## [1.209.10] — 2026-06-29

### Alterado
- **Botão "+" claro para marcar assinatura em qualquer linha**: o affordance era um
  ícone de loop (↻) — confundia com "recorrência" e, nas linhas não detectadas,
  ficava num cinza quase invisível. Agora é um **"+" lilás com borda tracejada**,
  visível em **todas** as linhas da fatura, deixando óbvio que dá pra marcar
  qualquer compra como assinatura. Distinto do selo sólido `BadgeCheck` (já
  adicionado).

## [1.209.9] — 2026-06-29

### Alterado
- **Promover qualquer compra a assinatura**: antes o botão "+ Assinatura" só
  aparecia quando a descrição batia com a heurística de palavras-chave — então itens
  como "Amazon Kindle Unltd" ficavam sem ação. Agora a ação está disponível em
  **qualquer linha** da fatura: as detectadas automaticamente seguem com o destaque
  lilás, e as demais ganham o mesmo botão num tom discreto (tooltip "Marcar como
  assinatura"). Você nunca mais fica sem como promover uma assinatura.

## [1.209.8] — 2026-06-29

### Alterado
- **Selo aparece na hora ao promover (update otimista)**: antes, ao adicionar uma
  compra às Assinaturas, o `onSaved` disparava o `recarregar` completo (~12 chamadas
  ao GAS) só pra o selo acender — daí a demora. Agora a assinatura criada é inserida
  no estado local imediatamente (o selo e a aba Assinaturas derivam daí), e só o
  resumo de assinaturas é reconciliado em background. Resposta instantânea.

## [1.209.7] — 2026-06-29

### Alterado
- **Ícone do selo "já é assinatura" na fatura**: trocado de `Repeat` (igual ao botão
  de ação "+ Assinatura", o que confundia) para `BadgeCheck` — um selo de
  confirmação distinto, deixando claro num relance que a compra já virou
  assinatura-espelho.

## [1.209.6] — 2026-06-29

### Corrigido
- **Selo da fatura não acendia + espelhos duplicados**: depois que a lista voltou a
  carregar (v1.209.5), o selo ainda não aparecia porque o `origemLancamentoId` salvo
  ficava obsoleto quando a fatura era reimportada (os lançamentos são recriados com
  ids novos). Agora o selo casa por **assinatura estável** (valor + nome
  normalizado) além do id — sobrevive à reimportação e acende nas linhas existentes
  sem precisar re-adicionar. A de-duplicação de espelhos passou a usar a mesma
  assinatura estável, colapsando duplicatas que escapavam da chave por id (re-roda
  via migração `MIGRATION_V209_ESPELHO_DEDUP_SIG`, `SCHEMA_VERSION` → `v1.90`).

## [1.209.5] — 2026-06-29

### Corrigido
- **RAIZ: lista de Assinaturas sumia inteira (e o selo da fatura junto)**: o
  `getAssinaturas` devolvia as linhas cruas do Sheets. A assinatura-espelho é salva
  com `dataInicio` = a data do lançamento, que o Sheets converte em `Date` real; ao
  ler de volta, um único `Date` cru na resposta faz o `google.script.run` retornar
  `null` **silenciosamente** — a lista inteira somia (mostrava "0 assinaturas"
  mesmo com o resumo apontando "1 ativa") e, como o selo da fatura deriva dessa
  lista, ele também não aparecia. Agora `getAssinaturas` passa cada linha por
  `_sanitizarLinha` (datas viram `YYYY-MM-DD`), tornando a resposta serializável —
  mesmo padrão já usado nos demais endpoints. Esse era o motivo real de tudo.

## [1.209.4] — 2026-06-29

### Corrigido
- **Selo da fatura sumido + assinatura-espelho duplicada / sem flag**: as linhas
  gravadas na janela do schema "no meio" ficaram com as colunas deslocadas após a
  re-migração append-only (`criadoEm` segurando o `'sim'`/`'nao'`, `atualizadoEm`
  segurando o id do lançamento). Resultado: viravam "assinatura normal" (contavam
  2x e não exibiam o selo na fatura). Adicionada migração idempotente
  `_migrarAssinaturasEspelhoShift` que detecta o shift (coluna de timestamp com
  valor literal `sim`/`nao`), devolve cada valor pra coluna certa e de-duplica
  espelhos que apontem pro mesmo lançamento. Também exposta a RPC manual
  `repararAssinaturasEspelho`. `SCHEMA_VERSION` → `v1.89-espelho-shift-repair`.

## [1.209.3] — 2026-06-29

### Corrigido
- **Assinaturas-espelho não apareciam (nem o selo na fatura)**: as colunas novas
  `espelho`/`origemLancamentoId` tinham sido inseridas **no meio** do schema de
  `FinPessoalAssinaturas` (antes de `criadoEm`/`atualizadoEm`) e o `SCHEMA_VERSION`
  não foi incrementado. Isso quebrava a regra append-only do schema: deslocava as
  colunas de timestamp das linhas existentes e deixava os campos novos inconsistentes
  entre os caminhos de leitura/escrita. Movidas para o fim (append-only) e
  `SCHEMA_VERSION` bumpado (`v1.88-assinatura-espelho`) — todo cliente re-migra o
  header de forma limpa no próximo acesso, restaurando os timestamps e fazendo as
  promoções persistirem corretamente.

## [1.209.2] — 2026-06-29

### Adicionado
- **Indicador visual de "já em Assinaturas" na linha da fatura**: depois de promover
  uma compra a assinatura-espelho, a linha passa a mostrar um ícone ativo (selo
  lilás com o símbolo de repetição) no lugar do botão "+ Assinatura" — igual aos
  avatares quando o lançamento é atribuído a um membro. Some o risco de promover a
  mesma compra duas vezes; pra gerenciar, a aba Assinaturas.

## [1.209.1] — 2026-06-29

### Corrigido
- **Skeleton de carregamento em todas as abas do Financeiro Pessoal**: na primeira
  carga (antes dos dados do mês chegarem), abas como Cartões, Lançamentos, Receitas,
  A pagar, Orçamentos, Recorrências, Plano, Categorias e Assinaturas mostravam
  "sem dados"/zeradas, parecendo quebradas. Agora exibem esqueleto shimmer (cards
  de resumo + conteúdo) + "Carregando…". Refreshes (troca de mês, ações) não piscam
  o esqueleto. As abas que buscam dados próprios (Norte, Painel 12 meses, IR,
  Família) já tinham seu próprio estado de carregamento.

## [1.209.0] — 2026-06-29

### Adicionado
- **Atribuir vários lançamentos da fatura de uma vez**: o modo "Atribuir a membro"
  agora mostra checkbox em cada linha (faltava ligar). Marque vários itens "do
  Lazaro", atribua; troque o membro, marque o resto, atribua. Vale na janela atual
  e em "Todos os lançamentos".
- **Promover uma compra da fatura a Assinatura**: compras que "cheiram" a serviço
  recorrente (Netflix, Prime, Spotify, Disney, ChatGPT, iCloud…) ganham um botão
  "+ Assinatura" que abre um modal já preenchido (nome, valor, ciclo, dia,
  categoria, cartão). Você só confirma.
- **Espelho consultivo (anti-dupla-contagem)**: a assinatura promovida nasce como
  "espelho" — aparece na aba Assinaturas com o selo **"na fatura"** pra gestão/visão
  recorrente, mas **NÃO soma de novo** em nenhum total (a fatura do cartão já
  contabiliza). Excluída do total mensal/anual de Assinaturas, das despesas fixas
  do Norte e das próximas cobranças.

### Detalhes técnicos
- `FinPessoalAssinaturas` ganhou colunas `espelho` e `origemLancamentoId`.
- `getResumoAssinaturas` separa contáveis × espelhos (novos campos `qtdEspelho`,
  `totalEspelhoMensal`); inteligência/Norte ignora espelhos nas despesas fixas.
- Editar uma assinatura-espelho preserva o vínculo (não vira contável por engano).

## [1.208.0] — 2026-06-29

### Adicionado
- **Filtro de cartão no detalhe do familiar (adaptativo)**: quando o membro tem
  mais de um cartão/origem, aparece uma linha de chips (Todos · Nubank · Itaú · Pix…)
  que filtra **a régua de 12 meses e a lista ao mesmo tempo** — dá pra isolar
  "o que a pessoa tem no Nubank no ano". Com um cartão só, nada muda (sem ruído).
- **Agrupamento por cartão dentro de cada mês (com subtotal)**: na visão "Por mês",
  quando há vários cartões, os itens do mês vêm agrupados por cartão com subtotal,
  pra leitura rápida. Some quando você filtra por um cartão específico ou quando
  só existe um.

### Detalhes
- Tudo client-side sobre as cobranças já carregadas — sem chamada extra ao servidor.

### Corrigido
- **Aba Família não parece mais "quebrada" ao abrir**: no primeiro carregamento,
  antes do resumo chegar do servidor, a tela mostrava R$ 0,00 e "nenhum membro"
  (com a ilustração de vazio), dando falsa sensação de erro. Agora exibe um
  esqueleto shimmer (hero, régua de 12 meses e cards) + "Carregando família…"
  enquanto busca os dados. Refreshes posteriores não piscam o esqueleto.

## [1.207.0] — 2026-06-29

### Mudado
- **Régua de 12 meses virou ano-calendário fechado (Jan→Dez)**: em vez de "12 meses
  a partir de hoje", agora mostra o ano inteiro como padrão fixo. Meses já passados
  sem lançamento ficam discretos/em branco; o mês atual segue destacado. Vale pros
  dois lugares (panorama da família e linha do tempo de cada membro).
- **Navegação de ano (◀ 2026 ▶)**: setas pra avançar/voltar o ano e enxergar
  parcelas que caem no ano seguinte sem perder o padrão visual. Total do topo
  passou a ser "Total em {ano}".

## [1.206.0] — 2026-06-29

### Mudado
- **Detalhe do familiar virou um modal central premium (antes era gaveta lateral)**:
  900px+ no meio da tela, com cabeçalho (avatar, nome, relação), tiles de resumo
  (custo total · este mês · futuro), ações (Atribuir manual + PDF) e a visão
  "Por mês"/"Lista" — tudo num espaço que respira.
- **Linha do tempo dos 12 meses agora também é por familiar**: dentro do modal de
  cada membro tem a régua dos próximos 12 meses só com o que é dele — sem o
  acumulado da família. Cada parcela cai no mês da fatura, e clicar num mês rola
  até o grupo daquele mês na lista. A régua geral da família continua na tela
  principal como panorama macro.

### Detalhes técnicos
- `Resumo12Meses` generalizado (props `titulo`/`descricao`) pra ser reusado tanto
  no panorama da família quanto na linha do tempo individual de cada membro.

## [1.205.1] — 2026-06-29

### Corrigido
- **Erros antigos de TypeScript zerados** (type-check limpo): token inexistente
  `t.bg` → `t.appBg` (DividaTecnicaPanel) e `t.borderStrong` → `t.border`
  (PipelineComercial); chamada órfã `setFonteDefault` → `setSegmento`
  (ImportarLoteModal); tipagem dos ícones lucide via `LucideIcon`
  (IntegracoesFiscaisPanel); indexação implícita `any` no Códex (server.ts).
- **Atalhos/deep-links**: verificado — nenhum atalho de teclado ou deep-link
  apontava pra antiga "Visão geral" (os atalhos param em "Financeiro" via G+F),
  então não havia o que mover. O destino padrão do Financeiro Pessoal segue "Meu mês".

## [1.205.0] — 2026-06-29

### Mudado
- **"Por categoria" do Meu mês virou clicável (drill-down)**: clicar numa categoria
  abre o detalhamento com TODAS as compras daquela categoria no mês — em todos os
  cartões e avulsos — com cartão de origem, data, status, recategorizar inline
  (que vira regra e se repete em itens iguais) e atalho pra editar. Categoria
  "Outros" ganha o botão de reclassificar com IA. Era o melhor recurso da antiga
  Visão geral, agora no lugar onde você de fato olha o mês.

### Removido
- **Seção "Visão geral"**: redundante com o "Meu mês". Removida do menu e do código
  (componentes `VisaoMensal`, `DonutGastos` e `MiniBarraOrcamento`). Tudo que ela
  oferecia de útil foi incorporado ao "Meu mês".

## [1.204.0] — 2026-06-29

### Adicionado
- **Mini-relatório "Reembolsos recebidos" na Família**: novo painel consultivo que
  soma quanto cada membro JÁ te devolveu no ano (itens marcados como reembolsados),
  com seletor de ano e uma tira de 12 meses por membro (sparkline com tooltip mês a
  mês). Calculado no cliente a partir das cobranças já carregadas — fica em
  sincronia automática com o toggle de reembolso, sem chamada extra ao servidor.

## [1.203.0] — 2026-06-29

### Mudado
- **Donut "Custo por membro" (Família) no estilo premium da Visão geral**: trocado
  o anel grosso (conic-gradient) pelo donut SVG de anel fino, com fatia que
  destaca no hover e centro que reflete o membro apontado (nome, valor e %). Valor
  central enxuto — não fica gigante com um único membro.

### Adicionado
- **Reorganização automática de parcelas após importar fatura**: ao importar uma
  fatura, o sistema já reorganiza as cobranças de família (corrige competência,
  propaga parcelas futuras já atribuídas e limpa duplicatas) sem precisar do botão
  manual. O resultado da importação informa quantas cobranças foram reorganizadas.
  O botão manual continua disponível como reforço.

## [1.202.0] — 2026-06-29

### Adicionado
- **Botão "Reorganizar parcelas" (Família)**: na régua de 12 meses, um único clique
  sana as atribuições antigas — remove cobranças órfãs/duplicadas (aquelas que
  apareciam "no cartão" sem nome/parcela/data), corrige a competência de cada
  parcela pro **mês da fatura** e **propaga as parcelas futuras** pro mesmo membro
  (mantendo a proporção do rateio). Idempotente: pode rodar quantas vezes quiser.
  Backend `reorganizarCobrancasParcelas`.

### Corrigido
- **Duplicatas no detalhe do membro**: compras parceladas apareciam duas vezes
  (uma completa com cartão/parcela, outra "no cartão" sem detalhe) por causa de
  cobranças órfãs de atribuições antigas. A reorganização limpa isso.
- **Nome do cartão ausente**: itens sem cartão resolvido deixaram de mostrar o
  confuso "no cartão"; agora mostram o método (Pix, etc.) quando aplicável.
- **Parcelas presas em junho**: atribuições antigas ficavam todas no mês atual e
  não espalhavam pela régua de 12 meses nem pela visão "Por mês". A reorganização
  distribui pelas competências corretas, refletindo decréscimo das parcelas que
  terminam e acréscimo das novas.

### Mudado
- **Visão "Por mês" do membro mais premium**: cada mês virou um bloco com barra
  de destaque lateral, total e contagem de itens, deixando a leitura por
  competência mais clara.

## [1.201.0] — 2026-06-28

### Mudado
- **Família virou consultiva (custo, não contas-a-receber)**: a aba deixou de ser
  um "contas-a-receber" com baixa e passou a mostrar o **custo da família** —
  quanto do seu cartão é de cada membro, por mês. Antes o "a receber" não zerava
  ao pagar a fatura (status da cobrança era separado), o que confundia.
  - Hero: "Custo da família · <mês>" + "Total atribuído".
  - Donut: "Custo por membro" com toggle Este mês × Total.
  - Card do membro: custo este mês + total atribuído (sem pendente/baixa).
  - Régua de 12 meses: soma o custo total por mês (não só o pendente).
  - Gaveta: "Custo total / Este mês / Futuro · parcelas".
- **Reembolso ficou opcional e discreto**: o marcar "pago" no item virou só um
  registro de "já me reembolsou" (não afeta os totais de custo), com tooltip e
  tag sutil. Relatórios/PDF mantidos.

### Técnico
- `getResumoFamilia` passou a devolver `custoMes`/`custoTotal` por membro e
  `totalCustoMes`/`totalCustoTotal`. `getProvisaoMembro` agora soma custo
  (`totalCusto`, `custoEsteMes`, `custoFuturo`) com `totalPago` à parte.

## [1.200.1] — 2026-06-28

### Corrigido
- **Régua de 12 meses zerada / mês sem valor**: a competência das cobranças às
  vezes era convertida pelo Sheets em data (`2026-06-01`), quebrando as
  comparações exatas por mês (régua e visão "Por mês" zeravam, mesmo com valor a
  receber no topo). Normalizada pra `YYYY-MM` em todas as leituras
  (`getCobrancas`, `getCobrancasMembroDetalhado`, `getResumoFamilia`).
- **Régua cortando o último mês**: trocada a rolagem horizontal por um grid que
  quebra linha — os 12 meses ficam sempre visíveis.

## [1.200.0] — 2026-06-28

### Adicionado
- **Família · régua dos próximos 12 meses**: novo painel que sumariza o total a
  receber mês a mês (a partir do mês corrente), preenchendo cada mês com o que
  existir — compras parceladas já caem na competência da sua fatura. Cada mês é
  clicável pra focá-lo na tela (além do navegador global no topo). Barra de
  proporção, marcador "este mês" e total previsto do período.

## [1.199.0] — 2026-06-28

### Adicionado
- **Cartões × Família · atribuição inteligente de parcelas**: ao atribuir uma
  compra parcelada a um membro, a associação agora se propaga para as próximas
  parcelas (a atual + todas as futuras ainda não pagas), cada uma na competência
  da SUA fatura. Mantém a proporção do rateio. Toggle "Aplicar nas próximas
  parcelas" no modal (ligado por padrão); a atribuição da fatura em lote também
  propaga. Reatribuir/trocar de membro propaga a mudança para as futuras.
- **Provisionamento do membro por mês**: a gaveta do membro ganhou a visão
  "Por mês" — o que ele deve organizado por competência (este mês × futuro ×
  atraso), com badge de parcela (3/12) e total de longo prazo. Novos recortes no
  topo: "A receber em aberto", "Este mês" e "Futuro · parcelas". Toggle Por mês ×
  Lista. Novo RPC `getProvisaoMembro`.

### Técnico
- `FinPessoalCobrancas` ganhou a coluna `parcelaGrupoId` (append-only) pra
  vincular a cobrança ao grupo da compra parcelada.
- `atribuirLancamentoMembros` e `atribuirLancamentosLote` agora aceitam
  `propagarParcelas` e derivam a competência por fatura (via
  `_competenciaLancamento`) em vez do mês ativo da tela.

## [1.198.1] — 2026-06-28

### Corrigido
- **Recorrências · "Invalid Date" nos lançamentos**: clones gerados pelo bug antigo
  de data (que gravava `NaN-NaN-NaN`) ficavam "perdidos" (não entravam em nenhum mês)
  e apareciam como `último: Invalid Date`. `gerarRecorrenciasPendentes` agora faz uma
  limpeza automática (one-time, idempotente): apaga clones com data inválida e os
  recria com a data correta na própria geração. Roda sozinho ao abrir o app.
- **Texto mais claro**: "X clone(s) gerado(s)" virou "X já lançado(s)" e a exibição
  da última data é blindada contra valores inválidos (nunca mostra "Invalid Date").

## [1.198.0] — 2026-06-28

- **Entradas também podem ser recorrentes no "Novo lançamento"** — antes o seletor de Recorrência (mensal/semanal/anual) só aparecia pra despesa; agora aparece também quando o tipo é **Entrada**. Dá pra cadastrar salário e outras receitas recorrentes direto pelo "Novo lançamento", com duração opcional (até uma data / por N vezes). Ao salvar uma entrada recorrente, o sistema já gera os lançamentos pendentes e ela passa a projetar nos próximos meses — e segue gerenciável (pausar/concluir/reabrir) na aba Recorrências.

## [1.197.2] — 2026-06-28

- **Fix: recorrências não apareciam nos meses futuros** — a projeção lia a data da origem com `String(data)`, e como o Sheets grava `data` como `Date`, virava `"Sun Jun 28 2026 ..."`; aí o "mês da origem" saía `"Sun Jun"` e a comparação de mês descartava TODA projeção futura (salário, contas fixas, etc. sumiam dos próximos meses). Agora normaliza a data (`_valorJsonSafe` → `YYYY-MM-DD`) em `_recorrenciasProjetadasDoMes` e em `gerarRecorrenciasPendentes` (isso também conserta os clones com data errada / "Invalid Date").
- Os **cards do topo** (`getResumoFinPessoal`) passaram a projetar recorrências em meses futuros também, então Entradas/Gasto/Saldo/A pagar refletem o previsto — alinhados com o "Meu mês" e o "Painel 12 meses".

## [1.197.1] — 2026-06-28

- **Fix: "Sem resposta do servidor" ao reabrir/concluir recorrência** — `alternarRecorrencia` e `marcarLancamentoStatus` devolviam a linha crua, que tem o campo `data` como `Date`; o `google.script.run` devolve `null` silencioso quando o retorno contém `Date`, virando o erro "Sem resposta do servidor". Agora os dois sanitizam o retorno (`_sanitizarLinha`). Também corrige o "Invalid Date" no "último gerado" das recorrências (normaliza a data do clone).

## [1.197.0] — 2026-06-28

- **Financeiro Pessoal mais limpo (menos redundância)** — no "Meu mês" o topo deixou de repetir o que a própria tela já mostra:
  - **Cards de resumo escondidos no "Meu mês"** (Gasto/Entradas/Saldo/A pagar/Pago/Assinaturas) — a tela já traz Sobra · Entradas · Saídas · Pago/A pagar. Nas outras abas (Lançamentos, Cartões, etc.) os cards continuam como resumo do mês.
  - **Seletor de mês do topo some no "Meu mês"** — a tela já tem o próprio navegador de mês, então acaba o seletor duplicado.
  - **"Importar fatura" e "Lançar fatura" mudaram pra aba Cartões** — fatura é coisa de cartão; saíram do topo e agora ficam no cabeçalho de Cartões, junto de "Novo cartão".
  - **"Novo lançamento"** continua como a única ação primária do topo (criar é a ação mais comum; a aba Lançamentos segue pra ver/gerenciar a lista).

## [1.196.0] — 2026-06-28

- **Recorrências: "Concluir" sem perder histórico + recuperação do que sumiu** — o botão antigo "Cancelar" era destrutivo: zerava a periodicidade (`recorrencia` → `unica`) e a recorrência **sumia da lista** (foi o que aconteceu com o salário, apesar do texto prometer "histórico fica"). Agora:
  - Nova ação **Concluir**: encerra a recorrência (para de gerar e de projetar nos próximos meses) **mantendo-a na seção como "concluída"**, e dá pra **Reabrir** quando quiser.
  - **Pausar/Retomar** continua pra pausa temporária.
  - **Recuperação automática**: qualquer recorrência que tinha sido "cancelada" no modelo antigo volta a aparecer na lista como **concluída** (detectada pelos clones já gerados que apontam pra ela). Basta **Reabrir** pra o salário voltar a entrar e a projetar nos meses à frente.
  - Status fica explícito (ativa / pausada / concluída), ordenado com as ativas no topo e as concluídas no rodapé.
- Backend: `alternarRecorrencia` nunca mais apaga a periodicidade; ganhou `concluir` (e `cancelar` virou alias não-destrutivo). `getRecorrenciasAtivas` passou a incluir ex-recorrências (com clones) e a devolver `statusRecorrencia`. Geração e projeção de meses futuros seguem só com as **ativas**.

## [1.195.0] — 2026-06-28

- **"Meu mês" — navegar meses à frente ali mesmo** — agora a própria tela tem um navegador de mês no topo (← mês →, com atalho "hoje") e uma legenda de contexto ("mês atual", "mês que vem · previsto", "daqui a N meses · previsto", "mês passado"). Dá pra olhar os próximos meses com os lançamentos previstos (parcelas, recorrências, salário) sem subir até o cabeçalho global — e ver se ainda cabe no orçamento e quanto sobra.
- **Toggle de pago mais claro** — o controle ao lado de cada item agora deixa óbvio que é editável nos dois sentidos: ao passar o mouse sobre algo marcado como **Pago/Recebido/Paga**, ele vira **"marcar não pago"** (ícone de desfazer, em vermelho); sobre algo pendente, prévia em verde de marcar como pago. Tooltip também atualizada.

## [1.194.1] — 2026-06-27

- **Fix: "Meu mês" travava ao abrir** (`color is not defined`) — no componente `HeroNum` usei o shorthand `{{ color }}` referenciando uma variável inexistente; a prop correta é `cor`. Corrigido para `{{ color: cor }}`. Sem mudança de comportamento.

## [1.194.0] — 2026-06-27

- **"Meu mês" ganha Fixas × Variáveis e Investido** — inspirado na planilha que o Lázaro ama: o topo agora mostra uma barra de split **Fixas × Variáveis** (quanto do mês é compromisso recorrente vs gasto livre) e a lista de Despesas se agrupa em **Fixas** (contas/assinaturas recorrentes) e **Variáveis** (cartões + avulsos), com subtotal por grupo — os rótulos só aparecem quando há os dois tipos, pra meses simples seguirem como lista limpa. Quando há despesas na categoria **Investimento**, surge um selo **"investido"** no topo (dinheiro guardado, não gasto). Tudo opcional e sem ruído.
- Backend: `getMesExecutivo` passou a devolver `totais.fixas`, `totais.variaveis`, `totais.investido` e a marcar cada despesa avulsa com `fixo` (recorrente) — reaproveitando a mesma composição do mês, sem migração.

## [1.193.0] — 2026-06-27

- **"Meu mês" — visão executiva do Financeiro Pessoal** — nova tela inicial do Financeiro → Pessoal: tudo que entra e sai num só lugar, enxuto e de alto nível. Receitas individuais, cada **cartão como UMA linha** (nome + total da fatura) e despesas avulsas (pix/débito/dinheiro) individuais — com um **toggle de pago** ao lado de cada item (e da fatura inteira do cartão). Faixa de topo com **Entradas · Saídas · Sobra do mês** + barra "pago de X". Widgets compactos **Por categoria** e **Como você pagou** (método), além de **Cabe no orçamento?** (limite × gasto por categoria). Clicar num cartão abre direto a fatura daquele cartão.
- **Seletor de mês pra frente com previstos** — navegando pros próximos meses, a visão mostra os lançamentos **previstos** (parcelas futuras do cartão, despesas e receitas recorrentes, salário) pra você ver se ainda cabe no orçamento e quanto sobraria. Itens previstos aparecem marcados e não podem ser pagos.
- Novo RPC `getMesExecutivo(mes)` (agregador único que reaproveita a composição do mês já existente e projeta o futuro) + `marcarLancamentoStatus`/`marcarLancamentosStatus` (toggle de pago ↔ pendente, individual e em lote). O "Painel 12 meses" segue intacto.

## [1.192.0] — 2026-06-26

- **Histórico de auditorias Forja IA dentro de cada sistema** — nova aba "Auditorias" no detalhe do sistema com a linha do tempo de todas as rodadas que você já rodou: sparkline da evolução do score (delta desde a primeira), lista de rodadas (data, score, nº de achados, resolvidos, modelo, commit, duração) e badge com o total de auditorias. Clicar numa rodada reabre o drill-down completo daquela auditoria — estado geral, resumo de severidades, achados (problema/evidência/solução/prompt via `FindingCard`) e o que foi resolvido. "Nova auditoria" abre o drawer de auditoria. A aba recarrega sozinha quando uma nova auditoria roda.
- Novo RPC `getAuditoriaPorId` para abrir o payload de qualquer rodada passada (antes só a última tinha payload acessível). Nada de migração — lê o que já estava salvo na aba `Auditorias`.

## [1.191.2] — 2026-06-26

- **Atelier ganha ícone de joia (Gem) com vida própria** — o ícone do Atelier na sidebar virou uma pedra lapidada com brilho que respira e um glint que cintila de tempos em tempos (luz batendo na joia). Tratamento distinto do "Ao vivo"; respeita `prefers-reduced-motion`.

## [1.191.1] — 2026-06-26

- **Ícone "Ao vivo" ganha vida na sidebar** — um arco de luz (na cor do próprio ícone) gira sutilmente ao redor do ícone de "Ao vivo", como um sinal pulsando. Só nesse item, premium e discreto; respeita `prefers-reduced-motion`.

## [1.191.0] — 2026-06-26

- **"Operações" vira "Ao vivo" + cockpit de visão geral** — a seção foi renomeada (deixou de gerir conexões, agora só observa em tempo real) e ganhou uma aba inicial "Visão geral": anel de saúde geral, tiles de Conexões/Aplicações/Repositórios/Monitor e um painel "Precisa de atenção" que agrega tudo que está fora do ar com caminho de resolução. As abas de detalhe (Conexões, Aplicações, GitHub, Monitoramento) seguem para o aprofundamento. Chave interna `operacoes` preservada (atalho G+O e deep-links intactos).

## [1.190.0] — 2026-06-26

- **Escopo por empresa ligado nas conexões (Fase 3b)** — APIs e Servidores agora filtram pela empresa ativa (Consolidado = todas) e novas conexões são carimbadas na empresa do escopo. Novo `EmpresaScopeBar` no hub (Configurações → Conexões → APIs/Infra) dá o contexto e troca de escopo na hora. O monitor global (Operações → Status) segue mostrando a saúde de todos os endpoints. Reversível — os dados já estavam preparados pela Fase 3a e o backup automático foi criado antes.

## [1.189.0] — 2026-06-26

- **Backup automático + escopo por empresa nas conexões (Fase 3a)** — preparação segura para a unificação. Nova migração idempotente que (1) faz backup das abas `Apis`/`Servidores`/`Recursos` antes de tocar (abas ocultas `_bkp_…`) e (2) adiciona a coluna `empresaId` (append-only) carimbando os registros legados na empresa padrão. Sem mudança de comportamento — leitura/escrita seguem como antes, então é reversível.
- Novo painel "Backup das conexões" em Configurações → Dados: backup manual, histórico e restauração (com snapshot `pre-restore` automático antes de sobrescrever).
- Novos RPCs: `backupConexoes`, `listarBackupsConexoes`, `restaurarBackupConexoes`.

## [1.188.1] — 2026-06-26

- **Pagamentos (PSP) no hub de Conexões (Fase 2)** — configuração de Asaas/Mercado Pago agora também vive em Configurações → Conexões → Pagamentos, via novo `PagamentosPanel`. Usa as mesmas RPCs (`cobrancaConfigGet`/`cobrancaConfigSalvar`) do modal do Financeiro, então as duas telas ficam sempre em sincronia. Sem mudança de backend — reversível.

## [1.188.0] — 2026-06-26

- **Conexões centralizadas em Configurações (Fase 1)** — APIs e Servidores agora têm cadastro único em Configurações → Conexões. Operações → Status e Atelier → Servidores viram monitor (leitura + teste/ping) com atalho "Gerenciar em Configurações". Sem migração de dados — totalmente reversível.
- Novo componente reutilizável `ApisPanel` (modos full/monitor) extraído de OpsStatus.
- `ServidoresPanel` ganha modos full/monitor.
- Deep-link de seção em Configurações (`initialSecao`) para abrir direto em APIs & Webhooks / Infraestrutura.

## [1.179.1] — 2026-06-25

### Corrigido — A aba "Guia" agora é "Visão geral" + botão do guia visível

A mudança anterior não "apareceu" porque o cabeçalho/sub-nav ainda chamavam a
primeira estação de **Guia**, e o botão flutuante estava sendo contido pelo
wrapper da estação.

- A primeira estação virou **Visão geral** (ícone de dashboard) — o painel de
  indicadores agora se apresenta como dashboard, não como "Guia".
- O **botão do guia** virou uma **pílula "Guia de início"** (com selo de passos
  faltando) renderizada via portal no `body`, garantindo que fique sempre
  visível no canto inferior direito, acima do assistente.

### Detalhes técnicos — 1.179.1

- `views/Atelier.tsx`: estação `guia` renomeada para "Visão geral"
  (`LayoutDashboard`).
- `components/AtelierGuia.tsx`: botão flutuante via `createPortal(document.body)`.

---

## [1.179.0] — 2026-06-25

### Melhorado — Atelier com mais respiro: guia vira botão flutuante

Feedback: a landing ficou empilhada e sem respiro. Ajustes:

- **Guia saiu do fluxo da página** e virou um **botão flutuante** (canto inferior
  direito, acima do assistente) que abre um **Drawer lateral** com a explicação +
  setup recomendado. Enquanto o setup não está 5/5, o botão mostra um selo com os
  passos que faltam; ao completar, vira troféu.
- A página agora respira: **header enxuto → indicadores → grade das estações**,
  com mais espaçamento (gaps e cards maiores).
- O KPI de **setup** também abre o guia ao clicar.

### Detalhes técnicos — 1.179.0

- `components/AtelierGuia.tsx`: painel inline do guia removido; novo botão fixo +
  `Drawer` (antd) reaproveitando `ChecklistRow`. Espaçamentos da grade ampliados.

---

## [1.178.0] — 2026-06-25

### Melhorado — Landing do Atelier vira painel de indicadores

A página inicial do Atelier deixou de ser só o Guia e ganhou **KPIs** no topo:

- **4 indicadores** derivados das estações: total de itens, estações ativas
  (N/8), itens no contexto da IA (padrões do Códex) e progresso do setup (com
  mini barra). O card de setup é clicável e abre/fecha o guia.
- **Guia compactado**: a explicação ("como usar") + o setup recomendado foram
  recolhidos num painel **colapsável e sempre visível** ("Guia de início").
  Abre por padrão enquanto o setup não está 5/5; ao completar, fica recolhido e
  o KPI de setup exibe o troféu.
- Cabeçalho mais enxuto (saudação por horário) pra dar espaço aos indicadores.

### Detalhes técnicos — 1.178.0

- `components/AtelierGuia.tsx`: novo componente `Kpi` (cartão de indicador),
  KPIs calculados a partir de `CARDS`/`CHECKLIST`, guia recolhível reaproveitando
  `ChecklistRow`.

---

## [1.177.0] — 2026-06-25

### Melhorado — Atelier mais vivo + Setup que colapsa ao completar

- **Setup recomendado** agora **colapsa** quando você cumpre os 5 passos: vira
  um cartão comemorativo enxuto ("Setup completo · 5/5") com troféu, em vez de
  ocupar a tela com a lista toda. Dá pra **reabrir** pra revisar os passos.
- **Bônus de vida na estação**:
  - Saudação por horário do dia ("Bom dia/Boa tarde/Boa noite") na boas-vindas.
  - Ícone de boas-vindas com leve flutuação; ao completar, vira a **brasa**
    (chama) e o cartão de conclusão ganha troféu com anel de brilho pulsante.
  - Texto de boas-vindas muda pra um tom de "tudo no ponto" quando 5/5.

### Detalhes técnicos — 1.177.0

- `components/AtelierGuia.tsx`: estado `setupAberto` (auto-colapsa quando
  `feitos === total`), componente `ChecklistRow` reutilizável, animações CSS
  (`forjaFloat`, `forjaGlowRing`, `forjaPop`).

---

## [1.176.0] — 2026-06-25

### Adicionado — Indicador global de carregamento

Quando uma seção abre e os dados ainda estão chegando do servidor, dava a
sensação de "quebrou" (tela vazia). Agora há um sinal claro de atividade.

- **Barra fininha no topo** acende sempre que há qualquer chamada ao servidor em
  andamento — vale pra **todas as seções** automaticamente, sem instrumentar
  cada tela.
- Tem um pequeno atraso (~120ms) pra não piscar em chamadas instantâneas, e
  some suavemente quando termina.

### Detalhes técnicos — 1.176.0

- `gas-client.ts`: contador de chamadas em andamento + `subscribeLoading` /
  `isLoading` (pub/sub); incrementa no início e decrementa no fim de cada RPC.
- `components/GlobalLoadingBar.tsx`: barra indeterminada (cor da marca) montada
  no topo do `App.tsx`.

---

## [1.175.4] — 2026-06-25

### Adicionado — Proteção contra documento duplicado

- Ao arrastar vários arquivos, os repetidos são **ignorados**: tanto duplicados
  dentro do próprio lote quanto arquivos que **já existem na pasta** (mesmo nome
  + mesmo tamanho). Mostra aviso com a contagem e os nomes ignorados.
- Rede de proteção também no servidor (`uploadDocumentoEmpresa` recusa um doc
  idêntico — mesma empresa, categoria, nome e tamanho), pra cobrir uploads
  concorrentes ou lista desatualizada.

---

## [1.175.3] — 2026-06-25

### Corrigido — Respiro entre nome e papel no pill de perfil

- No pill de conta (canto superior direito), o papel ("Admin") estava colado no
  nome. Adicionado um espaçamento entre os dois.

---

## [1.175.2] — 2026-06-25

### Adicionado — Upload de vários documentos de uma vez

- O modal **Adicionar documento** agora aceita **vários arquivos** (clicar ou
  arrastar em lote). Todos vão pra mesma pasta/categoria, cada um com o nome do
  próprio arquivo. Ex.: entrar em Certidões, soltar as 5 de uma vez e depois
  editar uma a uma pra ajustar nome, validade e notas.
- Mostra **progresso** ("Enviando 2 de 5…") e um resumo de sucessos/falhas.
- Com **um arquivo só**, segue o fluxo de antes (nome, validade e notas no envio).

---

## [1.175.1] — 2026-06-25

### Melhorado — Escolher pasta direto no "Adicionar documento"

- O campo **Categoria / pasta** do modal agora lista as **pastas existentes**
  num dropdown (com ícone e contagem de docs), então dá pra mandar pra qualquer
  seção sem precisar entrar nela antes. Continua aceitando digitar uma pasta nova.
- Aberto pelo botão geral, o campo vem **vazio** (convida a escolher na lista);
  aberto de dentro de uma pasta, vem **pré-selecionado** naquela pasta.

---

## [1.175.0] — 2026-06-25

### Adicionado — Documentos organizados em pastas por categoria

A estação **Documentos** deixou de ser uma lista única e virou navegação por
**pastas** (uma por categoria: Certidões, Contábil, Fiscal, Contratos…).

- **Grade de pastas**: cada pasta mostra contagem e tamanho total; clicar abre a
  lista só daquele tipo (ex.: "quero lançar só certidões" → abra a pasta
  Certidões e adicione ali). Pastas vazias aparecem esmaecidas como destino.
- **Nova pasta**: digite um nome novo no campo Categoria ao enviar — a pasta é
  criada automaticamente (no app e no Drive) com o 1º arquivo.
- **Drive espelha a estrutura**: cada arquivo vai pra uma **subpasta da categoria**
  dentro da pasta da empresa (`Forja — Documentos/<empresa>/<categoria>`), então o
  que tem volume não polui a raiz. Trocar a categoria de um doc **move** o arquivo.
- **Organizar no Drive**: botão que reorganiza de uma vez os documentos antigos
  (que estavam soltos na raiz) para as subpastas certas. Idempotente.
- Campo Categoria virou **autocomplete** (escolhe existente ou cria nova).
- O modo **Consolidado** segue como lista plana de todas as empresas.

### Detalhes técnicos — 1.175.0

- `server.ts`: `_docsFolderCategoria` / `_moverArquivoParaCategoria` (subpasta por
  categoria, cache em Script Property); `uploadDocumentoEmpresa` cria na subpasta;
  `atualizarDocumentoEmpresa` move o arquivo quando a categoria muda; nova RPC
  `reorganizarDocumentosEmpresa`.
- UI: `views/FinDocumentos.tsx` com grade de pastas, breadcrumb e autocomplete.

---

## [1.174.0] — 2026-06-25

### Adicionado — Cofre de segredos por empresa

Nova estação **Cofre** (Financeiro › Empresa) pra guardar segredos com segurança:
senha do **certificado digital**, **gov.br/e-CAC**, tokens, senhas de banco.

- **Onde fica**: o valor secreto vive só na **área protegida do app** (Script
  Properties) — nunca na planilha, nunca no Drive, nunca em log. A planilha guarda
  só metadados (nome, categoria, validade, 2 últimos caracteres pra conferência).
- **Mascarado por padrão**: mostra `••••••` + 2 últimos; revela/copia sob demanda.
- **Validade com alerta** (ex.: A1 vence em ~1 ano).
- **Escopado por empresa**, com aviso no modo Consolidado.
- O arquivo **.pfx** do certificado **não** é guardado no app — você sobe direto
  no Asaas (quem assina a NFS-e é ele) e mantém o original no seu gerenciador de
  senhas.

### Detalhes técnicos — 1.174.0

- `server.ts`: tabela `EmpresaSegredos` (SCHEMA `v1.85-cofre-segredos`, só
  metadados); valor em `PropertiesService` sob `COFRE_<id>`. RPCs `getSegredos`,
  `salvarSegredo`, `revelarSegredo` (único caminho que devolve o valor, valida a
  empresa), `excluirSegredo`.
- UI: `views/FinCofre.tsx` + item "Cofre" no `Financeiro.tsx`.

---

## [1.173.0] — 2026-06-25

### Adicionado — Duração da recorrência + projeção visível nos meses futuros

Resolve duas dúvidas do cadastro de salário/receita recorrente:

- **Tempo de recorrência**: novo campo "Repetir por quanto tempo" — **Sempre
  (até cancelar)** (padrão), **Até uma data** ou **Por um nº de vezes**. Vale tanto
  pra receita/salário quanto pra despesa recorrente. Guardado em `recorrenciaFim`;
  o motor para de gerar/projetar depois do prazo.
- **Aparece nos meses à frente**: ao abrir o detalhe de um mês futuro no Painel
  anual, salário e recorrências agora aparecem como **itens projetados** (etiqueta
  "projetado"), não só no total. Viram lançamentos reais quando o mês chega.

### Detalhes técnicos — 1.173.0

- `server.ts`: coluna `recorrenciaFim` em `FinPessoalLancamentos` (SCHEMA
  `v1.84-recorrencia-fim`); `salvarLancamentoPessoal` persiste o fim;
  `gerarRecorrenciasPendentes` e `getPainelAnual` respeitam o prazo; novo helper
  `_recorrenciasProjetadasDoMes` usado pela projeção; `getComposicaoMes` projeta
  recorrências em meses futuros (PDF segue só com dados reais).
- UI: `views/FinPessoal.tsx` — campo de duração nos modais de receita e de
  lançamento; etiqueta "projetado" no detalhe do mês; texto do alerta atualizado.
- `types.ts`: `recorrenciaFim` e `projecao` em `LancamentoPessoal`.

---

## [1.172.0] — 2026-06-25

### Adicionado — Reautorizar o Drive + Árvore do Drive por empresa

- **Reautorização do Drive sem sair do app**: ao entrar em Documentos, checamos se
  falta o consentimento do escopo novo (`auth/drive`). Se faltar, aparece um aviso
  com botão **"Autorizar Google Drive"** (abre o consentimento) e **"Já autorizei"**
  pra revalidar. Resolve o erro de upload sem precisar mexer no editor do Apps Script.
- **Árvore do Drive**: botão **"Ver árvore do Drive"** abre um modal com a estrutura
  de pastas/arquivos da empresa (ou de todas, no Consolidado). Cada item tem **abrir**,
  **baixar** e **apagar** (vai pra lixeira do Drive). Botão "Abrir pasta no Drive".

### Detalhes técnicos — 1.172.0

- `server.ts`: `getDriveAuthStatus` (usa `ScriptApp.getAuthorizationInfo`/`getAuthorizationUrl`);
  `getDriveTreeEmpresa` (varre a pasta da empresa, com limites de profundidade/itens);
  `excluirDriveItem` (só apaga itens dentro da raiz "Forja — Documentos", limpa metadados).
- UI: `views/FinDocumentos.tsx` — alerta de reautorização, modal de árvore (Ant `Tree`)
  com ações por item.

---

## [1.171.1] — 2026-06-25

### Melhorado — Contexto da empresa explícito nos Documentos

Ficou claro **de qual empresa** são os documentos (antes parecia "alto nível").

- **Barra de contexto** no topo da estação: "Documentos de ● Empresa X · troque a
  empresa no seletor do topo", com a cor/etiqueta da empresa ativa.
- O **modal de adicionar** mostra "Será anexado a ● Empresa X" antes do upload.
- Modo **Consolidado**: mostra um aviso (não dá pra saber a empresa-alvo), some o
  botão de adicionar e a tabela ganha a coluna **Empresa** pra diferenciar a origem.

### Detalhes técnicos — 1.171.1

- `server.ts`: `getDocumentosEmpresa` agora devolve `consolidado`, `empresaAtivaNome`,
  `empresaAtivaCor` e `empresaNome` por linha.
- UI: `views/FinDocumentos.tsx` — barra de contexto, banner no modal, coluna Empresa
  no consolidado.

---

## [1.171.0] — 2026-06-25

### Adicionado — Documentos da empresa (cofre no Drive)

Nova estação **Documentos** no Financeiro › Empresa pra guardar os papéis de cada
empresa: contrato social, cartão CNPJ, certificado digital, certidões, alvarás etc.

- **Upload** (arrasta ou clica) com categoria, **validade** opcional (alerta quando
  perto de vencer) e notas. Abre/baixa direto do Drive.
- Os arquivos ficam no **seu Google Drive**, na pasta "Forja — Documentos", em
  subpasta por empresa. A planilha guarda só os metadados + link do Drive.
- **Escopado por empresa**: cada CNPJ vê só os seus documentos.

> ⚠️ Requer **reautorizar o app** após o deploy (novo escopo de escrita no Drive).

### Detalhes técnicos — 1.171.0

- `server.ts`: tabela `EmpresaDocumentos` (SCHEMA `v1.83-documentos`); helpers de
  pasta no Drive por empresa; RPCs `getDocumentosEmpresa`, `uploadDocumentoEmpresa`,
  `atualizarDocumentoEmpresa`, `excluirDocumentoEmpresa`.
- `appsscript.json`: escopo `auth/drive` (escrita).
- UI: `views/FinDocumentos.tsx` + item "Documentos" no `Financeiro.tsx`.

---

## [1.170.1] — 2026-06-25

### Corrigido — Modal de empresas com scroll horizontal

O modal "Gerenciar empresas" forçava rolar pra esquerda/direita depois que a tag
"Padrão" entrou. Agora é mais largo (920px), com layout de tabela fixo, colunas
dimensionadas e truncamento por reticências — cabe tudo sem scroll lateral.

---

## [1.170.0] — 2026-06-25

### Melhorado — Descoberta do cadastro de empresas

Ficou óbvio onde criar/gerenciar empresas (antes escondido só na engrenagem):

- **Ações no dropdown do seletor**: ao abrir o seletor de empresa, o rodapé mostra
  **"Nova empresa"** e **"Gerenciar empresas"** — onde a pessoa naturalmente procura.
- **"Nova empresa" abre direto no formulário** (sem passar pela lista).
- **Atalho quando há só uma empresa**: botão tracejado **"Adicionar empresa"** ao
  lado do seletor, deixando claro que dá pra ter vários CNPJs.
- Ícone de empresa no seletor; "Consolidado" só aparece quando há 2+ empresas.

### Detalhes técnicos — 1.170.0

- `Financeiro.tsx`: `dropdownRender` no seletor com ações; estado `gerirNovo`.
- `FinEmpresas.tsx`: prop `abrirNovo` abre o formulário em branco ao montar.

---

## [1.169.0] — 2026-06-25

### Adicionado — Credenciais de cobrança/NFS-e por empresa

Cada empresa (CNPJ) passa a ter sua **própria conta de cobrança** e config fiscal:

- **PSP por empresa**: chave do Asaas/Mercado Pago, ambiente e **webhook token**
  são por empresa. Configure a empresa A e a empresa B com contas diferentes.
- **NFS-e por empresa**: descrição do serviço, código municipal, ISS etc. por CNPJ.
- **Webhook multi-conta**: o `doPost` identifica de qual empresa é o token recebido
  e resolve as credenciais certas pra dar baixa (inclusive consulta no Mercado Pago).
- **Compatibilidade**: a config global anterior vira fallback — a empresa padrão
  herda o que já estava configurado, sem quebrar a cobrança existente.

### Detalhes técnicos — 1.169.0

- `server.ts`: `_spEmpresaGet/_spEmpresaSet` (chave `<KEY>__<empresaId>` com fallback
  global) + `_pspEmpresaOverride` pro contexto de webhook; `_pspConfig` e
  `_nfseConfig` resolvidos por empresa; `cobrancaConfigSalvar`/`nfseConfigSalvar`
  gravam por empresa; `_webhookEmpresaPorToken` + `doPost` multi-conta; dedup do OFX
  escopado por empresa.

---

## [1.168.0] — 2026-06-25

### Adicionado — Meu Imposto de Renda (IRPF) na aba Pessoal

Nova estação **Imposto de Renda** no Financeiro › Pessoal pra acompanhar o IRPF:

- **Rendimentos do ano**: pró-labore, distribuição de lucros (isento), aluguel,
  autônomo e outros — com marcação automática de tributável/isento e IRRF retido.
- **Deduções**: INSS, dependentes, saúde, educação, previdência (PGBL), pensão.
- **Carnê-leão mês a mês (DARF 0190)**: incide sobre rendimentos tributáveis
  recebidos de PF/exterior (aluguel/autônomo), abatidas as deduções do mês, pela
  tabela progressiva mensal.
- **Ajuste anual da declaração**: imposto devido (tabela anual) × retido na fonte ×
  carnê-leão pago = **a pagar ou a restituir**.
- **Importar das empresas**: puxa pró-labore e lucros lançados no livro-caixa das
  empresas como rendimentos (idempotente).

### Detalhes técnicos — 1.168.0

- `server.ts`: tabelas `IRRendimentos` e `IRDeducoes` (`origemEmpresaId` referencia
  a pagadora sem entrar no escopo multi-empresa). `SCHEMA_VERSION` → `v1.82-irpf`.
  Tabelas progressivas mensal/anual + carnê-leão. RPCs `getIRResumo`,
  `getIRRendimentos`/`salvar`/`deletar`, `getIRDeducoes`/`salvar`/`deletar`,
  `irImportarProLabore`.
- UI: `views/FinIR.tsx` + item "Imposto de Renda" no `FinPessoal.tsx`.

---

## [1.167.0] — 2026-06-25

### Adicionado — Impostos por empresa + alíquota efetiva automática (RBT12)

A estação Impostos agora é por empresa e calcula a alíquota sozinha:

- **Alíquota efetiva automática** pela tabela do Simples Nacional: você define o
  **Anexo (I–V)** e o **RBT12** (receita bruta dos últimos 12 meses) da empresa, e o
  app aplica a fórmula oficial `(RBT12 × nominal − parcela a deduzir) / RBT12`.
  Sem anexo, cai pra alíquota manual.
- **Config por empresa**: regime/anexo/RBT12 ficam no cadastro; alíquota manual e
  dia de vencimento ficam por empresa.
- **Consolidado**: soma o DAS de todas as empresas (cada uma na sua alíquota);
  gerar guia/pagar exige selecionar uma empresa específica.

### Detalhes técnicos — 1.167.0

- `server.ts`: tabelas `_SIMPLES_TABELAS` (Anexos I–V) + `_aliquotaSimples`;
  `_impostosConfigEmpresa`/`impostosConfigSalvar` por empresa (Script Property
  `IMPOSTOS_CFG_<empresaId>` + campos no cadastro); `getImpostosResumo` agrega por
  empresa no Consolidado; `impostoGerarGuia` bloqueado no Consolidado.
- UI: `FinImpostos.tsx` com Anexo + RBT12, alíquota auto/manual e modo consolidado.

---

## [1.166.0] — 2026-06-25

### Adicionado — Multi-empresa (fundação): cadastre e gerencie várias empresas

O Financeiro › Empresa agora é **multi-empresa**. Você cadastra cada CNPJ e toda a
jornada financeira/contábil passa a ser escopada por empresa:

- **Cadastro de empresas** (botão de engrenagem ao lado do seletor): razão social,
  nome fantasia, CNPJ, regime, anexo do Simples, RBT12, inscrições, endereço,
  e-mail/telefone e cor. Uma empresa é a **padrão**.
- **Seletor no topo**: escolha a empresa ativa (X / Y) ou **Consolidado** (soma
  todas). Tudo — visão geral, a receber, cobranças, a pagar, projeção, despesas,
  conciliação e impostos — passa a refletir a empresa selecionada.
- **Migração automática**: na primeira execução pós-deploy, cria a empresa padrão
  ("Minha Empresa") e carimba todo o histórico existente nela, sem perder nada.

### Detalhes técnicos — 1.166.0

- `server.ts`: tabela `Empresas`; coluna `empresaId` em Receitas, Recebimentos,
  EmpresaCobrancas, Custos, FinEmpresaDespesas, Impostos, ConciliacaoTransacoes,
  NotasFiscais e PagamentosCusto. `SCHEMA_VERSION` → `v1.81-empresas`.
- Carimbo de `empresaId` centralizado em `dbCreate`/`dbBatchCreate` (empresa ativa);
  registros derivados (recebimento de webhook, pagamento de custo, despesa de
  imposto, NFS-e) herdam a empresa do registro de origem.
- Filtro por empresa ativa (`_filtraEmpresa`) em todos os reads financeiros;
  "Consolidado" desliga o filtro. RPCs `getEmpresas`, `getEmpresaAtiva`,
  `setEmpresaAtiva`, `salvarEmpresa`, `deletarEmpresa`.
- UI: `views/FinEmpresas.tsx` (cadastro) + seletor no topo de `Financeiro.tsx`.

---

## [1.165.0] — 2026-06-25

### Alterado — Empresa: estações agrupadas em Financeiro × Contabilidade

A coluna de navegação do Financeiro › Empresa agora separa as estações em duas
macro-seções (cabeçalhos na própria sidebar, via `group` do `SubNav`):

- **Financeiro** (gestão do dinheiro): Visão geral, A receber, Cobranças, A pagar,
  Projeção.
- **Contabilidade** (registros e obrigações): Despesas (livro-caixa), Conciliação,
  Impostos.

Critério: "A pagar" são custos recorrentes/contratos (planejamento → Financeiro);
"Despesas" é o livro-caixa de lançamentos efetivos (registro → Contabilidade), ao
lado de conciliação bancária e impostos. Sem mudança de comportamento — só
organização visual.

---

## [1.164.0] — 2026-06-25

### Adicionado — Impostos (DAS / Simples Nacional): provisão e acompanhamento

Nova estação **Impostos** no Financeiro da Empresa pra provisionar e acompanhar o
imposto mensal (DAS do Simples) sem sair do app:

- **Base de cálculo automática**: receita bruta **realizada** do mês (ledger de
  Recebimentos) × **alíquota efetiva** que você configura (sua faixa do Simples).
- **KPIs**: provisão do mês, **reserva recomendada** (provisões + guias em aberto),
  total a pagar (guias geradas) e pago no ano.
- **Mês a mês**: receita bruta, alíquota, imposto, vencimento e status. Botão
  **"Gerar guia"** congela o valor da competência (status A pagar) e o **"Pagar"**
  registra o pagamento e **lança a saída no livro-caixa** (categoria Impostos).
- **Configuração**: regime, alíquota efetiva (%) e dia de vencimento (mês seguinte,
  padrão dia 20).

É uma ferramenta de provisão/gestão de caixa — não substitui a contabilidade.

### Detalhes técnicos — 1.164.0

- `server.ts`: tabela `Impostos`; `SCHEMA_VERSION` → `v1.80-impostos`. RPCs
  `impostosConfigGet/Salvar`, `getImpostosResumo`, `impostoGerarGuia`,
  `impostoRegistrarPagamento` (cria `FinEmpresaDespesas` categoria Impostos),
  `impostoExcluirGuia`. Config em Script Properties (`IMPOSTOS_CFG`).
- UI: `views/FinImpostos.tsx`; nova aba `impostos` em `Financeiro.tsx`.

---

## [1.163.0] — 2026-06-24

### Adicionado — NFS-e (nota fiscal de serviço) via Asaas

Emissão de **NFS-e** direto da estação de Cobranças, amarrada ao pagamento Asaas:

- **Padrões de emissão** (botão "NFS-e"): descrição do serviço, código do serviço
  municipal, alíquota de ISS, reter ISS, observações e "emitir na hora × agendar".
- **Emitir / acompanhar / cancelar** por cobrança (ícone de nota nas linhas Asaas):
  cria a NFS-e no Asaas (com `authorize` imediato opcional), mostra status
  (agendada → autorizada), abre o **PDF** e permite **cancelar**.
- Status sincronizável a qualquer momento; histórico de notas por cobrança.

Só funciona com **Asaas** (Mercado Pago não emite NFS-e por API) e exige a
configuração fiscal da empresa feita **no painel do Asaas** (inscrição municipal,
dados da empresa) — pré-requisito do próprio provedor.

### Detalhes técnicos — 1.163.0

- `server.ts`: tabela `NotasFiscais`; `SCHEMA_VERSION` → `v1.79-nfse`. RPCs
  `nfseConfigGet/Salvar`, `nfseMunicipalServices`, `nfseEmitir`, `nfseList`,
  `nfseStatus`, `nfseCancelar` — sobre o adapter Asaas (`/v3/invoices`).
- Front: `FinCobrancas` ganhou modal de **padrões da NFS-e** e modal por cobrança
  (emitir/acompanhar/cancelar), além da ação de NFS-e nas linhas Asaas.

---

## [1.162.0] — 2026-06-24

### Adicionado — Conciliação bancária (import de extrato OFX)

Nova estação **Conciliação** no Financeiro da Empresa. Fecha o gap do "o dinheiro
de fato caiu/saiu no banco":

- **Importa extrato OFX** (formato universal de banco). Deduplica por **FITID** —
  reimportar o mesmo arquivo não duplica.
- **Sugestão automática de casamento**: créditos → cobranças em aberto; débitos →
  despesas pendentes / custos (casa por valor com tolerância + proximidade de data).
- **Conciliar dá a baixa**: crédito marca a cobrança como **paga** (entra no caixa);
  débito marca a despesa como **paga** ou registra o **pagamento do custo**.
- **Casamento manual** quando não há sugestão (escolhe cobrança/despesa/custo em
  aberto), além de **ignorar**, **desfazer** e **excluir** transações.

### Detalhes técnicos — 1.162.0

- `server.ts`: tabela `ConciliacaoTransacoes`; `SCHEMA_VERSION` → `v1.78-conciliacao`.
  Parser OFX (`_parseOFX`/`_ofxTag`) tolerante a SGML e XML; RPCs `importarOFX`,
  `conciliacaoList` (com sugestão inline), `conciliarTransacao`, `conciliacaoIgnorar`,
  `conciliacaoDesfazer`, `conciliacaoExcluir`.
- Front: nova view `FinConciliacao.tsx` (upload OFX, lista, sugestões, match manual)
  e item **Conciliação** no SubNav da Empresa.

---

## [1.161.0] — 2026-06-24

### Adicionado — Projeção de caixa (visão pra frente, mês a mês)

Nova estação **Projeção** no Financeiro da Empresa. Responde "vou ter caixa nos
próximos meses?" consolidando tudo que já existe:

- **Entradas previstas** = cobranças em aberto (por vencimento) + assinaturas
  ativas projetadas pela recorrência (sem duplicar o que já tem cobrança emitida).
- **Saídas previstas** = custos recorrentes projetados + despesas pendentes.
- **Saldo do mês e saldo acumulado** a partir de um **saldo inicial** configurável,
  com **alerta de runway** (primeiro mês em que o caixa fica negativo) e o
  **menor caixa** do período.
- Janela de **6 ou 12 meses**, gráfico do saldo acumulado e tabela mês a mês
  (entradas/saídas com detalhamento por origem no tooltip). Vencidos/atrasados
  caem no mês atual.

### Detalhes técnicos — 1.161.0

- `server.ts`: RPC `getProjecaoCaixa(meses, saldoInicial)` + helper
  `_ocorrenciasAteFim` (projeta ocorrências de itens recorrentes na janela).
- Front: nova view `FinProjecao.tsx` e item **Projeção** no SubNav da Empresa.

---

## [1.160.0] — 2026-06-24

### Adicionado — Régua de cobrança (lembretes de inadimplência)

Lembretes automáticos ao **cliente** por **e-mail** e/ou **WhatsApp**, em 3 estágios:

- **Antes do vencimento** (N dias antes — configurável), **no vencimento** e
  **em atraso** (N dias depois). Cada estágio é enviado **uma única vez** por
  cobrança (idempotência via `CobrancaEventos`).
- A mensagem já vai com **valor, vencimento, PIX copia-e-cola, linha digitável e
  link de pagamento** — o que existir na cobrança.
- **WhatsApp** reaproveita as credenciais (Meta Cloud API ou Twilio) já
  configuradas em **Automações**; o e-mail usa o endereço cadastrado do cliente.
- **Trigger diário** no horário escolhido + botão **"Rodar agora"**. Também dá pra
  disparar um lembrete avulso por linha (ícone de sino).

### Detalhes técnicos — 1.160.0

- `server.ts`: config `PSP_DUNNING`; RPCs `cobrancaLembretesConfigGet/Salvar`,
  `cobrancaLembretesRodarAgora`, `cobrancaEnviarLembrete`; núcleo
  `executarReguaCobranca` + handler de trigger `reguaCobrancaDiaria`. Helper
  `_enviarWhatsappPara` (envio por destinatário) reusando os senders Meta/Twilio.
- Só dispara pra cobranças `emitida`/`vencida`; idempotente por estágio.
- Front: `FinCobrancas` ganhou modal **"Lembretes"** (ativar, canais, dias e
  horário, "rodar agora") e ação de lembrete por linha.

---

## [1.159.0] — 2026-06-24

### Adicionado — Financeiro empresarial: fechando o ciclo (caixa A receber ↔ A pagar)

Revisão do financeiro identificou 3 buracos que quebravam o ciclo de caixa do módulo
de cobrança. Esta versão fecha os três:

- **Cobrança avulsa paga agora entra no caixa.** Antes, uma cobrança só virava
  `Recebimento` (entrando no "Recebido no mês") se estivesse vinculada a uma
  assinatura. Cobrança **avulsa** paga ficava marcada como "paga" mas invisível pro
  faturamento. Agora a baixa (webhook **ou** manual) gera um recebimento independente.
- **Baixa de "A pagar" (custos/contratos).** Novo ledger `PagamentosCusto` (espelho
  de `Recebimentos`). Em **A pagar** cada custo ganhou **"Registrar pagamento"**
  (valor + data), que grava o realizado e **rola a próxima cobrança** pro ciclo
  seguinte — simetria com o lado A receber.
- **Status "vencida" automático.** Cobranças em aberto (emitida/pendente) com
  vencimento no passado passam a **vencida** automaticamente (avaliado a cada
  listagem, sem depender de trigger).
- **Baixa manual de cobrança.** Botão **"Marcar como paga"** na estação de Cobranças
  — útil em sandbox ou quando o pagamento foi confirmado por fora do PSP.

### Detalhes técnicos — 1.159.0

- `server.ts`: nova tabela `PagamentosCusto`; `SCHEMA_VERSION` → `v1.77-pagamentos-custo`.
- Novas RPCs: `registrarPagamentoCusto`, `getPagamentosCusto`, `deletarPagamentoCusto`,
  `cobrancaMarcarPaga`. Novo helper `_marcarCobrancasVencidas` chamado em `cobrancasList`.
- `_cobrancaBaixaPorWebhook` agora cria `Recebimento` avulso quando a cobrança não
  tem `receitaId`.
- Front: `FinCustos` (modal "Registrar pagamento") e `FinCobrancas` (modal/ação
  "Marcar como paga").

---

## [1.158.0] — 2026-06-24

### Adicionado — Cobranças: suporte a Mercado Pago (além do Asaas)

A estação de Cobranças agora tem **seletor de provedor**: Asaas **ou Mercado Pago**.

- **Mercado Pago** (autenticação por Bearer token, sem mTLS → roda no GAS): PIX e
  boleto como pagamento direto (PIX com copia-e-cola + QR; boleto com linha
  digitável + PDF); a opção **"Boleto + PIX"** gera um **link de checkout** onde o
  cliente escolhe o meio. Baixa automática por webhook (`type: payment` →
  consulta `/v1/payments/{id}` → `approved`).
- **Seletor de PSP na tela de Config**, cada provedor com sua própria chave salva;
  a URL de webhook se adapta ao provedor escolhido.
- O modal de detalhe agora mostra **"Abrir página de pagamento"** quando a cobrança
  é um checkout hospedado (Mercado Pago "ambos").

### Nota sobre Nubank e C6 Bank

Não dá pra integrar **direto**: as APIs de cobrança deles seguem o padrão bancário
com **certificado mTLS**, que o `UrlFetchApp` do GAS não suporta. O caminho é
emitir/conciliar pelo Asaas ou Mercado Pago e usar Nubank/C6 como conta destino.

### Detalhes técnicos

Adapter `_psp*` agora despacha por provedor (`_asaasEmitir`/`_mpEmitir`,
`_pspCancelar`, `_pspResync`). `cobrancaEmitir` cria a linha primeiro e usa o id
como `external_reference`, então o webhook concilia por ele em qualquer provedor.
`doPost` detecta o provedor pelo formato do payload. Chaves separadas em
`PropertiesService` (`PSP_ASAAS_KEY`, `PSP_MP_KEY`).

## [1.157.0] — 2026-06-24

### Adicionado — Módulo de Cobrança (A Receber): boleto + PIX com baixa automática

Nova aba **"Cobranças"** no Financeiro da Empresa pra emitir boleto e PIX aos
clientes e dar **baixa automática** quando o pagamento é confirmado, fechando o
ciclo da assinatura existente (registra Recebimento + rola a próxima cobrança).

- **Emitir cobrança:** escolha cliente, valor, vencimento e método (boleto, PIX ou
  ambos). Pode pré-preencher a partir de uma assinatura do cliente. Após emitir,
  aparecem a **linha digitável** do boleto (e PDF) e/ou o **PIX copia-e-cola + QR**
  com botões de copiar.
- **Baixa automática por webhook:** o PSP avisa o pagamento e a baixa acontece
  sozinha — sem conferência manual.
- **Atalho na aba "A receber":** botão "Emitir cobrança" nas próximas cobranças
  (emite direto da assinatura via `cobrancaEmitirDaReceita`).
- **Config do PSP:** tela pra chave/ambiente (sandbox/produção) e a **URL de
  webhook** pronta pra colar no painel do provedor (já com token de segurança).
- **Cadastro de Pessoas** ganhou seção **Fiscal / Endereço** (CPF, CEP, logradouro,
  número, bairro) — exigida por boleto registrado.

PSP: **Asaas** (token puro, sem mTLS — única via compatível com o `UrlFetchApp` do
GAS). O código fica atrás de um adapter (`_psp*`) pra trocar de provedor depois.

Backend: novas tabelas `EmpresaCobrancas` e `CobrancaEventos` (idempotência),
extensão de `Pessoas`, `SCHEMA_VERSION` → `v1.76-cobranca-ar`; novas RPCs
`cobrancaConfigGet/Salvar`, `cobrancaEmitir`, `cobrancaEmitirDaReceita`,
`cobrancasList/Get/Cancelar/Reenviar`; novo `doPost` (webhook, mesma URL `/exec`,
auth por token de query). Segredos só em `PropertiesService`.

## [1.156.0] — 2026-06-24

### Adicionado — Segmentos: importar pack → seção própria → kit do segmento

Fecha o conceito de domínio também em Skills e Agents. Agora um pack que você
compra (contabilidade, fiscal, folha, arquitetura…) cai numa **seção própria** e
dela você gera o kit dos sonhos só com aqueles itens.

- **Import em lote** ganhou o campo **"Segmento de destino"**: ao informar (ex.:
  "Contabilidade"), TODO o pack vai pra essa seção (skills e agents), criando/
  reusando a fonte automaticamente. Vale pros dois hubs.
- **Hub de Agents agora tem seções** por segmento (colapsáveis), em paridade com o
  de Skills.
- **Botão "montar kit do segmento"** (✨) no cabeçalho de cada seção (Skills e
  Agents): a Lume cura as melhores skills **+** agents **só daquele segmento**. O
  resultado aparece em "Coleções" na estação Kits.
- Coleções agora englobam kits por domínio e por segmento.

Backend: `_poolCandidatos` e `_montarKitCore` aceitam escopo por fonte; novas RPCs
`segmentosList` e `kitMontarSegmento`; `_bulkSaveGenerico` roteia o lote pra
`<segmento>/<slug>` e registra a fonte (`_garantirFonteMeta`). Sem migração de schema.

## [1.155.0] — 2026-06-23

### Adicionado — Coleções por domínio de negócio (sob demanda pela Lume)

Além dos kits de engenharia, a estação Kits agora tem uma seção **"Coleções por
domínio"** pra verticais de produto (contabilidade, CRM, restaurante, pousada,
condomínio…):

- **Sob demanda:** clique em "Nova coleção", descreva o projeto/domínio e a Lume
  monta a coleção de skills + agents ideal — combinando fundação técnica + o que é
  específico da vertical + a melhor skill de design.
- **Exemplos prontos:** chips de domínios comuns (Contabilidade, CRM, Restaurante,
  Pousada, Condomínio) que montam a coleção num clique.
- Cada coleção pode ser vista, re-montada, exportada (com a escolha de IDE/SO) e
  removida. Reaproveita 100% do motor de kits.

Backend: `_montarKitCore` extraído de `kitMontarComLume`; novas RPCs
`dominiosSeedList` e `kitMontarDominio` (coleções salvas com `templateId`
`dominio:<slug>`, sem migração de schema).

## [1.154.1] — 2026-06-23

### Alterado — Design vira pilar prioritário nos kits

A pedido: design é o que evita "cara de app feito por IA". Os briefings da Lume
agora exigem isso explicitamente:

- **GAS Completo:** o pilar de Frontend virou "Frontend & DESIGN (prioritário)" —
  a Lume é obrigada a escolher a MELHOR skill de design/UI da base (a de mais
  estrelas, focada em craft visual), buscando interface premium, minimalista e com
  identidade própria, evitando layout template / gradiente clichê / tudo centralizado.
- **Squad GAS** e **Squad dos Sonhos:** ambos passam a incluir obrigatoriamente um
  agent especialista em DESIGN/UI/UX de alto nível.

## [1.154.0] — 2026-06-23

### Adicionado — Squads de agents + export por IDE (Cursor / Claude Code / Portável)

**"Agentes dos sonhos":** dois novos templates de kit focados em times de agents:

- **Squad GAS — Agentes dos Sonhos** (~10 agents + ~4 skills): time com papéis
  distintos (tech-lead, arquiteto, revisor, QA, segurança, frontend React/TS,
  backend/dados em Sheets+RPC), todos respeitando as restrições do Apps Script.
- **Squad dos Sonhos (Agentes)** (~12 agents + ~4 skills): time genérico que cobre
  o ciclo completo (arquitetura, review, testes, segurança, front, back, debug, docs).

A Lume é instruída a priorizar agents com papéis complementares e evitar redundância.

**Export agora pergunta o IDE além do sistema:** ao exportar um kit, um modal deixa
escolher a ferramenta — **Cursor** (`~/.cursor/`), **Claude Code** (`~/.claude/`) ou
**Portável** (`~/.agents/`, lido pelos dois) — e o sistema (macOS/Linux, Windows ou
ambos). O instalador (`install.sh` / `install.ps1`) e o README se ajustam à pasta
escolhida. O layout de skills (`skills/<slug>/SKILL.md`) e agents (`agents/<nome>.md`)
é idêntico entre os IDEs, então o conteúdo não muda — só o diretório de instalação.

## [1.153.4] — 2026-06-23

### Alterado — Kit GAS virou "kit dos sonhos" completo da stack

Antes o template GAS era estreito (~12 skills, foco só no que é específico de
Apps Script). Agora ele é o kit COMPLETO da stack:

- Renomeado para **"Google Apps Script — Completo"**, alvo subiu pra ~28 skills /
  ~10 agents.
- O briefing da Lume agora exige **cobertura balanceada de 6 pilares**: Fundação
  (planejamento, git, testes, revisão, docs), Segurança (AppSec, segredos,
  validação, OAuth), Frontend (React/TS, UI/UX), Dados & API (adaptado a Sheets +
  google.script.run), Específico de GAS (clasp, SpreadsheetApp, cotas) e
  Produtividade — pedindo pelo menos alguns itens de cada, priorizando os de mais
  estrelas, dentro das restrições do Apps Script (sem npm, ~6min, sem containers).

Os demais templates (Fundação, Segurança, Full-stack, etc.) continuam disponíveis
como peças modulares pra desenvolvimento fora do GAS.

## [1.153.3] — 2026-06-23

### Adicionado — Exportar kit pergunta o sistema antes de gerar

Antes a exportação de kit sempre gerava só `install.sh` (bash), que no Windows
não roda sem WSL/Git Bash. Agora, ao clicar em "Exportar .zip", abre um passo de
escolha do sistema:

- **macOS / Linux** → inclui `install.sh` (bash).
- **Windows** → inclui `install.ps1` (PowerShell, lógica equivalente: pergunta
  global `~/.claude/` vs projeto `./.claude/` e copia skills + agents).
- **Ambos** → leva os dois scripts no .zip (bom pra compartilhar com o time).

O `README.md` do kit passou a documentar o comando certo por sistema
(`bash install.sh` e/ou `powershell -ExecutionPolicy Bypass -File install.ps1`).

## [1.153.2] — 2026-06-23

### Adicionado — Kit template "Google Apps Script" (a stack da Forja)

Novo template de kit focado na stack GAS, pra Lume curar skills/agents que
respeitam as restrições da plataforma (não só "o banco é Sheets"):

- `KIT_TEMPLATES` ganhou `gas` (accent sage). O `objetivo` dá à Lume o contexto
  real do GAS: runtime V8 sem npm e com limite de ~6min, Sheets como banco
  (SheetDB, full-scan, cotas) + Properties/Cache, frontend via HtmlService +
  `google.script.run` (RPC, não REST), `UrlFetchApp` pra HTTP, OAuth do Google e
  deploy via clasp. Pede pra priorizar JS/TS, React, dados/API adaptados a
  Sheets/RPC e itens de Apps Script/clasp; e evitar o que depende de npm,
  containers ou bancos relacionais.

## [1.153.1] — 2026-06-23

### Alterado — Cards de Agents premium minimalista (respiro + estrutura)

Feedback: a estação de Agents estava "sem nada de premium, sem respiro". Repaginei
os cards e a grade com mais ar e hierarquia, mantendo minimalismo.

- **Card do agent** (`AgentsHubModal.tsx`): padding maior (18px), cantos 16px,
  **faixa de acento sutil no topo** (gradiente), avatar 40px com tint + borda,
  nome em destaque, **tipo como pill uppercase**, nota da Lume, preview com
  `line-height` arejado, tags discretas, e **rodapé com divisor** (id · tamanho ·
  usos · tempo) pra dar estrutura. Hover mais suave (eleva + sombra).
- **Grade** mais arejada: colunas `minmax(290px)` e `gap: 16`.
- **Cabeçalho de resultados** acima da grade ("N agents de M" + "X avaliados pela
  Lume") pra dar contexto e estrutura.

## [1.153.0] — 2026-06-23

### Alterado — Barra de ações premium + favorito vira coração (Skills + Agents)

Feedback do user: a barra de ações estava "sem graça, sem respiro, sem destaque,
muito solta — quem entra nem sabe o que pode fazer". E o **favoritar usava estrela**,
o que confundia com a nota de qualidade (uma skill favoritada parecia ter "1 estrela").

- **Favorito vira coração** — `Heart` no lugar de `Star` no card, no drawer e no
  filtro (Skills + Agents). Agora **coração = favorito** e **estrelas = nota da
  Lume**, sem ambiguidade. (No plano o próprio user já chamava o favorito de "coração".)
- **Barra de comando repaginada** (`HubToolbar.tsx` novo, compartilhado):
  - Linha 1: busca + **chips de filtro** num grupo coeso (Favoritos, Top 4★+,
    Por nota) com estado on/off claro.
  - Linha 2: um **command bar** com respiro (card + padding + sombra), ações
    **agrupadas e rotuladas**: **"Curadoria com a Lume"** em destaque (Avaliar /
    Classificar / Traduzir) e **"Biblioteca"** com os imports/exports recolhidos
    em dropdowns **"Importar ▾"** e **"Exportar ▾"** (de ~10 botões soltos pra
    grupos claros). Primário "Adicionar skill" destacado à direita.
- Removida a duplicata "Selecionar skills…" vs "Montar kit" (faziam a mesma coisa).

## [1.152.0] — 2026-06-13

### Adicionado — Skills + Agents: renomear pacotes, nota da Lume e Kits dos sonhos

Evolução das estações **Skills** e **Agents** do Atelier, agora com curadoria por
IA e kits exportáveis. Tudo construído sobre o que já existia (`SkillFontes`,
`favorita`, `skillsClassificar`, wizard de export, `forjaCallLLM`).

**1. Renomear qualquer pacote — inclusive "Avulsas / Importadas"**
- `server.ts` — `skillFonteSalvar` agora faz **upsert por chave**: quando recebe
  uma `chave` que já existe (sem `id`), atualiza em vez de duplicar. Caso especial
  de `avulsas` cria/atualiza a linha mantendo a chave literal (as skills continuam
  sem prefixo, nada muda nelas).
- `SkillsHubModal.tsx` — o lápis de editar aparece em **toda** pasta, inclusive a
  sintética "Avulsas / Importadas" (monta um `SkillFonte` sintético na hora). O
  bucket `avulsas` pode ser renomeado mas não removido.

**2. Nota global de qualidade 0-5 pela Lume (Skills + Agents)**
- Schema: novos campos `estrelas`, `estrelasMotivo`, `avaliadaEm` em `Skills` e
  `Agents` (SCHEMA_VERSION `v1.75-estrelas-kits`).
- Backend: `skillsAvaliar(opcoes)` / `agentsAvaliar(opcoes)` — a Lume dá nota de
  qualidade em **lote chunked** (~40 por chamada, devolve `restantes` pro front
  fazer o loop com barra de progresso). Escopo por `ids` | `fonte` | `categoria`
  e por padrão só `pendentes` (sem nota) — re-rodar não re-gasta tokens. Override
  manual via `skillsDefinirEstrelas` / `agentsDefinirEstrelas`. Novo `uso:
  'avaliacao'` em `SERVICOS_IA`.
- UI: estrelas no card e no drawer (tooltip com o motivo da Lume), filtro
  **"Top (4★+)"**, ordenação **"Por nota"**, e botão **"Avaliar com a Lume"** com
  progresso. Componente compartilhado `EstrelasQualidade.tsx` (Skills + Agents).

**3. Kits dos sonhos (híbrido) — nova estação "Kits"**
- Schema: tabela `Kits` (`templateId, nome, skillIds, agentIds, justificativa,
  montadoPorLume…`).
- `KIT_TEMPLATES` fixos: **Fundação Essencial**, Full-stack Web, AI Dev / Agentes,
  Dados & Analytics, Infra & DevOps, Segurança, Produtividade. Cada um com um
  objetivo que contextualiza o prompt.
- Backend `kitMontarComLume(templateId)`: monta um **catálogo compacto** só dos
  candidatos top (ordenados por estrelas → usos, teto ~120 skills + ~60 agents)
  pra caber no contexto; a Lume escolhe os melhores skills **e** agents com
  justificativa; persiste (upsert por template). `kitsList`, `kitsGetContent`,
  `kitSalvar`, `kitRemover`, `kitExportar`. Novo `uso: 'kit'`.
- UI `KitsHubPanel.tsx`: card por template (montar/re-montar com a Lume, ver
  membros skills+agents lado a lado, com a justificativa da curadoria).

**4. Exportar kit misto (skills + agents)**
- `kitExportar` + export no cliente gera um `.zip` com `skills/<slug>/SKILL.md`,
  `agents/<slug>.md`, `README.md` e um **`install.sh` interativo** que instala
  ambos no Claude Code (global `~/.claude/` ou projeto `./.claude/`). Novo
  `agentsExportar` espelhando `skillsExportar`.

---

## [1.151.3] — 2026-06-23

### Adicionado — Trava de segurança na importação em lote (anti-duplicata + qualidade)

**Contexto:** a AU que gera os JSONs está **regerando arquivos pra corrigir
erros, no mesmo diretório**. O user vai querer jogar a pasta inteira (incluindo
versões repetidas/regeradas) e precisa de garantia de que **nada duplica** e que
**só o que está completo entra**.

**Antes (v1.151.1/2):** dedup só existia por `slug` contra o banco. Faltava:
- dedup DENTRO do mesmo lote (mesmo slug em 2 arquivos selecionados juntos
  entrava 2×);
- trava de qualidade (subia qualquer markdown não-vazio, mesmo truncado);
- proteção contra downgrade (re-import quebrado sobrescrevia versão boa).

**Agora (`server.ts` — `_bulkSaveGenerico`):** import em 2 passadas.

1. **Passada de parse + qualidade + dedup intra-lote:**
   - `_pareceCompletoConteudo()`: barra itens incompletos (markdown < 120 chars,
     sem nome real, ou só frontmatter sem corpo). Reportados como "barrados".
   - `_scoreCompletudeParsed()`: pontua completude (tamanho + nome + descrição +
     nº de seções + quando_usar).
   - Dedup por `slug` num `Map`: se o mesmo slug aparece 2× no lote (ex.: o
     arquivo quebrado + o regerado), **mantém só o de maior score**. Nunca os dois.
2. **Passada de criar vs atualizar contra o banco:**
   - modo `criar`: pula slugs existentes.
   - modo `upsert` com **anti-downgrade**: se a versão importada tem score
     < 60% da versão já salva (claramente mais pobre/truncada), **mantém a salva**.
     Edições normais (score igual ou maior) atualizam sem problema.

- Novo campo no relatório: `ignorados: [{slug, msg}]` — explica CADA descarte
  ("incompleto", "duplicado no lote — mantida a mais completa", "mantida a versão
  salva", etc.). Não são erros, é a trava funcionando.

**Frontend (`ImportarLoteModal.tsx`):**

- Aviso verde fixo: "Pode jogar tudo sem medo" explicando a trava.
- Resumo final ganhou tag dourada "**N barradas pela trava (duplicada/incompleta)**".
- Detalhe por arquivo tem `<details>` expansível listando os barrados com motivo.

**Resultado:** o user pode selecionar a pasta inteira (com regerados e tudo) que
a base fica limpa: sem duplicata, só conteúdo completo, e versão boa preservada.

**Deploy:** `@341` (estável).

---

## [1.151.2] — 2026-06-23

### Corrigido — Seletor de arquivos não abria + banner "sem categoria" falso

Dois bugs reportados na tela de Skills:

**1. Botão "Escolher arquivos" não abria o seletor (`ImportarLoteModal.tsx`):**

- Causa: o `<Button>` do Ant Design renderiza um `<button>` real e estava
  dentro de um `<label>` com `<input type="file" hidden>`. Um `<button>`
  dentro de `<label>` **captura o clique pra si** e não propaga pro input —
  então nada abria.
- Fix: input agora fica fora, com `ref`, e o botão chama
  `inputRef.current?.click()` no `onClick`. Funciona dentro do iframe do GAS.

**2. Banner "11 skill(s) sem categoria" aparecia mesmo com tudo classificado (`SkillsHubModal.tsx`):**

- Causa: o banner só checava o campo `categoria` (frontmatter). Mas o backend
  (`skillsClassificar`) considera classificada toda skill com `tipoIA` (o tema
  inferido pela IA). As skills do GAS App Kit têm `tipoIA` preenchido mas não
  têm `categoria` no frontmatter → eram contadas falsamente como "sem categoria".
- Fix: o banner agora só conta como "sem categoria" quem não tem **nem
  `tipoIA` nem `categoria`** — mesmo critério do backend.

---

## [1.151.1] — 2026-06-23

### Melhorado — Multi-arquivo no Importar lote + prioridade da `category` embutida

**Contexto:** o user recebeu da outra AI **23 arquivos `.json` por categoria**
(`skills-01-ai-research.json` com 129 skills da categoria `ai-research`,
`skills-06-database.json` com 332 da `database`, etc., total ~944 skills).
Era inviável fazer 23 uploads manuais um por um — agora rola num único drop.

**Backend (`server.ts` — `skillsBulkSave` / `agentsBulkSave`):**

- **Prioridade da categoria invertida:** agora o que o item do JSON traz vence
  o `categoriaDefault` do modal. Antes era o contrário (default vencia tudo).
  - Ordem nova: `item.categoria` → `parsed.categoria` (do markdown) → `categoriaDefault` (fallback)
  - Faz sentido: como o JSON da AI já vem com `category` correto, não dá pra
    permitir que o modal sobrescreva sem querer.

**Frontend (`ImportarLoteModal.tsx` — reescrita):**

- **Input `multiple`:** seleciona N arquivos de uma vez (Ctrl/Cmd+clique).
  Botão muda pra "+ Adicionar mais" depois do primeiro select.
- **Cada arquivo vira um "Lote"** com estado próprio (`pendente` → `processando`
  → `ok`/`erro`), parseado individualmente. Erros de parse em 1 arquivo não
  bloqueiam os outros.
- **Detecção automática de categoria por arquivo:** se 100% dos itens do JSON
  têm a mesma `category`, vira o "selo verde" do card (`✓ ai-research`) e
  signaliza que o backend vai respeitar (override do modal não é enviado).
  Se o arquivo NÃO tem `category` nos itens, marca em peach "sem categoria —
  usa o default abaixo".
- **Lista visual dos arquivos selecionados:** nome + ícone (json/md/erro) +
  contagem de itens + selo de categoria + botão de remover individual.
- **Campo "Categoria padrão" passa a ser opcional/fallback** — só aparece como
  obrigatório quando algum dos arquivos não tem categoria detectada.
- **Progresso global em 2 níveis durante import:**
  - Barra: `Arquivo 3/23 · 287/944 skills` + % real.
  - Lista ao vivo: cada arquivo com seu próprio status (hourglass / spin /
    check verde / triângulo vermelho) e relatório parcial (`127 criadas`).
- **Resumo final consolidado:** "23 arquivos processados · 941 criadas ·
  2 atualizadas · 1 erro", com `<details>` clicável pra ver erros por arquivo
  (até 20 por arquivo, scrollável).
- Botão "Importar mais arquivos" no final pra continuar a guerra sem fechar.

**Como usar (caso atual — 23 .json da AI):**

1. Atelier → Skills → **"Importar lote"**
2. **Selecionar os 23 `.json`** de uma vez (Ctrl+clique ou Cmd+clique)
3. Cada arquivo vai aparecer com seu selo verde de categoria já detectada
   (`✓ ai-research`, `✓ database`, etc.) — você não digita nada
4. (Opcional) "Fonte / pasta" → `pack-vibeship-2026` pra agrupar
5. Botão fica `Importar 23 arquivos (944 skills)`. Click.
6. Acompanha arquivo por arquivo na lista ao vivo
7. Fim: resumo consolidado com tudo

**Por que isso é GG:** transformou uma operação de horas (944 uploads
manuais com risco de erro em cada categoria digitada) em **2 cliques + uma
seleção múltipla**. E o multi-file também serve pra packs futuros sem precisar
mudar nada.

**Deploy:** `@338` (deploy estável).
**Branch:** `cursor/criar-cards-financeiros-para-bancos-bras-cab2`.

---

## [1.151.0] — 2026-06-23

### Adicionado — Importar lote (JSON/MD) com categoria atribuída na hora

**Pra que serve:** o user vai trazer pacotes grandes (ex.: 129 skills duma
mesma categoria, 422 agents do pack vibeship). Era inviável fazer 129 uploads
manuais ou 129 chamadas server-side. Agora rola em 1 ação só.

**Backend (`server.ts`):**

- `dbBatchCreate(sheetName, itens[])`: novo helper que faz `setValues()` único
  pra todo o lote. Substitui N `appendRow()` (que estouravam quota do GAS) por
  uma chamada só. **~50× mais rápido** que o loop antigo.
- `skillsBulkSave` e `agentsBulkSave`: novas RPCs. Aceitam:
  - `itens`: array de `{ markdown, slug?, categoria?, tags?, fonte?, idExterno? }`
  - `opcoes.categoriaDefault`: **sobrescreve a categoria de TODOS os itens**
    (caso do user — ele baixou 129 skills da categoria X)
  - `opcoes.fonteDefault`: agrupa visualmente como uma "pasta" no Hub
  - `opcoes.modo`: `'upsert'` (atualiza se slug existe) ou `'criar'` (skip)
- Limite **200 itens por chamada** — frontend já fatia em chunks de 100.
- Resposta: `{ total, criados, atualizados, pulados, erros: [{slug, msg}] }`.

**Frontend (`ImportarLoteModal.tsx` — novo componente compartilhado):**

- Botão **"Importar lote"** novo no header de Skills E de Agents (mesma UX).
- Aceita 2 formatos:
  - **`.json` recomendado** — `[{slug, markdown, category?, tags?}]`.
    Aceita variações `conteudo`/`content`/`md` e `tags` como string ou array.
  - **`.md` único concatenado** (fallback) — tenta divisores comuns
    (`\n---\n\n# `, `\n##========\n`, ou split por `\n# `).
- Inputs no modal:
  - **Categoria deste lote** (override — texto livre, ex.: "ai-specialists")
  - **Fonte / pasta** (agrupamento visual no Hub)
  - **Se slug já existe**: upsert ou pular
- Preview após upload: "129 skills detectadas em `pack-x.json`" + aviso de
  fatiamento ("será processada em 2 lotes de até 100").
- **Progress bar real** durante import (`Processando lote 2/3…`), com %.
- Relatório final com tags coloridas: `127 criadas / 2 atualizadas / 0 erros`.
- Lista os erros (até 30) com slug + mensagem se houver.

**Como usar (caso do user — 129 skills de categoria X):**

1. Atelier → Skills → **"Importar lote"**
2. Escolher o `.json` baixado
3. Em "Categoria deste lote", digitar **`ai-specialists`** (ou o que for)
4. Em "Fonte / pasta", colocar **`pack-vibeship`** (opcional, pra agrupar)
5. Modo: **Upsert** (re-imports atualizam, não duplicam)
6. Clicar "Importar 129 skills" — vê o progresso ao vivo

**Recomendação enviada à outra AI (que pergunta o formato):**

> Use `.json` `[{slug, markdown, category?, tags?}]`. MD concatenado quebra
> com `---` do frontmatter e dificulta dedup. JSON é trivial de validar,
> dedup é O(1) por slug, e dá pra anexar metadados opcionais sem ambiguidade.

---

## [1.150.1] — 2026-06-23

### Refinado — Parser absorve o formato `vibeship-spawner-skills` (e qualquer Anthropic-style)

**Contexto:** O user mandou o `agent-evaluation.md` (formato `vibeship-spawner-
skills (Apache 2.0)`) e o render saiu confuso. Antes do bulk import de 1036
skills + 422 agents, refinamos o parser pra absorver mais variações de formato
sem perder estrutura.

**Problemas que apareceram:**

| Sintoma | Causa raiz | Fix |
|---|---|---|
| Card mostrava `agent-evaluation` (kebab) ao invés de "Avaliação de Agentes" | Frontmatter `name:` é o slug, não o nome | Se `name` é kebab-case E existe H1, H1 vira `nome` e `name` vira `slug` |
| `## Capacidades`, `## Requisitos`, `## Padrões` caíam todos em `outra` | Regras de regex não cobriam esses títulos | 4 novas chaves: `capacidades`, `requisitos`, `arestas_perigosas`, `habilidades_relacionadas`. `Padrões` mapeia pra `boas_praticas` |
| `## ⚠️ Arestas Perigosas` não casava com regex | Emoji no início do título | Strip de emojis/símbolos Unicode antes do regex |
| Tabela markdown `\| Problema \| Severidade \| Solução \|` saia como texto puro | Drawer só fazia `pre-wrap` | Render adaptativo: detecta `\|---\|---\|` e renderiza `<table>` real |
| Severidade `crítica/alta/média/baixa` sem destaque | Texto plano | `SeveridadeBadge` colorido (vermelho/peach/âmbar/sage) |
| Slugs em `\`backticks\`` viravam texto | Sem extração | Em `capacidades`/`requisitos`/`habilidades_relacionadas` viram **chips** automaticamente |
| Descrição do frontmatter muito longa estourava o card | Sem limite | Corta inteligente em 240 chars na 1ª pontuação após 80 chars |

**Parser (`server.ts`):**

- `_chaveSecao` ganha **4 chaves novas** + 2 sinônimos (`padroes` → `boas_praticas`).
- Strip de emojis Unicode no título antes do regex.
- Heurística nome/slug: detecta `name: agent-evaluation` + H1 "Avaliação..."
  e promove o H1 a nome legível.
- Recorte inteligente da `description` do frontmatter (mantém 1ª frase
  completa se houver pontuação após 80 chars; senão `…`).
- Frontmatter `source:` (vibeship usa) vai pra tags automaticamente.
- `habilidades_relacionadas` extrai slugs em \`backticks\` e mergeia em
  `relacionadas` (mesmo extrator de `integracoes` dos agents).

**UI (`SkillsHubModal.tsx`):**

- `META_BLOCO` ganha entradas pras 4 chaves novas (cor/ícone/sub coerentes).
- Novo componente `BlocoConteudoRender` (render adaptativo):
  - Detecta tabela markdown → `<table>` com header/body/borders e
    `SeveridadeBadge` colorido na coluna de severidade quando aplicável.
  - Detecta lista de slugs em blocos `capacidades`/`requisitos`/
    `habilidades_relacionadas` → renderiza como **chips coloridos** com o
    texto livre acima (ex.: "Funciona bem com:").
  - Fallback: pre-wrap tradicional.

**Resultado prático:** o `agent-evaluation.md` que você baixou agora deve
renderizar:
- Card com nome **"Avaliação de Agentes"** (não mais `agent-evaluation`)
- Bloco **Capacidades** como chips azuis (`agent-testing`, `benchmark-design`…)
- Bloco **Requisitos** como chips peach (`testing-fundamentals`, `llm-fundamentals`)
- Bloco **Padrões** como card sage (boas práticas) com os 3 sub-items
- Bloco **Anti-Padrões** como card peach com os 3 ❌
- Bloco **⚠️ Arestas Perigosas** como **TABELA real** com `crítica`/`alta`/`média`
  em badges coloridos
- Bloco **Habilidades Relacionadas** como chips lavender clicáveis
- A lista geral `aberta.relacionadas` mergeada com `multi-agent-orchestration`,
  `agent-communication`, `autonomous-agents`

---

## [1.150.0] — 2026-06-23

### Adicionado — Parser do "Pack PT-BR" para Agents (8 blocos específicos)

**Contexto:** O user mandou a **estrutura padrão de Agent** do pack. É mais rica
que a Skill — tem 8 blocos exclusivos:

| Bloco | O que captura |
|---|---|
| `## METADADOS` | `slug`, `categoria`, **`tipo: agente-autonomo`** (NOVO) |
| `## QUANDO USAR ESTE AGENTE` | Gatilho + exemplo `<example>` |
| `## IDENTIDADE E EXPERTISE` | Persona + foco + ênfase |
| `## PROTOCOLO DE INICIALIZAÇÃO` | Passos numerados quando invocado |
| `## DOMÍNIOS DE CONHECIMENTO` | Áreas (### Área) com sub-skills |
| `## CHECKLIST DE QUALIDADE` | Métricas com threshold |
| `## WORKFLOW DE EXECUÇÃO` | Fases (### Fase N — Nome) |
| `## PROTOCOLO DE COMUNICAÇÃO` | JSON entre agentes |
| `## INTEGRAÇÃO COM OUTROS AGENTES` | Grafo de colaboração |
| `## DIRETRIZ FINAL` | 1 frase resumo (a "alma" do agent) |

**Schema (`v1.74-agents-rich`):**

- Tabela `Agents` ganha **3 colunas first-class**:
  - `tipo` — pra filtros rápidos (autônomo, orquestrador, etc.)
  - `diretrizFinal` — vira preview do card automaticamente
  - `dominios` — CSV das áreas (pra busca/agrupamento futuro)
- Reaproveita `relacionadas` pra grafo de "Integra com" (dedup com METADADOS).

**Parser estendido:**

- `_chaveSecao` agora reconhece 6 chaves novas:
  `protocolo_inicializacao`, `dominios`, `workflow`, `protocolo_comunicacao`,
  `integracoes`, `diretriz_final`. Compatível com inglês também.
- `_parseMetadadosBloco` captura `- tipo: agente-autonomo` (e variantes
  `type`, `agent_type`, `kind`).
- 3 helpers novos:
  - `_extrairDominios` → pega títulos `### Área X` de DOMÍNIOS.
  - `_extrairIntegracoes` → captura slugs em `[colchetes]` e \`backticks\` do
    bloco INTEGRAÇÕES. Faz dedup, limite 16.
  - `_extrairDiretrizFinal` → tira aspas/markdown e pega a 1ª frase (máx 280
    chars). Fallback pra 1ª linha.

**UI Agents — Drawer rico:**

- Banner "ESPERANDO ESTRUTURA" removido. Só mostra dica quando a base está
  vazia (e diz exatamente quais 8 blocos o parser reconhece).
- **Diretriz Final em epígrafe** no topo (border-left peach, itálico) — destaca
  a missão central do agent.
- Header ganha badge **`tipo`** (peach + Bot icon) destacando o `agente-autonomo`.
- Chips de **Domínios** no header (lavender).
- Cada bloco vira um card com ícone + cor coerente:
  - WORKFLOW → renderiza fases como **stepper visual numerado** (círculos com
    o número da fase, igual o Linear faz com checkboxes).
  - PROTOCOLO_COMUNICAÇÃO → extrai bloco \`\`\`json\`\`\` e mostra com
    `JSON.stringify(parse, null, 2)` indentado (formatação consistente).
  - DOMÍNIOS → grid de cards aninhados (1 por área, com sub-skills).
  - INTEGRAÇÕES → chips com os slugs extraídos + texto original abaixo.
- Toggle "Estruturado / Markdown raw" preservado.

**UI Agents — Card:**

- Preview prioriza **Diretriz Final** (em itálico pra sinalizar) → fallback pra
  QUANDO USAR → descrição.
- Mostra **`tipo`** como badge sutil abaixo da descrição.
- Mantém badges de #idExterno + usos + modelo no rodapé.

**Próximo passo:** o user vai trazer os 422 agents do pack (provavelmente
como zip/pasta). Vou desenhar o fluxo de **bulk import** otimizado pra essa
escala — paralelizar uploads em batch, dedup por slug, mostrar progresso.

---

## [1.149.0] — 2026-06-23

### Adicionado — Skills/Agents estruturados (parser PT-BR + Atelier ganha estação Agents)

**Contexto:** O user comprou um pack gigante com **1036 skills + 422 agents**
no formato "Pack PT-BR" (sem frontmatter YAML, mas com seções rígidas:
`## METADADOS`, `## QUANDO USAR ESTA SKILL`, `## IDENTIDADE E PAPEL`, etc.).
Precisamos receber tudo sem perder a riqueza do formato.

**Schema (`v1.73-skills-rich-agents`):**

- Tabela `Skills` ganha **7 colunas** novas:
  `slug`, `idExterno` (#0237), `usos` (contador), `relacionadas` (CSV de slugs),
  `quandoUsar`, `identidadePapel`, `secoesJson` (todos os blocos parseados).
- **Nova tabela `Agents`** (irmã de Skills) com os mesmos campos ricos + 3
  específicos: `modelo`, `ferramentas`, `metaJson` (campo livre pra estrutura
  que vai vir no próximo prompt do user).

**Parser estendido (`_parseSkillMd`):**

Detecta **3 formatos** automaticamente:

1. Claude/Cursor SKILL.md (frontmatter YAML + headings em inglês).
2. Pack PT-BR (sem frontmatter, com `## METADADOS`, etc.).
3. `.md` comum (H1 + 1º parágrafo).

Extrai todas as seções H2 como `blocos` estruturados (com `titulo`, `chave`
canônica e `conteudo`), e mapeia os títulos famosos (`QUANDO USAR`, `IDENTIDADE`,
`PRÉ-EXECUÇÃO`, `PRINCÍPIOS`, `REGRAS`, `BOAS PRÁTICAS`, `FRAMEWORK`, `CHECKLIST`,
`EXEMPLOS`, `ANTIPADRÕES`) pra chaves canônicas — habilita ícone + cor coerente
no render. Bloco `## METADADOS` é parseado linha a linha (`- id:`, `- slug:`,
`- usos:`, `- ultima_atualizacao:`, `- skills_relacionadas: [a, b, c]`).

**UI Skills — Drawer rico:**

- Cada bloco estruturado vira um **card visual** com ícone + cor de destaque
  (lavender pra princípios, peach pra QUANDO USAR, sage pra checklist, etc.).
- Header do drawer ganha badge **`#0237`** (id externo do pack) e contador de
  **usos** com sparkles.
- Seção "Skills relacionadas" com chips dos slugs.
- Toggle **"Estruturado / Markdown raw"** pra ver a fonte se precisar.
- Fallback automático pro layout antigo quando não há blocos detectados.

**UI Skills — Card:**

- Preview agora prioriza **QUANDO USAR** (mais informativo que descrição
  genérica).
- Mostra **`#0237`** + **contador de usos** (com Sparkles) no rodapé.

**Contador de usos:**

- Nova RPC `skillsRegistrarUso(id)` incrementa o contador no backend.
- Disparado automaticamente quando o user **copia** ou **baixa** a skill no
  drawer — sinal forte de "essa skill é útil de verdade".
- Backend retorna `usos` em `skillsList` e `skillsGetContent`.

**Atelier ganha estação "Agents" (esqueleto):**

- Nova entrada **"Agents"** no menu lateral (entre Skills e Snippets), com
  badge `novo`, ícone `Bot`, cor azul.
- `AgentsHubModal`: componente paralelo ao SkillsHubModal, com mesmas
  capacidades (listar, buscar, favoritar, importar, drawer com blocos).
- Banner "ESPERANDO ESTRUTURA" explicando que o user pode mandar o prompt
  com a estrutura específica dos agents pra detalharmos campos como `modelo`,
  `ferramentas`, system prompt, etc.
- RPCs: `agentsList`, `agentsGetContent`, `agentsSave`, `agentsDelete`,
  `agentsToggleFavorita`, `agentsRegistrarUso`.

**Compatibilidade:**

- Skills antigas (sem o formato Pack PT-BR) continuam funcionando — o drawer
  cai no fallback "índice + ComoUsar + markdown raw" quando não há blocos.
- A próxima vez que uma skill antiga for **salva**, o parser repopula os
  campos ricos automaticamente (re-parse no `skillsSave`).

---

## [1.148.13] — 2026-06-23

### Adicionado — ⭐ Favoritar skills (botão estrela no Hub)

**Por quê?** O Hub de Skills cresceu — com gas-app-kit + skills avulsas, o user
fica com dezenas de skills e perde tempo achando as que mais usa no dia-a-dia.

**O que mudou (UX):**

- **Estrela clicável no canto superior direito de cada card** (no SkillsHub).
  Toggle silencioso (sem alert, sem confirmação). Cor: âmbar (`accents.peach`).
- **Cards favoritos ganham destaque sutil**: borda âmbar (`peach 55`), fundo
  levemente colorido (`peach 06`) e o ícone do livro também na cor âmbar. Não
  rouba a cena — só guia o olho.
- **Favoritas sobem pro topo** automaticamente. Ordenação: favoritas primeiro
  (mais recente favoritada no topo), depois resto por `atualizadoEm`.
- **Novo botão "Favoritas (N)"** na barra de filtros (só aparece quando tem ao
  menos 1 favorita). Toggle: clica → mostra só favoritas; clica de novo → volta.
  Quando ativo, fica destacado em âmbar.
- **Estrela também no Drawer de detalhe da skill** (header, ao lado de Copiar
  e Baixar). Toggla sem precisar fechar o drawer.

**Por baixo do capô:**

- Schema bumpado pra `v1.72-skill-favorita`: tabela `Skills` ganhou colunas
  `favorita` (boolean string) e `favoritadaEm` (ISO timestamp).
- Nova RPC `skillsToggleFavorita(id)` — idempotente, faz toggle e devolve
  `{ favorita, favoritadaEm }`.
- `skillsList` e `skillsGetContent` agora retornam `favorita` + `favoritadaEm`.
- UI faz **optimistic update**: marca como favorita na hora, reverte só se o
  backend responder erro. Sem flicker.

**Como usar:**

1. Abra **Atelier → Skills**.
2. Passe o mouse sobre qualquer card → clique na **estrela** no canto superior
   direito. Vira amarelo preenchido = favoritada.
3. Suba a página: as favoritas já estão no topo.
4. Quer filtrar? Clique no botão **"⭐ Favoritas (N)"** ao lado da busca.

---

## [1.148.12] — 2026-06-23

### Corrigido — Parser ignora marcador dentro de string literal + linhas com múltiplos marcadores

**Bug meta detectado**
O user testou o workflow `Copiar prompt → cola no Cursor` e descobriu que o
prompt apontava pra um TODO **dentro de uma string literal** (a mensagem
de UI "Nenhuma dívida detectada — marque com `// TODO:`, `// FIXME:` ou
`// DEBT(area,sev): ...` pra acompanhar aqui").

Esse débito não existe — o `// TODO:` mora dentro de aspas, é texto exibido
pro usuário, não código real. O regex da v1.148.8 (com word boundary) ainda
não tinha como saber a diferença.

### 3 fixes em camadas (defense-in-depth)

**Fix #1 — Parser ignora linhas com múltiplos marcadores diferentes**

Nova função `_temMultiplosMarcadores(linha)`. Se a linha cita 2+ marcadores
DIFERENTES (TODO + FIXME, ou TODO + DEBT etc), é quase certo doc/exemplo
explicando o protocolo, não débito real. Skip.

```ts
// "Marque com // TODO:, // FIXME: ou // DEBT(...)"  → SKIP (3 marcadores)
// "// TODO: implementar X"                          → MATCH (1 marcador)
```

**Fix #2 — Parser ignora marcador dentro de string literal**

Nova função `_estaDentroDeString(linha, pos)`. Conta aspas (`'`, `"`, `` ` ``)
não-escapadas antes da posição do match. Se a "aspa corrente" não é null
naquele ponto, o marcador está dentro de uma string.

```ts
const msg = 'marque com // TODO: ...';  // SKIP — // está dentro de aspas
// TODO: implementar de verdade        // MATCH — // está em código real
```

Não é parser completo de JS/TS (não trata template literals com `${}`
aninhados, comentários antes do match, etc), mas pega 99% dos casos reais.

**Fix #3 — Texto defensivo no DividaTecnicaPanel**

A mensagem de UI "Nenhuma dívida detectada — marque com // TODO:..."
foi reescrita usando `<code>` JSX com strings concatenadas (`{'/'}{'/ '}TODO:`):

```tsx
// ANTES (string literal contendo // TODO: — disparava o scanner):
'Nenhuma dívida detectada. Marque com `// TODO:`, `// FIXME:` ou ...'

// AGORA (JSX com code tags, fragmentos separados):
<>Nenhuma dívida detectada. Marque com <code>{'/'}{'/ '}TODO:</code>, ...</>
```

Mesmo se a heurística falhar (parser pega algum caso edge), esse texto
específico nunca mais vai disparar — porque os caracteres `//` agora estão
em fragmentos JS separados (`{'/'}{'/ '}`), não numa string contígua.

### Por que 3 fixes em camadas?

Princípio de robustez: cada camada protege a outra.

| Camada | O que pega |
|--------|-----------|
| **Texto defensivo (UI)** | Esse caso específico, garantia 100% |
| **Heurística "dentro de string"** | Qualquer outro caso similar em qualquer arquivo |
| **Heurística "múltiplos marcadores"** | Docs que explicam o protocolo |

Mesmo se o user (ou um agente de IA) escrever no futuro algo como:

```ts
const exemplo = "// FIXME: documente isto";
```

A heurística #2 vai pular. E se for legítimo (raro), volta pra carregar
no scan — basta ajustar.

### Limpeza automática
Esse débito específico vai virar `pago` no próximo sync (o `// TODO:`
literal sumiu do arquivo). Aba "Dívida" → segmento "Pagos" → banner
"1 fantasma detectado" → **Limpar 1** (ou ignora, fica como histórico).

### Bonus: prova viva do workflow
O user usou pela primeira vez o **"Copiar prompt pra IA"** da v1.148.11 e
o bug saltou na cara — exatamente o cenário que justifica ter o preview.
Sem o prompt formatado, esse falso positivo passaria batido.

### Impacto
Scanner de dívida técnica agora é à prova de:
- Comentários em código real (caso canônico — ✅ funciona)
- Strings literais com marcadores (UI text — ✅ pula)
- Doc com múltiplos marcadores em exemplos (SKILL.md, README — ✅ pula)
- Palavras em português que começam com TODO/FIXME (v1.148.8 — ✅ pula)
- Arquivos do próprio protocolo (CHANGELOG, AGENTS.md — v1.148.8 — ✅ pula)

A cobertura ficou madura. Falso positivo é exceção rara agora, não regra.

---

## [1.148.11] — 2026-06-23

### Adicionado — Débito vira PROMPT pronto pra agente de IA (Cursor, Claude Code, Codex, Windsurf)

**Pergunta do usuário**
> "O que ele leva pro backlog, qual minha ação lá dentro, eu copio é um prompt?
> Eu levo isso pra AI que está desenvolvendo o app?"

**Resposta: SIM — e agora vem formatado.**

Antes o corpo do card no backlog era apenas "Origem: dívida técnica detectada
no código. Arquivo: X. Descrição: Y." — informativo, mas não acionável.

Agora é um **prompt markdown completo** pronto pra colar em qualquer agente
de IA que esteja trabalhando neste projeto.

### Estrutura do prompt gerado

```markdown
# Resolva este [tipo]

**Projeto:** Forja - CRM Gestão 360
**Arquivo:** `forja/src/components/X.tsx:361`
**Área:** governanca · **Severidade:** media
**Permalink:** https://github.com/.../blob/HEAD/...#L361

## O que está marcado no código
\`\`\`
// TODO: descrição completa do débito
\`\`\`

## Tarefas
1. Abra o arquivo e leia o contexto ao redor da linha
2. Entenda o que esse TODO está pedindo
3. Implemente a solução adequada
4. **Apague o comentário marcador** da linha
5. Commit + push no branch default

## Critério de aceite
- ✅ O comentário marcador foi removido do código
- ✅ A implementação cobre o que a descrição pede
- ✅ Não introduziu regressão

## Como o débito fecha sozinho
A Forja escaneia o repositório. Quando este comentário sumir do código E o
commit estiver no branch default, o débito vira `pago` automaticamente.
Você não precisa fazer nada extra na Forja.
```

### 3 caminhos de uso (todos suportados)

| Cenário | Caminho | Resultado |
|---------|---------|-----------|
| **"Quero resolver agora"** | Drawer → "Copiar prompt" → cola no Cursor | IA resolve, faz commit, sync detecta, débito fecha sozinho |
| **"Vou rastrear pra depois"** | Drawer → "Promover pra Backlog" | Card vai pro kanban com o prompt no corpo |
| **"Quero o snippet junto"** | Drawer → "Copiar com código" | Prompt + trecho de código no entorno (pra chat direto sem filesystem) |

### Nova seção no Drawer

**"Prompt pra agente de IA"** aparece quando o débito é `ativo`:

- Banner explicando que é prompt acionável + lista de agentes compatíveis
- **Preview do prompt** com clamp de 180px e botão "ver completo" (`N linhas`)
- **2 botões de cópia**:
  - **"Copiar prompt"** (cinza) — versão limpa, pra agentes com filesystem (Cursor, Claude Code, Windsurf)
  - **"Copiar com código"** (primary) — inclui o snippet de 13 linhas no prompt, pra agentes sem filesystem (chat direto)
- **Rodapé didático** com os 3 caminhos de uso

### Backend

**Nova função utilitária**: `_gerarPromptIA(d, sistema)` no `server.ts`.
Centraliza a geração do prompt. Usado por:
1. `promoverDebitoParaBacklog` → corpo do card no kanban
2. Nova RPC `getPromptIADebito(debitoId)` → pro Drawer mostrar/copiar
   antes de promover

O prompt sempre referencia:
- **Nome do projeto** (vem da tabela Sistemas)
- **Permalink real** (`{repoUrl}/blob/HEAD/{arquivo}#L{linha}`)
- **Marcador exato** (`DEBT(area,sev)` pra estruturados, ou `TODO`/`FIXME`/`HACK`)
- **Hash do débito** (rastreabilidade)

### Por que isso muda o jogo

A Forja deixa de ser um "tracker de TODO" e vira um **dispatcher de tarefas
pra agentes de IA**. O ciclo completo agora é:

```
1. Dev marca // TODO: no código
2. Forja detecta no scan
3. Dev abre o débito na Forja → vê preview do prompt
4. Dev copia → cola no Cursor/Claude Code
5. IA resolve + commit + push
6. Forja detecta remoção → fecha o débito sozinho
```

Zero contexto perdido entre o "isso precisa ser feito" e o "isso foi feito".

### Impacto
Fecha o loop conceitual da Forja como **QG pra desenvolvimento com IA**.
O débito não é mais um item passivo numa lista — é uma tarefa empacotada
pronta pra ser delegada pra IA, com critério de aceite e ciclo de fechamento
automático.

---

## [1.148.10] — 2026-06-23

### Adicionado — "Promover pra Backlog" agora explica o que vai acontecer

**Pergunta do usuário**
> "A partir dessa visão eu promovo pra backlog, ele leva o que especificamente?
> O que acontece? Como funciona esse processo? Poderia ter uma instrução, não?"

**Problema**
O botão "Promover pra Backlog" estava lá, sem dizer nada. O user não sabia:
- Qual seria o título do card?
- Em que coluna ia parar?
- Quais campos seriam preenchidos?
- O que acontece com o débito depois?
- Como o card e o débito ficam conectados?
- E quando eu fechar o card, o débito some sozinho?

**Solução: PromocaoPreview no Drawer**

Antes dos botões de ação, agora aparece uma seção dedicada quando o débito
está ativo: **"O que acontece se você promover pra Backlog"**.

Conteúdo:

**1. Preview do card** (que será criado, com dados exatos):
- Título: `[<TIPO>] <descrição truncada em 80>` (espelha 1:1 a lógica do backend)
- Tags: coluna `A fazer`, área (se houver), gravidade, link `<arquivo>:<linha>`

**2. Fluxo numerado em 4 passos** (pílulas de código pra ressaltar transições de status):

1. **Card novo** em *Decisões → Backlog → A fazer* com descrição completa,
   arquivo+linha de origem e instrução de fechamento embutida.
2. Este débito muda de `ativo` → `promovido` e **some da lista de ativos**
   (passa a aparecer só na aba "Promovidos").
3. Os dois ficam **linkados pelo hash do débito** (mostra o hash exato).
   Próximas sincronizações respeitam isso: **não recriam o débito** enquanto
   o card existir.
4. Quando você **apagar o comentário do código + commit**, próximo sync detecta
   a remoção e marca como `pago` automaticamente. O card no backlog você fecha
   manualmente lá.

**3. Estado pós-promoção**

Quando o débito já está com status `promovido`, em vez do preview aparece:

> ✦ **Já está no Backlog**
> Este débito foi promovido pra Backlog em 23 de jun. 2026, 09:35 (há 2 min).
> O card vive lá com sua própria régua (status, gravidade, comentários).
> Quando você apagar o comentário do código E commitar, o débito vira `pago`
> automaticamente na próxima sincronização.

### Bônus: Popconfirm reforça a instrução

O botão "Promover pra Backlog" agora tem `Popconfirm` que repete o resumo
("Cria card em 'A fazer' com título [TODO] ... e move este débito pra
status 'promovido'") antes de executar. Dupla rede de segurança: instrução
visível na seção dedicada + confirmação no clique.

### Botão promovido a `type="primary" ghost`

Era um botão neutro entre os três (Promover, Marcar pago, Apagar). Agora
"Promover" é o **caminho preferencial** visualmente — destacado em ghost
primary — porque é a ação canônica pra trabalhar débitos sérios.

### Componentes novos (reusáveis)

- `<PromocaoPreview d={...} />` — pode ser reusado em qualquer contexto
  futuro onde queiramos explicar promoção (ex: ações em lote)
- `<FluxoPasso n={...} cor={...} />` — passos numerados em círculo com texto
- `pillStyle(cor, t)` — helper pra pílulas de código com cor semântica

### Impacto
Fim do "botão misterioso". O user vê exatamente o que vai acontecer,
incluindo o título do card, antes de clicar. Reduz ansiedade, aumenta
confiança no fluxo, e ensina o modelo mental da Forja (débito → card →
fechamento via commit).

---

## [1.148.9] — 2026-06-23

### Adicionado — Apagar débito definitivamente + limpeza em massa de fantasmas

**Pergunta do usuário (decorrente do fix da v1.148.8)**
> "Oxente, ele de alguma forma achou 4 pagos e deixou apenas 1, por que isso?"

**Explicação**
O sync da v1.148.8 rodou com o regex novo (com `\b`). 4 dos 5 itens não foram
detectados (eram falsos positivos de `// TODOs` em português). A rotina de
limpeza automática do `sincronizarDebitos` viu que sumiram e marcou como
`pago` — comportamento intencional pra preservar histórico de débitos
genuinamente resolvidos.

**Problema**: esses 4 não eram débito real — eram fantasmas do bug. Ficar
como `pago` polui a métrica "quantos débitos fechamos" e dá falsa sensação
de produtividade.

### O que vem nesta versão

**1. Apagar definitivamente (item único)**

- Novo botão **🗑 lixeira** no card de débito (visível quando status = `pago`
  ou `promovido`)
- Mesmo botão no Drawer de detalhes (sempre disponível)
- Popconfirm pede confirmação
- Backend: nova RPC `apagarDebito(debitoId)` usa `dbDelete('DebitoTecnico', id)`
- Segurança: bloqueia apagar `promovido` que ainda tem `backlogId` vivo (pra
  não orfanizar card no kanban)

**2. Limpar fantasmas em massa**

Heurística: **fantasma = pago que nunca foi promovido pra backlog**.
Se nunca virou card no backlog, não houve trabalho real envolvido — é
candidato a apagar.

- Novo banner contextual na aba **"Pagos"** quando há fantasmas:
  > "**4 fantasmas detectados** — 4 de 4 pagos nunca passaram por promoção
  > pra backlog. São típicos falsos positivos limpos automaticamente pelo
  > scan (regex pegou bobeira ou comentário não era débito real)."
  > **[Limpar 4]** (botão vermelho)

- Backend: nova RPC `apagarDebitosPagosSemPromocao(sistemaId)` filtra
  `status === 'pago' && !promovidoEm && !backlogId` e apaga em batch via
  `dbDeleteMany`. Preserva pagos que VIERAM de promoção real (trabalho legítimo).

**3. Tipos atualizados**

`resumo` agora calcula:
- `pagosReais`: pagos com `promovidoEm` (trabalho de verdade preservado)
- `fantasmas`: pagos sem `promovidoEm` (provavelmente lixo de regex)

Distinção fica visível no banner: "Os outros X foram trabalho de verdade e
ficam preservados."

### Diferença entre as 3 ações de remoção

| Ação | O que faz | Quando usar |
|------|-----------|-------------|
| **Marcar como pago** | Status → `pago`, mantém histórico | Você resolveu fora do scan |
| **Promover pra Backlog** | Status → `promovido`, cria card no kanban | Vai virar trabalho rastreado |
| **Apagar definitivamente** ✨ | Remove do banco, zero rastro | Falso positivo, lixo, exemplo em doc |

### Como usar pra resolver os 4 fantasmas atuais
1. Abre a aba **Dívida** → segmento **"Pagos"**
2. Aparece banner laranja: "4 fantasmas detectados"
3. Clica **"Limpar 4"** → confirma → some
4. Métricas voltam ao limpo (0 pagos, 1 ativo real)

### Impacto
Fechamento do ciclo iniciado em v1.148.8 — bug do regex corrigido +
mecanismo pra limpar o lixo que ele deixou. Próximos falsos positivos
(se algum aparecer) também têm caminho de resolução em 1 clique.

---

## [1.148.8] — 2026-06-23

### Corrigido — Falso positivo crítico: "TODOs" em português matchava como TODO

**Bug detectado em produção**
O user abriu a aba "Dívida" do sistema Forja e viu 5 débitos com descrições
sem sentido, todas começando com `s os …`:

- `s os nodes na 11.x. Aqui detectamos via prefixo do code`
- `s os lançamentos do cartão`
- `s os discoveries criados`
- `s os hooks ANTES de qualquer return condicional`

**Causa raiz**
O regex do parser era:

```
/(?:\/\/|\/\*|#|--|<!--)\s*(TODO|FIXME|HACK)\s*[:\-]?\s*(.+?)/i
```

Faltava **word boundary** (`\b`). Em código em português, comentários como
`// TODOs os nodes na 11.x` (português pra "todos os nodes") faziam match em
**TODO** e capturavam `s os nodes na 11.x` como descrição — o `s` era a
continuação da palavra "TODOs" cortada no meio.

Mesma coisa com "FIXMEd", "HACKy" — qualquer prefixo era ignorado.

**Fix**
Word boundary `\b` antes e depois dos marcadores:

```
/(?:\/\/|\/\*|#|--|<!--)\s*\b(TODO|FIXME|HACK)\b\s*[:\-]?\s*(.+?)/i
```

`\b` exige transição word↔non-word, então:
- `// TODOs` — entre `O` (word) e `s` (word) não há boundary → NÃO bate ✓
- `// TODO:` — entre `O` (word) e `:` (non-word) HÁ boundary → bate ✓
- `// TODO fazer X` — entre `O` (word) e ` ` (non-word) HÁ boundary → bate ✓

Mesma correção aplicada ao regex de `DEBT(area,sev): ...`.

### Corrigido — Falso positivo: arquivos que falam SOBRE débito como exemplo

O 1º item do scan era `', '// FIXME:' ou '// DEBT(area,sev):....' pra acompanhar`
— texto que vem de **dentro de strings literais** no próprio `forja-debt-tracking/SKILL.md`,
no `AGENTS.md`, no `CHANGELOG.md`, etc. Esses arquivos falam SOBRE débito como
exemplo/documentação, não contêm débito real.

**Fix**: nova função `_arquivoFalaSobreDebt(path)` filtra esses arquivos do
scan, em ambos GitHub e GAS:

| Padrão | Por quê |
|--------|---------|
| `*.mdc` | Cursor rules sempre explicam o padrão de débito |
| `CHANGELOG.md` | Tem `// FIXME` em exemplos de bug fixes |
| `SKILL.md` (qualquer pasta) | Skills do tipo debt-tracking ensinam o padrão |
| `AGENTS.md` (qualquer pasta) | Handoff doc que explica o protocolo |
| `agents-debt-tracking-*` | Template específico do protocolo |
| `.cursor/rules/**` | Pasta inteira do Cursor |
| `**/skills/*/readme*` | READMEs de skills |
| `**/docs/*debt*` | Docs específicas de débito |

### Adicionado — Drawer de detalhes do débito (resposta ao "não vejo detalhes")

**Pergunta do usuário**
> "Eu não vejo detalhes dos débitos técnicos, só mostra essa descrição. Como
> eu vou saber os detalhes do que precisa ser feito?"

**Antes**: o card mostrava só a descrição truncada (até 280 chars), tipo
arquivo + linha, e ações. Sem contexto. Sem código no entorno. Sem metadados.

**Agora**: clica no card (ou no ícone de olho 👁) e abre um **Drawer de 680px** com:

1. **Cabeçalho** — tipo (TODO/FIXME/HACK/Dívida), área, severidade, arquivo:linha
2. **Descrição completa** — sem truncar
3. **Código no entorno** — 6 linhas antes + linha do débito (destacada com a cor do tipo)
   + 6 linhas depois, com gutter de número de linha e fundo colorido
4. **Histórico**:
   - Detectado pela 1ª vez (com "há X dias")
   - Última verificação
   - Hash determinístico (pra dedup entre syncs)
   - Tipo + severidade + área
   - Promovido em / Pago em (quando aplicável)
5. **Ações**:
   - Abrir no GitHub (com permalink `#L<linha>`) ou no editor do Apps Script
   - Promover pra Backlog
   - Marcar como pago manualmente
   - Copiar linha do débito
6. **Dica contextual** — "Como fechar este débito: apague o comentário, commit,
   sincronizar."

**Backend novo**: RPC `getDebitoContexto(debitoId)` lê:
- **GitHub**: `GET /repos/:full/contents/:path?ref=:branch` (1 call, retorna conteúdo
  + sha do arquivo). Usa branch default detectada do repo, não `HEAD` hardcoded.
- **GAS**: lê do listing existente (1 call que já trazia tudo), faz match pelo
  nome sem extensão.

Retorna 13 linhas (6 antes + 1 do débito + 6 depois) prontas pra renderização,
com `linhaDestaqueIdx` apontando pra linha exata e `branch` (pra mostrar tag
git no drawer).

### Resultado prático
Antes da v1.148.8 a aba "Dívida" mostrava 5 itens, todos falsos positivos.
Depois da v1.148.8 + sincronização forçada: a contagem cai pra X reais (vai
depender do que sobrar quando o user rodar Sincronizar). Cada item agora dá
pra abrir e ver o código exato no entorno, com botão direto pra GitHub.

### Impacto
- **Confiança restaurada**: scan não tem mais falso positivo óbvio
- **Acionabilidade**: drawer fecha o loop "ver problema → entender contexto →
  ir resolver no editor"
- **Decisão informada**: histórico (criado/atualizado/promovido) mostra se é
  débito recente ou crônico

---

## [1.148.7] — 2026-06-23

### Adicionado — Wizard de exportação custom: escolha quais skills levar pro Claude Code

**Pergunta do usuário (continuação da v1.148.6)**
> "Outro ponto: eu consigo nessa seção customizar quais skills eu quero
> e ele gerar um install.sh somente com o que eu escolhi? Tipo um wizard.
> Seria uma boa feature, não?"

**Sim, seria — e agora tem.**

A v1.148.6 só tinha o atalho "Exportar TUDO". Agora tem o wizard custom.

### Como funciona

No header do Hub de Skills (`Atelier → Skills`) agora tem **2 botões lado a lado**:

| Botão | Quando usar |
|-------|-------------|
| **Exportar tudo (Claude Code)** | Atalho: leva todas as skills sem perguntar |
| **Selecionar skills…** | Wizard: você escolhe quais |

**Wizard (passo a passo)**

1. Clica em **"Selecionar skills…"** → entra no modo seleção
2. Aparece uma **barra sticky no topo** com:
   - Contador `X de Y skills selecionadas` (e filtro atual, se houver)
   - Botão **"Selecionar todas"** (ou "Selecionar visíveis" se você filtrou)
   - Botão **"Limpar"** (se já tem alguma marcada)
   - Botão **"Cancelar"** (sai do modo)
   - Botão **"Gerar kit (N)"** com contador embutido
3. Clica nos cards das skills pra marcar/desmarcar (ou use a busca pra filtrar antes)
4. Clica em **"Gerar kit"** → abre o modal de export
5. Escolhe destino:
   - **Cursor** → `.cursor/rules/<skill>.mdc`
   - **Claude Code** → `<skill>/SKILL.md` + **install.sh interativo** ✨
   - **Genérico** → `skills/<skill>/SKILL.md`
6. Baixa o zip → descompacta → `bash install.sh` → escolhe global/projeto → pronto

### Mudanças técnicas

**Refatoração DRY**: `baixarKitZip` agora inclui `install.sh` automaticamente
quando `target === 'claude'`. Antes só o botão "Exportar tudo" gerava o
install.sh, e o "Montar kit" + Claude Code gerava só os arquivos crus.
Agora os 2 fluxos compartilham o mesmo gerador (`gerarInstallShClaude`).

**Mudança no layout do zip Claude Code**: antes era `.claude/skills/<slug>/SKILL.md`
(forçava local-only). Agora é `<slug>/SKILL.md` no zip + install.sh decide o
destino (global ou local). Mais flexível.

**Barra do modo seleção mais útil**:
- Mostra `X de Y` (não só `X`)
- Indica quando há filtro ativo
- 2 novos botões: "Selecionar todas/visíveis" + "Cancelar"
- "Gerar kit" mostra contador e tooltip explicando destinos disponíveis

**Modal de export — destino Claude Code mais informativo**:
Antes: *"Gera .claude/skills/<skill>/SKILL.md — extrai na raiz do projeto."*
Agora: *"Gera `<skill>/SKILL.md` + **install.sh interativo**. Você roda
`bash install.sh` e ele pergunta: global (`~/.claude/skills/`, vale em todos
os projetos) ou local (`./.claude/skills/`, só este projeto, versionado)."*

### Casos de uso típicos

- **"Quero levar só as 3 skills de design pro projeto novo"**
  Wizard → filtra por "design" → "Selecionar visíveis" → "Gerar kit" → Claude Code → bash install.sh

- **"Quero compartilhar com o time só as skills de governança via Git"**
  Wizard → marca skills de governança → "Gerar kit" → Claude Code → bash install.sh → escolhe **2 (Projeto)** → commit `.claude/skills/`

- **"Quero minhas skills sempre disponíveis em qualquer projeto novo"**
  Atalho "Exportar tudo" → bash install.sh → escolhe **1 (Global)** → fim

### Impacto
Granularidade total: do "instalar 100% global" ao "instalar só 2 skills no
projeto X versionado no Git". Mesmo install.sh, mesma UX, sem código duplicado.

---

## [1.148.6] — 2026-06-23

### Adicionado — Exportar TODAS as skills em 1 clique pro Claude Code

**Pergunta do usuário**
> "Se eu quiser num projeto novo levar todas essas skills de uma única vez,
> pensando em usar o Claude Code, o que devo fazer?"

**Resposta antes desta versão**
Tinha que entrar em "Montar kit", clicar uma a uma em ~11 skills, configurar
destino "Claude Code", baixar `.zip`, descompactar, copiar manualmente cada
pasta pra `~/.claude/skills/`. Trabalhoso e frágil — 6 passos manuais.

**Resposta agora — 1 botão, 1 zip, 1 comando**

Novo botão **"Exportar tudo (Claude Code)"** no header do Hub de Skills
(`Atelier → Skills`), ao lado de "Importar GAS App Kit".

Ao clicar:
1. Pega TODAS as skills do hub (não precisa selecionar uma a uma)
2. Gera `forja-skills-claude-code-YYYY-MM-DD.zip` contendo:
   - `<slug>/SKILL.md` — uma pasta por skill, formato nativo Claude Code
   - `install.sh` — script bash interativo
   - `README.md` — instruções pro usuário leigo

**O `install.sh` é interativo** — pergunta onde instalar:

| Opção | Destino | Quando usar |
|-------|---------|-------------|
| **1) Global** | `~/.claude/skills/` | Vale em TODOS seus projetos sem copiar de novo |
| **2) Projeto** | `./.claude/skills/` no diretório atual | Só este projeto, vai versionado no Git, time inteiro adota |

**Workflow do usuário (de 6 passos pra 3)**

```bash
# 1. Baixa o zip pelo botão na Forja
# 2. Descompacta + roda install
unzip forja-skills-claude-code-2026-06-23.zip -d skills-temp
cd skills-temp && bash install.sh
# 3. Reabre Claude Code — todas as skills disponíveis
```

**Detalhes técnicos**
- `SkillsHubModal.tsx`: nova função `exportarTodasParaClaudeCode` reusa o RPC
  existente `skillsExportar` (que já busca conteúdo bruto de N skills em
  paralelo). Gera o zip client-side com `criarZipBlob` + `baixarBlob`.
- O `install.sh` usa apenas POSIX bash (sem dependências). Tem heredoc, `read`
  interativo, `rm -rf + cp -r` pra sobrescrever skills existentes
  (re-exportações futuras atualizam in-place).
- Slugs duplicados são auto-resolvidos com sufixo numérico
  (`debt-tracking-2`, `debt-tracking-3` etc).
- Honra o padrão **"toda operação > 600ms mostra feedback"** (v1.148.4):
  botão tem `loading={exportandoTodas}` durante a geração do zip.

**Como propagar pra outros agentes (não só Claude Code)**

O destino padrão deste botão é Claude Code porque foi o que o user pediu.
Pra outros destinos, o fluxo "Montar kit" existente já cobre:

| Destino | Formato | Como gerar |
|---------|---------|------------|
| **Claude Code** | `.claude/skills/<slug>/SKILL.md` | ← este botão novo (1 clique) |
| **Cursor rules** | `.cursor/rules/<slug>.mdc` | Montar kit → destino "Cursor" |
| **Anthropic genérico** | `skills/<slug>/SKILL.md` | Montar kit → destino "Genérico" |
| **AGENTS.md universal** | Single file concatenado | Hoje só via export por skill (`ComoUsarSkill`) — backlog: gerar `AGENTS.md` consolidado em 1 clique |

### Impacto
Zero friction pra adotar a biblioteca de skills da Forja em qualquer projeto
novo. Antes: 6 passos manuais por projeto, fácil de errar. Agora: baixar, rodar,
pronto.

---

## [1.148.5] — 2026-06-23

### Corrigido — Skill `forja-debt-tracking` sem categoria + banner contextual no Hub

**O bug que o usuário pegou**

Criei a skill `forja-debt-tracking` na v1.148.0 só com `name` + `description` no frontmatter (padrão Anthropic, minimalista). A Forja tem campos de `categoria` + `tags` que viraram vazios no banco depois do "Importar GAS App Kit", deixando a skill solta sem classificação. O usuário pegou na visualização da lista e perguntou "porque não classificou?"

**Fix imediato**: frontmatter completo na skill

```yaml
---
name: forja-debt-tracking
description: ...
category: code-quality
tags: [debt, todo, fixme, hack, code-review, ai-instructions, forja, governance]
---
```

Próximo "Importar GAS App Kit" atualiza a skill no banco in-place (a importação é idempotente por `fonte`).

**Fix sistêmico**: banner contextual no Skills Hub

`SkillsHubModal.tsx` agora detecta skills sem categoria e mostra um banner laranja-brasa contextual entre o header e a lista:

> ⚡ **N skill(s) sem categoria** — A IA lê nome + descrição de cada uma e agrupa em temas (Design, Frontend, Code Quality…). Roda só nas faltantes, em ~10 segundos.
> [Classificar agora]

Antes, o usuário precisava descobrir o botão "Classificar por tema" sozinho no header (escondido entre 6 outras ações). Agora, quando há trabalho a fazer, a ação chega até ele. Princípio Forja #6 (alerta sempre com tratativa) aplicado.

Banner some quando: 0 skills sem categoria · classificação em andamento · modo "Montar kit" ativo (não polui contexto de seleção).

**Documentação**

`forja/docs/AGENTS-debt-tracking-template.md` ganhou nota pro autor de novas skills: SEMPRE preencher `category:` + `tags:` no frontmatter pra evitar exatamente esse buraco. Exemplo de frontmatter completo no topo do arquivo.

---

## [1.148.4] — 2026-06-23

### Adicionado — `<ProcessoCarregando>`: padrão Forja pra feedback de operações longas

**Princípio**: nenhuma operação acima de ~600ms pode rodar silenciosa. Sincronização com GitHub, scan de repo, auditoria com IA, recálculo de saúde — TUDO que demora precisa indicar visualmente. Silêncio = bug presumido.

Esse princípio é parente direto do "alerta sem tratativa proibido" (#6 do ROADMAP). O usuário levantou na hora certa: testando o sync de Dívida que vai pro GitHub (3-15s), o app ficava SEM feedback nenhum durante a operação — sensação real de "travou".

**Componente novo: `forja/src/components/ProcessoCarregando.tsx`**

Componente único com 3 variantes pra cobrir todo cenário:

- **`inline`** (default) — banner laranja-brasa no topo do conteúdo, não bloqueia interação. Pra: sync em background, refresh, save em segundo plano.
- **`overlay`** — cobre o conteúdo do painel atual com blur sutil + card central. Pra: operação que invalida tudo na view atual.
- **`fullscreen`** — cobre o app inteiro. Pra: primeira carga, bootstrap crítico.

Anatomia visual: spinner SVG nativo com gradient da brasa (não depende do Spin do antd pra controle fino) + mensagem (verbo no gerúndio + reticências) + (opcional) etapa técnica em mono lavanda + (opcional) subtexto cinza. Animação `forjaFadeIn` 0.18-0.25s. Cores via `useTokens()`.

**Aplicação imediata: aba Dívida técnica**

`DividaTecnicaPanel.tsx` agora mostra `<ProcessoCarregando variante="inline" />` enquanto `sincronizando=true`, com mensagem contextual baseada na fonte (`Sincronizando dívida técnica com GitHub…` ou `…Apps Script…`) + etapa técnica (`baixando árvore + arquivos + parseando`) + subtexto sobre cache.

**Documentação no design system**

`.cursor/rules/forja-design-system.mdc` ganhou nova **seção 10** (foi a antiga seção 10 "checklist final" pra 11) detalhando:
- Quando usar cada variante (com exemplos `tsx`)
- Regras de uso (mensagem ativa, etapa, subtexto)
- Quando NÃO usar (< 600ms basta loading antd)
- Item novo no checklist final: *"Operações > 600ms usam `<ProcessoCarregando>` (não silenciosas)?"*

Próximo agente IA pegando o repo já vai saber que precisa usar — e vai ser pego pelo bugbot se esquecer.

---

## [1.148.3] — 2026-06-23

### Adicionado — Self-bootstrap do FORJA + seção "Como usar essa skill em cada IDE"

**Self-bootstrap do sistema Forja (migration `MIGRATION_V148_FORJA_REPO`)**

Detecta automaticamente o sistema próprio da Forja (codinome `forja` OU nome contém "forja" + tem `scriptId` GAS) e preenche `repoUrl` com `https://github.com/lazaroweb/o-root-gas` se estiver vazio. Idempotente — só preenche quando vazio, e roda uma única vez (registra a flag em ScriptProperties).

Por quê: na v1.148.1 o usuário descobriu que escanear o build output (`Server.js` no GAS) não pega `// DEBT(...)` porque esbuild remove comentários. Cadastrar o `repoUrl` faz a Forja ler o source TS direto do GitHub (com comentários intactos). Em vez de o usuário editar a ficha do sistema na mão, a migration faz isso na próxima abertura do app.

`SCHEMA_VERSION` bumped pra `v1.71-forja-self-repo`.

**Componente `ComoUsarSkill.tsx` (novo)**

Cada skill no Atelier → Skills agora mostra uma nova seção **"Como usar essa skill em cada IDE"** dentro do drawer de detalhe, com Segmented control entre 8 destinos:

| IDE | Caminho | Cobre |
|-----|---------|-------|
| `AGENTS.md` | raiz do repo | Cursor + Claude Code + Codex + Continue (recomendado) |
| Cursor User Rule | Settings → Rules → User Rules | Todos os repos do user (só Cursor) |
| Cursor `.mdc` | `.cursor/rules/<slug>.mdc` | Por repo, versionado (só Cursor) |
| Claude Code | `~/.claude/skills/<slug>/SKILL.md` | Claude Code CLI |
| Codex | `AGENTS.md` (mesmo método #1) | Codex CLI |
| Continue | `~/.continue/config.json → systemMessage` | Continue.dev |
| GitHub Copilot | `.github/copilot-instructions.md` | Copilot (anexa se já existe) |
| Windsurf | `.windsurfrules` | Windsurf / Codeium IDE |

Cada destino mostra: descrição do que cobre · path destino (mono lavanda) · texto explicando como instalar · alerta de limitações (quando há) · **comando bash pronto** (`cat > arquivo << EOF`) que cria/atualiza o arquivo com o conteúdo da skill. Botão "Copiar comando" e "Copiar conteúdo da skill" pra zero fricção. Quando a skill veio do `gas-app-kit/`, também aparece "Ver no GitHub".

**Por quê**: o usuário pediu — ele quer importar a skill `forja-debt-tracking` (e qualquer outra) com instruções claras de como aplicar em IDEs diferentes, sem precisar lembrar dos caminhos de cada uma. A feature funciona pra TODAS as skills do hub, não só pra `forja-debt-tracking`.

---

## [1.148.2] — 2026-06-23

### Adicionado — Suporte a `/* */` e `/*! */` no parser de dívida + 2 dívidas reais marcadas no código + AGENTS.md template portátil

**Por quê**: testando a feature no próprio sistema "Forja - CRM Gestão 360", descobrimos que comentários `// DEBT(...)` somem do build output (esbuild com `target: 'es2020'` remove todos `//` no `transform`). Como esse sistema é GAS sem `repoUrl` cadastrado, o scan lê o Server.js (build), não o source TS — comentários comidos. Resolvido em 3 frentes:

**Parser estendido (`forja/src/server.ts`)**

- `_parseLinhaDebito` agora aceita também `/* DEBT(...) */` e `/*! DEBT(...) */` (block comments). O `/*!` (legal comment) sobrevive a bundlers que removem comentários — esbuild, terser, webpack com remove-comments. Mesma extensão pra TODO/FIXME/HACK.
- Regex ajustada pra strip de `*/` final quando bloco fecha na mesma linha.

**Dívidas reais marcadas (provando que funciona)**

- `/*! DEBT(arquitetura,media): AuditFontes duplicada entre types.ts e server.ts ... */` — toda extensão precisa ser feita em 2 lugares (já mordeu na v1.147 com `batchesUsados`). Extrair pra source-of-truth única.
- `/*! DEBT(performance,baixa): Apps Script API não tem HEAD/ETag — toda abertura da aba Dívida em sistema GAS baixa o content completo. Investigar If-None-Match ou cachear versionNumber do último deploy. */`

Esses 2 vão aparecer na aba Dívida do próprio sistema da Forja assim que sincronizar.

**Documentação portátil**

- `forja/docs/AGENTS-debt-tracking-template.md`: template autocontido pra copiar pra qualquer outro repositório. Inclui o protocolo completo + tabela comparativa de instalação (AGENTS.md vs `.cursor/rules/` vs User Rule global), com recomendação de AGENTS.md (universal: Cursor + Claude + Codex + Continue).
- `AGENTS.md` da raiz do o-root-gas: nova seção `## 13. Protocolo de dívida técnica & TODOs` com instruções resumidas pro próximo agente AI que pegar este repo.
- Skill `forja-debt-tracking` (gas-app-kit) + Cursor rule (`.cursor/rules/forja-debt-tracking.mdc`) atualizadas pra documentar a nova sintaxe.

---

## [1.148.1] — 2026-06-23

### Corrigido — Dívida técnica também escaneia projetos Apps Script (sem repoUrl)

Quando o sistema é Google Apps Script puro (tem `scriptId` mas não tem
`repoUrl`), a aba **Dívida** dizia "sem repositório GitHub" mesmo o usuário
tendo conexão GitHub ativa. A auditoria já sabia lidar com isso há tempos
(via `_lerCodigoSistema` que escolhe GitHub > GAS); a Dívida ficou pra trás.

**Backend (`forja/src/server.ts`)**

- Nova `_scanGASTodos(scriptId)`: lê arquivos do projeto via `script.googleapis.com/v1/projects/.../content`, parseia cada `source` linha-a-linha procurando os 4 padrões. Devolve no mesmo formato de `_scanRepoTodos` (sha + matches + erro) pra tratamento uniforme.
- Nova `_scanCodigoSistemaParaDebitos(sistema)`: orquestrador — escolhe GitHub se tem `repoUrl`, GAS se tem só `scriptId`. Mesma prioridade da auditoria.
- Nova `_mudouDesdeUltimoScan(sistema, ultimoScanSha)`: abstrai o HEAD check. Pra GitHub, faz a chamada barata de commit SHA; pra GAS sempre devolve "mudou" (Apps Script API já é rápida e não tem HEAD equivalente).
- `_hashConteudoGAS`: gera SHA-like determinístico (`gas-XXXXXX`) baseado em nomes+tamanhos dos arquivos, usado como identificador de "scan" no lugar do commit.
- `sincronizarDebitos` refatorado pra usar essas abstrações — código consistente, GitHub e GAS tratados igual.

**Frontend (`DividaTecnicaPanel.tsx`)**

- Nova prop `scriptId` (paralela a `repoUrl`). Validação trocada de `temRepo` pra `temCodigo = temRepo || temScript`.
- Mensagem de erro "sem repositório GitHub" → "sem código auditável" (com instrução pra cadastrar `repoUrl` OU `scriptId`).
- Label da fonte (header + tooltip): mostra "github" ou "apps script" conforme o caso.
- Ação "Abrir no GitHub" do card: vira "Abrir no editor do Apps Script" (sem âncora de linha — GAS não suporta deep-link) quando a fonte é GAS.

**Por quê**

O sistema "Forja - CRM Gestão 360" (o próprio QG do user) é GAS — não tem
`repoUrl`. A auditoria com IA funcionava nele, mas a Dívida estava bloqueada,
o que quebrava a promessa de "qualquer sistema com código vira target". Agora
qualquer Sistema com **GitHub OU Apps Script** vê dívida automaticamente.

---

## [1.148.0] — 2026-06-23

### Adicionado — Dívida técnica + TODO list lidos do código

Cada Sistema agora tem uma aba **Dívida** que escaneia o repositório GitHub
procurando 4 padrões em comentários e os apresenta como itens vivos. O usuário
deixou de ter "vontade de lembrar onde marcou tal coisa pra arrumar depois" —
o código vira a fonte da verdade, e a Forja vira o painel de controle.

**Backend (`forja/src/server.ts`)**

- Nova tabela `DebitoTecnico` (sistemaId, tipo, area, severidade, descrição,
  arquivo, linha, hash, status, backlogId, datas, ultimoScanSha). SCHEMA_VERSION
  bumped pra `v1.70-debito-tecnico`.
- `_scanRepoTodos(repoUrl)`: lê tree do GitHub, filtra arquivos relevantes
  (reusa `_codeArquivoRelevante` da auditoria — skipa node_modules, dist, gerados),
  baixa blobs em paralelo via `fetchAll`, cacheia por SHA, parseia linha-a-linha
  procurando 4 padrões.
- 4 marcadores reconhecidos:
  - `// DEBT(area,severidade): desc` → estruturado (área + severidade)
  - `// TODO:`, `// FIXME:`, `// HACK:` → texto livre
  - Prefixos `//`, `#`, `--`, `<!-- -->`. Case-insensitive. Trunca em 280 chars.
- `sincronizarDebitos(sistemaId)`: roda scan e faz **diff inteligente** com
  o que tem na tabela — adiciona novos, marca como `pago` automaticamente os
  ativos que sumiram do código, preserva `promovido` (que tem vida própria),
  atualiza linha quando o item moveu. Hash determinístico em
  tipo+arquivo+descricao resiste a deslocamento por edição.
- **Otimização escondida**: antes de fazer o scan completo, um `_ghHeadShaSeguro`
  faz um GET barato (~200ms) só do HEAD commit. Se HEAD não mudou desde último
  scan → retorna cache instantaneamente com `semMudanca: true`. Em 95% das
  aberturas, sai apenas 1 chamada barata em vez de N pesadas.
- RPCs expostos: `sincronizarDebitos`, `getDebitosTecnicos`, `getDebitosResumo`
  (resumo pro badge da aba), `promoverDebitoParaBacklog`, `marcarDebitoComoPago`.

**Frontend**

- `forja/src/components/DividaTecnicaPanel.tsx`: painel completo com header de
  contadores, filtros segmented (Ativos / Dívida / TODO+FIXME+HACK / Promovidos /
  Pagos), busca por arquivo/descrição/área, lista de cards com tipo + severidade +
  arquivo:linha, ações **Promover pra Backlog** + **Abrir no GitHub** (link
  permanente pra arquivo:linha no branch default) + **Marcar como pago**
  manualmente (escape hatch). Auto-sync acontece 250ms depois do render inicial.
- `forja/src/views/SistemaDetail.tsx`: nova sub-aba **Dívida** (ícone Bug) entre
  Backlog e Decisões, com badge mostrando contagem total + flag de urgente quando
  tem severidade alta. Widget compacto `DividaWidgetCompacto` no resumo do
  Sistema (entre Saúde e Graduação) aparece **só quando tem débito ativo**;
  clique abre a aba já com escopo.
- Tipos novos em `forja/src/types.ts`: `DebitoTecnico`, `DebitoSyncResult`,
  `DebitoTipo`, `DebitoStatus`, `DebitoArea`, `DebitoSeveridade`.

**Skill pra agentes de IA**

- `gas-app-kit/skills/forja-debt-tracking/SKILL.md`: skill que ensina o agente
  (Cursor, Claude, etc.) a usar os 4 marcadores corretamente. Tabela de uso,
  9 áreas válidas, 3 severidades, exemplos práticos, regras de comportamento
  (não refatorar dívida silenciosamente; não duplicar; não marcar em testes;
  descrição acionável; usar `DEBT` formal quando user fala "vou pagar depois").
- `.cursor/rules/forja-debt-tracking.mdc`: versão Cursor-rule da skill,
  `alwaysApply: true` em arquivos de código. Quando você abre Cursor neste repo,
  o agente já sabe o padrão sem você precisar ensinar.

**Por quê**

- Backlog ≠ Dívida técnica. Backlog é trabalho planejado; dívida é atalho
  consciente que fica meses parado sem deixar de existir. Misturar perde
  visibilidade dos 2 lados.
- Hoje os agentes de IA (Cursor, Claude) podem identificar problemas durante
  implementação mas não tinham canal padronizado pra registrá-los. Resultado:
  ou refatoravam silenciosamente (perigoso, fora do escopo) ou esqueciam.
  Agora têm: marca `// DEBT(...)`, segue a tarefa, aparece na Forja.
- TODO/FIXME no código é coisa antiga, mas geralmente vira lixo invisível —
  ninguém lê de novo. Trazer pro painel central com tipo, contador, severidade
  e link direto pro arquivo transforma em superfície ativa de manutenção.
- Sincronia automática via Git (apaga do código → some do app) resolve o
  problema clássico de TODO list desatualizada — não tem o que sincronizar
  porque o código É a fonte.

**Como usar**

1. Adicione `// DEBT(seguranca,alta): credenciais hardcoded` (ou TODO/FIXME/HACK)
   no código onde mora a dívida.
2. Commit + push pro branch default.
3. Abra o Sistema na Forja → aba **Dívida**. O scan roda automático ao abrir.
4. Use **Promover pra Backlog** quando for hora de pagar; **Abrir no GitHub**
   pra pular direto pro arquivo:linha; **Sincronizar** força um re-scan ignorando
   cache.
5. Pra fechar: apague o comentário do código + faça commit. Próximo sync marca
   como **pago auto**.

---

## [1.147.0] — 2026-06-23

### Resolvido — DIFF TRUNCADO (auditoria com IA agora cobre repos grandes)

- **Backend (`server.ts`)** — chunking automático do diff GitHub:
  - Substituído o pipeline single-shot (1 chamada LLM com diff inteiro → truncava em silêncio quando passava de 110KB / 28 arquivos / 15KB por arquivo).
  - Novo `_lerDiffGitHubPaginado` retorna a lista bruta de arquivos do compare + N batches já empacotados pra caber na janela do modelo (75KB por batch).
  - Arquivos individualmente grandes são divididos em **janelas com overlap de 5 linhas** (`_splitarPatchEmJanelas`) — preserva contexto de bloco/função entre fatias.
  - `_executarAuditoriaIncrementalChunked` roda N chamadas LLM (uma por batch), faz **merge dedupado** dos findings via `_mergeAuditPayloads` (reusa `_mesmoAchado` com Jaccard + área+keywords), e **sintetiza a narrativa final** em chamada extra leve (`_sintetizarNarrativaPosBatch`).
  - Cap global de **5 batches** por auditoria controla custo. Arquivos que ficam de fora vão pra `fontes.arquivosIgnorados` (lista explícita por nome) — acaba o silêncio do truncamento mudo.
  - Caminho rápido preservado: diff que cabe em 1 batch sem ignorados continua chamando o fluxo single (1 chamada LLM, sem overhead).
- **UI (`AuditoriaDrawer.tsx`)** — sinais novos no cabeçalho da auditoria:
  - Tag verde **`N batches · coberto`** quando o diff foi fatiado mas TUDO foi auditado.
  - Tag lavanda **`N splitted`** com lista no tooltip dos arquivos que foram divididos em janelas.
  - Tag peach **`N arquivo(s) fora desta auditoria`** com lista no tooltip dos ignorados pelo cap global + orientação de tratativa ("rode Nova auditoria depois").
  - O `.md` baixado também reflete os números: `auditado em N batches`, `N divididos em janelas`, `N ignorados pelo cap global` com nomes.
  - Auditorias antigas (pré-chunking) ainda mostram o aviso clássico "diff truncado" como fallback.

### Resolvido — Alerta sem tratativa (princípio "alerta sem ação proibido")

Varredura completa do app identificou **20 ofensores reais** que mostravam alerta/contagem sem caminho de resolução. Todos os 7 de severidade ALTA + 10 MÉDIA + 3 BAIXA implementados:

**Severidade ALTA (7)**:
- **Dashboard hero** — contadores "X decisões em aberto" e "X findings pra resolver" agora são clicáveis, navegando pra Bancada/Sistemas.
- **OpsMonitor** — linhas FALHA ganham botão "Resolver" que abre a sub-aba certa (Aplicações pra `app`, Status pros demais).
- **OpsAplicacoes** — apps "Fora do ar" ou "Sem URL" ganham botão "Resolver" / "Cadastrar URL" que abre a ficha do sistema.
- **OpsStatus** — linhas IA / GitHub desconectadas ganham botão "Configurar" / "Revisar" que abre Configurações.
- **Dashboard widget Conexões** — IA/GitHub ficam clicáveis: leva pra Configurações quando há problema, pra Operações quando ok.
- **FinReceitas** — tile "Em atraso" clicável aplica filtro "só atrasadas" nas Próximas cobranças e rola até o painel.
- **FinPessoal** — Alert de orçamento estourado ganha botão "Ver orçamentos" que troca pra aba certa.

**Severidade MÉDIA (10)**:
- ClienteSnapshotDrawer (alertas + KPI Pendências), PessoasView SaudeBadge, FinPessoal órfãos (rola até + highlight), FinInteligencia (InsightsPanel + PlanoCard com próximo passo contextual), ServidoresPanel tiles (filtro automático), Dashboard "Atenção" mini-stat, SystemCard (pill de auditoria muda cor + mostra findings em destaque), AuditoriaDrawer Alert "Formato não estruturado" (botão Rodar de novo).

**Severidade BAIXA (3)**:
- ConectarReposModal Alert sem GITHUB_TOKEN (caminho explícito Configurações → Integrações → GitHub), ModelosDisponiveis Alert de erro (botão "Tentar de novo"), Sidebar item Ideias (badge com inbox count global).

### Técnica

- `AuditFontes` ganhou `batchesUsados`, `arquivosIgnorados[]`, `arquivosSplitted[]` (espelhado em `types.ts` e `server.ts`).
- `AppSidebar.tsx` ganhou prop `ideiasInbox` + badge peach no item Ideias.
- `App.tsx` busca `getIdeiasInboxCount` em cada navegação (cheap call, sem polling).
- Decisão de simplificação documentada: batches sequenciais (não paralelos via `fetchAll`) — refator de `forjaCallLLM` pra paralelizar não compensa o ganho de latência (5 batches sequenciais ≈ 100s, dentro do limite GAS de 6min). Paralelização fica como evolução futura caso vire gargalo.

---

## [1.146.1] — 2026-06-22

### Adicionado — monitoramento ao vivo dos Servidores

Logo após a estação Servidores, a pergunta natural: "como sei se eles estão no ar?".
Resposta: ping leve no browser do user (não dá pra ser no GAS — a nuvem do Google
não enxerga seu `localhost`).

**Como funciona**:
- Cada servidor com `url` ou `host:porta` ganha uma bolinha colorida ao lado do
  endereço no card: verde = online, vermelho = offline, lavanda = verificando,
  cinza = sem URL pra pingar.
- Auto-ping ao abrir a estação Servidores; botão **"Verificar todos"** no header
  pra re-checar; botão de refresh no próprio card pra checar 1 só.
- No modal de detalhe, banner generoso com latência (ms), tempo desde o último
  check e botão "Pingar agora".
- Tile **"Online ao vivo"** no painel substitui o antigo "Com erro" estático.
- Detecção de mixed content: avisa quando Forja-em-HTTPS tenta bater em HTTP
  local (o navegador bloqueia silenciosamente — agora você sabe disso).

### Adicionado — widget Conexões do Dashboard

O widget "Conexões" no Dashboard agora mostra **uma linha extra** para os
servidores cadastrados: `Servidores 3/5`, bolinha viva, tooltip explicativa.
Clique abre direto a estação Servidores no Atelier — sem precisar navegar manualmente.

### Notas técnicas

- Novo helper `src/utils/pingServidor.ts` — usa `fetch(url, { mode: 'no-cors' })`
  com `AbortSignal.timeout`. Funciona pra qualquer URL alcançável pelo browser
  do user (localhost, LAN, internet). Não diferencia 200 de 500 (limitação do
  no-cors), mas detecta "respondeu vs não respondeu" — o que importa pra
  saúde de processo.
- Helper `pingMuitos` faz pings em paralelo com cap de concorrência (default 6).
- Estado de ping é **volátil** (não persiste no Sheet) — status real-time não
  faz sentido guardar; o que vale é o agora.
- Animação `forjaPulse` adicionada ao `esbuild.mjs` (bolinha pulsando durante
  verificação).
- `App.tsx`: novo `atelierInitialTab` permite o Dashboard pular direto pra
  estação Servidores via `onOpenAtelierTab('servidores')`.

---

## [1.146.0] — 2026-06-22

### Adicionado — Atelier > Servidores

Nova estação no Atelier pra inventário das **instâncias que você roda**:
proxies LLM (LiteLLM, Ollama, vLLM), automações (n8n, Node-RED), mística
(ComfyUI, Stable Diffusion), bancos locais (Postgres, Redis), workers e
self-hosted (Plex, Home Assistant). **Distinto de "Hospedagem"**, que é
sobre provedores cloud onde você pode rodar coisas.

#### UI premium e minimalista
- Lista em grid com cards limpos: ícone semântico por tipo (detecta LiteLLM/
  Ollama/n8n/Postgres etc. automaticamente), nome, descrição, status pill
  colorido (Rodando/Dev/Parado/Erro), URL em mono, ambiente + tecnologia,
  custo, sistema vinculado.
- Modal de detalhe que **não empurra a lista** — abre flutuante, mostra
  comando de start em terminal escuro com botão copiar, paths como lista
  copiável, dependências como chips, atalhos pra docs/abrir URL/Cofre.
- Modal de cadastro com **5 seções enxutas**: Identidade · Conexão ·
  Operação (com paths dinâmicos via Form.List) · Custo & manutenção ·
  Tags & notas. Cada uma com headerzinho discreto.
- **10 presets de tipos famosos** pré-configurados — clique em "Ollama" e
  o form já vem com porta 11434, URL, comando start e link da doc.
- 4 stat tiles: Total · Rodando · Com erro · Custo mensal.
- Filtros: busca livre + ambiente + status.

#### Ficha completa
- Identidade: nome, tipo (chip livre), descrição, status, ambiente
  (local/VPS/cloud/edge), tecnologia (Docker/native/python/node/systemd),
  sistema vinculado (puxa da tabela Sistemas).
- Conexão: host, porta, URL.
- Operação: comando para subir, paths importantes (config/logs/data),
  dependências, recursos (RAM/CPU/etc).
- Custo & manutenção: custo mensal + moeda, docs URL, ref ao Cofre.
- Tags + notas livres.

#### Backend
- Nova tabela `Servidores` com 23 colunas (paths como JSON na célula).
- `servidoresList` / `servidoresSave` / `servidoresDelete` (RPC global).
- `SCHEMA_VERSION` → `v1.69-servidores`.
- Decisão: **nada de senha aqui** — `cofreLabel` referencia o item no Cofre.

---

## [1.145.1] — 2026-06-22

### Corrigido — Seletor de cartão: contraste e layout em Contas

- **Modal de cartões**: o chip colorido da bandeira (Visa azul-marinho,
  Mastercard vermelho-Pantone, etc.) sumia ou virava neon agressivo no
  dark mode. Removido. Bandeira agora é metadado em texto secundário,
  numa linha única: `Visa · vence dia 19 · R$ 13.350`. Mini-card ficou
  horizontal (não mais grid de 2 linhas), mais escaneável e premium.
- **Form "Forma de pagamento" (Atelier > Contas)**: o chip "Vinculado a:"
  ficava maior que o input, quebrava em 2 linhas e o user não conseguia
  voltar pra outro método. Reformulado: agora o input texto e o
  chip-cartão são **mutuamente exclusivos** — quando você vincula um
  cartão, ele substitui o input por um card compacto (ícone + apelido +
  bandeira + vencimento). Dois botões inline: `editar` (troca cartão) e
  `X` (desvincula e volta pro texto livre vazio). Sem mais empilhamento.

---

## [1.145.0] — 2026-06-22

### Mudado — Ideias: trilha de vida + reorganização das visões

**Por quê.** Dois problemas concretos:
1. Reabrir uma ideia **apagava** a data de conclusão anterior. Sem como ver o
   tempo de resolução nem detectar padrão de re-trabalho.
2. As 5 visões (Inbox · Foco · Ativas · Concluídas · Arquivo) + botão "MODO
   FOCO" criavam sobreposição confusa: "Foco" e "Ativas" mostravam basicamente
   as mesmas ideias, e o botão tinha o mesmo nome que uma das abas.

#### Backend — trilha de eventos preservada

- Novas colunas em `Ideias`:
  - `reabertaEm` — timestamp ISO da última reabertura.
  - `reaberturas` — contador (quantas vezes foi reaberta).
  - `concluidaEmHist` — JSON array com TODAS as datas anteriores de conclusão.
- `reabrirIdeia` agora **empilha** a conclusão anterior em `concluidaEmHist`
  (em vez de apagar `concluidaEm`), grava `reabertaEm` e incrementa o contador.
  Permite ler: "Concluída há 4d → Reaberta há 1d (já foi reaberta 2×)".
- `concluirIdeia` limpa `reabertaEm` quando fecha de novo após reabertura
  (mantém `reaberturas` como histórico cumulativo).
- `getIdeias` normaliza os campos novos pra UI (`reaberturas: number`,
  `concluidaEmHist: string[]`). Compatível com ideias legadas.
- `SCHEMA_VERSION` → `v1.68-ideia-trilha`.

#### Frontend — 4 visões claras (em vez de 5 confusas)

**Antes:** Inbox · Foco · Ativas · Concluídas · Arquivo + botão "MODO FOCO".

**Agora:** Inbox · Em andamento · Concluídas · Arquivo + botão "Triar 1 por 1".

- **Removida** a aba "Foco" como visão separada. O conceito virou
  **agrupamento interno** dentro de "Em andamento": as ideias são agrupadas
  em `Foco` (alta prioridade ou criadas há ≤ 3 dias), `Importante` (média),
  `Outras`. Sem perder a noção de prioridade — só sem aba duplicada.
- **Renomeada** "Ativas" → **"Em andamento"** (deixa claro que é o trabalho em
  fluxo, não estado abstrato).
- **Renomeado** o botão "MODO FOCO" → **"Triar 1 por 1"** (e o atalho
  "Triar N no Foco" → "Triar N em rajada"). Acaba a colisão semântica.
- **Default smart**: ao abrir, se houver pelo menos 1 ideia no Inbox → abre
  em Inbox (algo pra triar). Senão → abre em "Em andamento". Se você mudar
  manualmente de aba, sua escolha é respeitada na sessão.

#### Trilha visual nas cards e no drawer

- **Card de ideia** mostra no rodapé:
  - Concluída: `✓ há 2h · levou 4d · 2× reabertas` (tudo com tooltip de data
    exata e duração).
  - Em andamento mas já foi concluída antes: `↻ reaberta há 1d · antes: há 5d`.
  - Nova/em andamento sem histórico: só `🕐 criada há 3d`.
- **Drawer de triagem** ganha bloco **"Trilha de vida"** no topo (só aparece
  se houver mais de 1 evento): timeline horizontal `Criada → Concluída →
  Reaberta → Concluída`, cada evento com cor semântica e data ao hover,
  resumo "Total: 4d" ou "Ativa há: 2d" + chip "2× reabertas".

### Não mexido
- IdeiaTriagemBatch (modo rajada): não recebeu timeline porque ele só roda
  sobre o Inbox bruto (ideias sem histórico ainda).
- Hotkey `g+x` continua igual (captura rápida global).

---

## [1.144.0] — 2026-06-22

### Adicionado — Ligando Atelier > Contas e Financeiro Pessoal via cartão

**Por quê.** Antes você cadastrava um cartão em `Financeiro > Pessoal > Cartões`
e digitava de novo "cartão final 1234" em `Atelier > Contas` e no `cartaoId` plano
de cada assinatura. Informação duplicada, sem ligação entre as áreas — se trocasse
o cartão, precisava editar tudo manualmente.

**O que mudou.** Um único componente visual de seleção de cartão, usado nas duas
telas. Você vê a cara do cartão (cor que escolheu no cadastro, bandeira, dia de
vencimento, limite) e clica — nada de dropdown plano onde todos parecem iguais.

#### Novo: `CartaoSelectorModal` compartilhado (`forja/src/components/`)
- Modal de 620px com grid responsivo de mini-cards do cartão.
- Cada mini-card mostra: ícone na cor escolhida, apelido > nome, bandeira (chip
  colorido por marca: Visa azul, Mastercard vermelho, Elo ciano, Amex azul,
  Hipercard bordô), dia de vencimento, limite formatado em BRL.
- Busca por apelido, banco ou bandeira.
- Estado vazio orienta a cadastrar em `Financeiro > Pessoal > Cartões`.
- Helper `descreverCartao(c)` exportado: gera texto curto e legível
  ("Cartão Nubank (Mastercard)") pra exibir fora do modal.

#### `Financeiro > Pessoal > Assinaturas` — `FinAssinaturas.tsx`
- Quando método de pagamento = "Cartão", em vez do `<Select>` plano antigo,
  aparece um **trigger visual** (botão com a cor do cartão, nome e ícone) que
  abre o `CartaoSelectorModal`.
- Botão "Limpar" inline pra desvincular sem precisar reabrir o modal.
- Integração transparente com `Form.Item` via `cloneElement` — validação do
  Ant Design continua funcionando igual.

#### `Atelier > Contas` — `ContasPanel.tsx`
- Novo campo `cartaoId` (opcional) no schema da tabela `Contas`.
- No formulário de cadastro/edição de conta, atalho **"Escolher cartão"** ao
  lado do label "Forma de pagamento". Abre o `CartaoSelectorModal`.
- Quando você escolhe um cartão, o app preenche automaticamente o texto da
  forma de pagamento ("Cartão Nubank (Master)") **e** grava o `cartaoId`
  apontando pro cartão real — ponteiro pro Financeiro Pessoal.
- Chip visual abaixo do campo mostra "Vinculado a: …" com a cor do cartão e
  botão `desvincular` inline.

#### Backend — `forja/src/server.ts`
- Tabela `Contas`: nova coluna `cartaoId` (append, sem breaking change).
- `contasSave`: aceita e persiste `cartaoId`.
- `SCHEMA_VERSION` bumpado pra `v1.67-contas-cartao`.
- `getCartoesPessoais` reusado nas duas telas (já existia).

### Não mexido (por quê)
- Não criamos uma rota nova nem tabela nova — o cartão continua sendo
  cadastrado **só** no Financeiro Pessoal (fonte única). Contas e Assinaturas
  só guardam o ponteiro (`cartaoId`).
- Não bloqueamos o campo texto livre `formaPagamento` — quem quiser continuar
  digitando "PIX" ou "boleto" segue podendo.

---

## [1.143.0] — 2026-06-22

### Mudado — Fusão Centelha em Ideias (caixa única)

Diagnosticando o app em uso, ficou evidente que Centelha (Inbox bruto, v1.141.0)
e Ideias (banco maduro) tinham ~80% de sobreposição. Resultado: o usuário ficava
em dúvida onde lançar cada coisa, e a sessão "Centelha" recém-criada já tinha
um bug de padding (faltou wrapper `forja-view` — relato real: "tomei até um
susto"). **Solução**: fundir Centelha em Ideias com 3 features que tornam Ideias
a melhor de ambos os mundos.

#### Adicionado

- **Captura zero-fricção em Ideias**: input sticky no topo (igual era na
  Centelha), 1 campo + Enter salva e mantém foco pra rajada. Aparece nas
  visões de trabalho ativo (Inbox/Foco/Ativas).
- **Captura global flutuante** (modal `IdeiaCapturaQuick`): hotkey `g+x` em
  qualquer tela abre um modal grande pra capturar uma ideia sem trocar de
  contexto. Esc fecha, Enter salva e mantém aberto pra rajada, contador "3
  capturadas ✓" mostra o ritmo.
- **5 visões inteligentes** (substituem filtros chatos):
  - **Inbox 🔥** — capturadas brutas (sem categoria/sistema). Esperando triagem.
  - **Foco 🎯** — alta prioridade OU criadas nos últimos 3 dias. Atenção primeiro.
  - **Ativas 💡** — em movimento e já triadas.
  - **Concluídas ✅** — histórico, agrupado por mês.
  - **Arquivo 📦** — arquivadas + descartadas.
- **Modo Foco** (`IdeiaTriagemBatch`): quando Inbox tem 3+ itens, surge um CTA
  "Triar N no Foco" — modal fullscreen, 1 ideia por vez, navega com ← →,
  decide com 1 tecla (C=concluir, A=arquivar, D=descartar, G=gênese, T=drawer
  detalhado, Esc=sai). Inspirado em Superhuman / Things 3.
- **Drawer de triagem** (`IdeiaTriagemDrawer`): lateral 520px (não mais modal
  pesado). Campos com slider visual pra impacto/esforço, segmented pra tipo
  (Novo sistema / Melhoria), categoria (feature/bug/melhoria/sistema_novo/
  processo/pessoal) e prioridade. **Refinar com IA** sugere TODOS os campos
  E detecta duplicata cruzando com Ideias ativas + Decisões abertas.
- **Cards modernos**: hover com `translateY(-2px)` e sombra maior, ações
  inline ao hover (não poluem a leitura), faixa lateral colorida pelo estado,
  agrupamento por tempo nas visões de histórico ("Hoje", "Esta semana",
  "Este mês", "Antigas"), score visual em mini-barra `■■■■■░░░░░`.
- **Categoria como pill colorida** (feature azul, bug rosa, melhoria
  mostarda, sistema_novo pêssego, processo lavanda, pessoal sage).

#### Backend

- `SCHEMA_VERSION` bump pra `v1.66-ideias-fusao`.
- Tabela `Ideias` ganhou colunas `categoria` e `arquivadaEm` (append-only).
- Nova função `refinarIdeiaComIA(payload)` — substitui `refinarCentelhaComIA`
  com lógica equivalente + sugere `notaImpacto`/`notaEsforco` (extra
  vs. Centelha).
- Nova função `getIdeiasInboxCount()` — conta ideias `estado=nova` sem
  categoria E sem sistema. Substitui `getCentelhasNaoTriadasCount` no
  badge do Dashboard.
- `arquivarIdeia`/`descartarIdeia` agora preenchem `arquivadaEm`.
- Tabela `Centelhas` + funções server **mantidas** pra back-compat (dados
  capturados antes do v1.143.0 não se perdem). UI consome zero delas.

#### Removido (da UI; back-compat preservada no backend)

- View `forja/src/views/Centelha.tsx` — deletada.
- Componente `forja/src/components/CentelhaTriagemModal.tsx` — deletado.
- Item "Centelha" da sidebar — removido (estética unificada).
- Tipo `'centelha'` de `ViewName` — removido.
- Badge "N centelhas pra triar" no Dashboard → "N ideias no inbox" (mesma
  semântica, agora aponta pra Ideias com visão Inbox).

#### Adicionado — Design System docs (pra nunca mais quebrar consistência)

- [`.cursor/rules/forja-design-system.mdc`](../.cursor/rules/forja-design-system.mdc)
  — Cursor Rule **auto-aplicada** em toda view/componente. Garante o wrapper
  `forja-view`, maxWidth por densidade, PageHeader, tokens semânticos,
  escala de espaçamento, Drawer > Modal, Popconfirm em destrutivos,
  princípio #6 (alerta sem CTA proibido), hover state, etc.
- [`forja/docs/SKILL_design-system.md`](docs/SKILL_design-system.md) — Skill
  humana com paleta completa, tipografia (Fraunces/Inter/JetBrains),
  raios de borda, sombras, padrões de componente, anti-padrões com
  exemplos ❌ × ✅, inspirações (Notion/Linear/Things 3/Superhuman/Stripe).

### Motivação

> "Eu nao achei nada moderna essa visao... e ai fiquei pensando se nao estamos
> criando algo que ja tinhamos que é a sessao de Ideias e poderiamos apenas
> melhorar ela... faca uma analise profunda como um especialista em produto e
> design de UX/UI, nao economize nas features, quero algo impactante que me
> deixar viajar." — Lazaro Filho, 2026-06-22

A Forja precisa ser uma jornada coesa, não um caleidoscópio de seções
sobrepostas. Ideias agora é **uma só casa**: captura zero-fricção, triagem
rica, modo foco pra despachar batch, lifecycle completo, design moderno.
E o Design System documentado garante que essa coesão se mantém em tudo que
vier depois.

---

## [1.142.0] — 2026-06-22

### Adicionado — Lifecycle completo da sessão Ideias

- **Botão "Concluir"** em cada ideia ativa: marca como `concluida` e carimba
  `concluidaEm` pra histórico (a Forja agora sabe QUANDO virou realidade).
- **Botão "Reabrir"** em ideias concluídas/arquivadas: volta pra `em andamento`
  e limpa `concluidaEm` (engano humano não é fim de mundo).
- **Menu "mais"** (`⋯`) por ideia: arquivar (preserva histórico) · descartar
  (não vai acontecer) · apagar permanentemente (com confirmação dupla).
- **Filtro por estado** (Segmented com badges): Ativas / Concluídas /
  Arquivadas / Descartadas / Todas. Default = Ativas (foca no que importa).
- **Indicador visual** de concluída: título riscado, ícone ✓ sage, cards com
  opacidade reduzida em arquivadas/descartadas.
- **Faixa lateral colorida** em cada card no tom do estado (leitura rápida).
- **Timestamps relativos**: "concluída há 3d", "criada há 2h" (tooltip mostra
  data completa). Histórico fica visível sem virar tabela carregada.

### Mudado — Backend

- `SCHEMA_VERSION` bump pra `v1.65-ideias-lifecycle`.
- Coluna `concluidaEm` adicionada à tabela `Ideias` (append-only, dados antigos
  preservados).
- 5 funções server novas: `deleteIdeia`, `concluirIdeia`, `reabrirIdeia`,
  `arquivarIdeia`, `descartarIdeia`.

### Por que existe (motivação do usuário)

> "Tudo ok, mas eu não consigo apagar uma ideia que eu lancei nem tipo
> colocar como concluído feito, e ter um histórico disso seria importante."

A sessão Ideias era um cemitério: você lançava algo, nunca apagava, nunca
fechava. Agora cada ideia tem ciclo de vida real, com histórico preservado e
botão pra cada ação. Alinhado com princípio #6 (alerta sem tratativa proibido):
toda ideia tem um caminho de saída claro.

---

## [1.141.0] — 2026-06-22

### Adicionado — Centelha: caixa de captura zero-fricção (Inbox/GTD-style)

- **Nova sessão na sidebar** (entre Ideias e Sistemas) com ícone 🔥. Conceito:
  o "antes da Ideia" — pensamento bruto antes de virar algo refinado. Inspirado
  em GTD (capture → process → organize) + Personal Kanban.
- **Captura zero-fricção**: 1 input gigante no topo + Enter salva e mantém o foco
  pro próximo (captura em rajada). Auto-foco ao entrar na tela.
- **Hotkey global `g+x`**: navega pra Centelha de qualquer tela.
- **3 visões**: Capturadas 🔥 (não triadas), Triadas 🪵 (classificadas mas sem
  decisão), Resolvidas ✅ (promovidas/arquivadas/descartadas).
- **Modal de triagem rico**: título, contexto, categoria (feature/bug/melhoria/
  sistema novo/processo/pessoal), prioridade, sistema vinculado, tags.
- **Promoção dirigida**:
  - **→ Ideia**: cria entrada no banco global de Ideias.
  - **→ Backlog**: cria entrada em Decisões de um sistema específico.
  - **Arquivar**: preserva histórico sem poluir.
  - **Descartar**: marca como ruído.
  Em todos os casos, a Centelha vira `estado=promovida/arquivada/descartada` com
  `promovidaPara='ideia:<id>'` ou `'decisao:<id>'` pra rastreabilidade.
- **Refinar com IA** (Forja IA): sugere categoria, prioridade, sistema vinculado
  E detecta duplicata cruzando com Ideias + Decisões existentes (anti-redundância
  herdada da v1.140.1). Proposta cai nos campos pra você editar antes de confirmar.
- **Badge no Dashboard**: "N centelhas pra triar" no rodapé do hero, clicável,
  alinhado com princípio #6 ("alerta sem tratativa proibido").

### Mudado — Backend

- `SCHEMA_VERSION` bump pra `v1.64-centelha`. Nova tabela `Centelhas` no SheetDB
  com 13 colunas: `id, titulo, contexto, estado, categoria, sistemaId, clienteId,
  promovidaPara, tags, prioridade, criadoEm, triadoEm, decididoEm`.
- Novas funções server: `getCentelhas`, `getCentelhasNaoTriadasCount`,
  `createCentelha`, `updateCentelha`, `deleteCentelha`, `arquivarCentelha`,
  `descartarCentelha`, `promoverCentelhaParaIdeia`, `promoverCentelhaParaBacklog`,
  `refinarCentelhaComIA`.
- `updateCentelha` tem auto-transição: se você preencher categoria/sistema/
  prioridade enquanto está em `capturada`, move pra `triada` automaticamente
  e marca `triadoEm`.

### Por que existe (motivação do usuário)

> "Eu estou trabalhando e vem várias coisas que preciso fazer que são pendências
> [...] pensei em ter uma sessão onde eu possa cadastrar todas as minhas ideias e
> isso possa de alguma forma depois ser refinada e entrar ou não para um backlog,
> um conceito de caixa onde coloco tudo e depois classifico"

A Forja já tinha `IdeiasView` (modal pesado, mistura sistema-novo com melhoria) e
`IdeiasFaixa` (zero-fricção mas amarrada a 1 sistema). Faltava o **equivalente
global, com fluxo de triagem e decisão**. Centelha resolve.

---

## [1.140.1] — 2026-06-21

### Mudado — Reconciliação semântica em 2 camadas (Jaccard + área+keywords)

- **Reconciliador agora pega reformulações da IA que o Jaccard puro não pegava.** Reação direta a falso-positivo visto na v1.140.0: 3 achados marcados como "resolvidos" foram na verdade reformulados como "novos" pela IA (mesmo tema, palavras diferentes) — Jaccard de 0.09 a 0.22, abaixo do threshold 0.4.

#### Casos reais que motivaram

| Anterior | Novo | Jaccard | Diagnóstico antigo | Diagnóstico novo |
|---|---|---|---|---|
| "Zero monitoramento/alerting em produção" | "Sem monitoramento/alertas de erros em produção" | 0.22 | ❌ resolvido + novo | ✅ persiste |
| "Spreadsheet como DB sem backup" | "Spreadsheet como DB com 20+ módulos" | 0.09 | ❌ resolvido + novo | ✅ persiste |
| "Cobertura de testes insuficiente para Server" | "Cobertura de testes limitada a smoke tests" | 0.20 | ❌ resolvido + novo | ✅ persiste |

#### Solução: nova função `_mesmoAchado(prev, atual)` com 2 camadas

**Camada 1** — Jaccard de palavras-chave ≥ 0.4 (mantido — cobre variações textuais óbvias).

**Camada 2 (nova)** — `MESMA ÁREA + ≥1 keyword técnica em comum`:
- Whitelist de ~40 keywords técnicas: monitoramento, backup, testes, deploy, spreadsheet, vendor, segurança, auth, dependência, lint, performance, secret, logs, cron, cors, xss, sql, etc.
- Se 2 findings têm a mesma `area` E compartilham ≥1 keyword, considera mesmo achado.
- Evita falso-positivo cruzando áreas (ex: "Vendor lock-in" em arquitetura × "Deploy local" em operacional → continuam diferentes).

Qualquer das camadas positiva = mesmo achado. Reduz drasticamente o ruído de "resolvido fantasma + novo fantasma" que confundia o ComparativoAntesDepois.

#### Nova função auxiliar `_extrairKeywordsTema(titulo)`

Normaliza título (lowercase, sem acentos) e retorna lista de keywords técnicas presentes. Reutilizável em futuras necessidades de classificação de achados.

---

## [1.140.0] — 2026-06-21

### Adicionado — Reconciliação determinística pós-IA (Antes vs Depois SEMPRE)

- **Auditoria completa também faz Antes vs Depois agora.** Reação direta ao usuário: "deveria separar isso e de fato dizer, tinhamos 10 problemas você resolveu dos 10 7 ficou 3 e apareceu mais 5 por exemplo entende?" — sim, exatamente isso, e era buraco no caminho completo.

Caso real: usuário forçou "Rodar de novo" (caminho completo, sem diff). A IA retornou 5 achados novos do zero, sem comparação com os 6 anteriores. Resultado: "0 fechados · 0 novos" no Comparativo Antes/Depois, score caiu 1 pt, achados completamente diferentes. Frustração: "rodei, baixou 1 ponto, tá osso".

Causa: o caminho INCREMENTAL passa achados anteriores pra IA reconciliar e marcar origem (novo/persiste/resolvidos). O caminho COMPLETO não — IA olha o sistema do zero, retorna achados sem origem. ComparativoAntesDepois exibia "0 fechados" porque o payload não tinha `resolvidos[]`.

#### Solução: reconciliação determinística no backend, pós-IA

Nova função `_reconciliarComAnterior(payload, sistemaId)`:

1. Se a IA já marcou origem (caminho incremental) → não mexe.
2. Senão, busca a última auditoria salva do mesmo sistema.
3. Cruza títulos atuais × anteriores usando **Jaccard de palavras-chave**:
   - Normaliza: lowercase, sem acentos, sem pontuação, sem palavras < 4 chars
   - `similaridade = intersecção / união`
   - Threshold: **0.4** — testado contra casos reais ("URL de produção não registrada" vs "URL de produção não registrada na Forja" = 0.66; "Webapp ANYONE" vs "Webapp restritivo" = 0.2)
4. Marca cada finding atual como `origem: 'novo'|'persiste'`.
5. Constrói `resolvidos[]` = anteriores sem similar no atual.

Aplicada no caminho COMPLETO antes de salvar. O `ComparativoAntesDepois` do frontend agora **sempre** funciona, mostrando saíram/entraram/persistem mesmo em auditorias forçadas.

#### Bônus: `_fecharBacklogResolvidos` também no caminho completo

Antes, só o incremental fechava backlog automaticamente. Agora o completo também — quando o reconciliador detecta um resolvido, qualquer risco/decisão registrado relacionado é marcado como resolvido. Fecha o ciclo: "registrei decisão sobre achado X → próxima auditoria reconhece e fecha X automaticamente".

#### Função auxiliar: `_similaridadeTitulos(a, b)`

Implementação pura V8/GAS (sem Sets pra suportar runtime antigo), retorna `0..1`. Reutilizável em futuras necessidades de deduplicação.

---

## [1.139.2] — 2026-06-21

### Corrigido — Botão de auditoria com label correto após hard-refresh

- **Após hard-refresh (Cmd+Shift+R), o botão do header mostrava "Nova auditoria" mesmo com sistema tendo histórico**. Causa: a condição usava `resultado` (estado de sessão React, vazio até o async carregar a última do banco), em vez de `dadosExibidos` (que combina resultado novo + última salva).

Pedido direto do usuário: "tudo que pode me ser oferecido depois que eu rodei a primeira vez deveria ser Rodar de Novo, não acha?" — sim, total. Conceitualmente o sistema só tem "primeira auditoria" UMA vez. Tudo depois é re-rodar.

**Fix**: 
- Botão header agora usa `dadosExibidos` em vez de `resultado` na condição. Mostra "Rodar de novo" assim que detecta qualquer auditoria salva (sessão atual OU histórico).
- Mensagem "Você está vendo o resultado salvo. Clique em **Nova auditoria**" corrigida pra "Clique em **Rodar de novo**" (consistência com o botão).

---

## [1.139.1] — 2026-06-21

### Corrigido — "Rodar de novo" agora força re-análise de verdade (não usa cache)

- **Bug crítico de UX**: clicar em "Rodar de novo" no header do drawer disparava `auditar()` sem o flag `forcar=true`. Resultado: quando o código do repositório não tinha mudado, o backend retornava a última auditoria do cache (linha 13477 de server.ts: `return { ok: true, data: Object.assign({}, ult.data, { semMudanca: true }) }`). A IA NUNCA re-analisava governança.

Caso real que descobriu o bug: usuário preencheu o campo `urlProd` na ficha + registrou Decisão arquitetural + clicou "Rodar de novo" esperando que a IA detectasse essas melhorias. Mas a auditoria retornou o cache antigo idêntico (mesmos 6 achados, mesmos resolvidos/novos), só atualizando o score determinístico (+3 pts pela URL ativando o fator "Está acessível"). Sensação: "trabalhei e a Forja não viu".

**Fix**: botão "Rodar de novo" / "Nova auditoria" agora passa `forcar=true`. Ganhou também um Tooltip explicando: "Re-analisa TUDO do zero (código + governança), mesmo se o repositório não mudou. Use depois de preencher dados na ficha, registrar decisões/riscos ou quando quiser uma 2ª opinião."

Quem quiser o comportamento incremental (mais rápido e barato em LLM) continua usando o "Auditar mudanças" peach do banner de frescor, que só dispara quando o GitHub tem commits novos.

---

## [1.139.0] — 2026-06-21

### Mudado — Auditoria: rebalanceamento do score + prompt qualidade-primeiro

- **Score agora tem teto realista (soft cap perdoa primeiros 2 achados leves, penalizações suaves) + prompt da IA exige IMPACTO ao invés de quantidade.** Reação direta à observação do usuário após a v1.138.0: "preciso de um teto, sempre vai ter algo pra melhorar — talvez o prompt antigo não fosse tão eficiente, gera achados de pouco valor".

Aprendizado do caso real: usuário fechou 4 fixes via Cursor (security HIGH +
testes +94% cov + lint), score caiu 73 → 64 (fix da v1.138 que finalmente
fez achados pesarem). Frustração legítima: trabalho duro, ponteiro pra
baixo. Investigação confirmou que o cálculo era CORRETO mas SEVERO
demais — todo sistema saudável tem 1-2 TODOs naturais, não faz sentido
puni-los como se fossem dívida.

#### 1. Rebalanceamento do fator "Achados em aberto"

| Parâmetro | v1.138.0 | v1.139.0 |
|---|---|---|
| Max do fator | 15 pts | **10 pts** |
| Penalização alta | -5 | **-3** |
| Penalização média | -2 | **-1** |
| Penalização baixa | -1 | -1 (mantido) |
| Soft cap (perdoa primeiros leves) | não tinha | **2 baixas/médias perdoadas** |
| Max possível total | 115 | **110** |

Lógica do soft cap: perdoa primeiro as baixas (mais leves), depois médias.
Achados altos sempre pesam — são vulnerabilidades reais que precisam ser
fechadas. Médias e baixas têm o "buffer" de 2 perdoadas pra refletir que
backlog saudável != backlog vazio.

**Impacto pro caso do usuário** (1 alta + 4 médias + 1 baixa em aberto):
- v1.138.0: -5 -8 -1 = -14 → 1 pt → score 64
- v1.139.0: -3 -3 -0 = -6 (soft cap perdoa 1 baixa + 1 média) → 4 pts → score 70

Subiu 6 pts sem fechar nenhum achado novo. E **com 0 achados em aberto**,
sistema com governança 73 chega em 75 (versus 64 antes do fix v1.138.0).

#### 2. Prompt de auditoria: qualidade > quantidade

Ambos os prompts (completa + incremental) ganharam bloco novo de regras:

- **Sem mínimo de findings.** Aceito 0 se sistema não tiver problemas
  reais. Antes: forçava mínimo 3.
- **Critério de IMPACTO obrigatório.** Antes de listar, IA deve perguntar
  a si mesma: "Este achado tem impacto mensurável (segurança, dinheiro,
  tempo, manutenibilidade) OU é nitpicking estético?" Se for nitpicking,
  não lista.
- **Severidades com critério OBJETIVO** (documentado no prompt):
  - ALTA: vulnerabilidade, perda de dados, sistema indisponível, PII,
    custo descontrolado, blocker de negócio.
  - MEDIA: dívida técnica que limita evolução, deps com CVE, falta de
    monitoramento/testes em código crítico.
  - BAIXA: melhorias de DX que economizam tempo no longo prazo. **Usar
    COM PARCIMÔNIA** — sistema saudável não precisa ter achados baixos.
- **Campo `problema` exige IMPACTO explícito.** "Não está documentado"
  sozinho é rejeitado. Precisa "não está documentado, e isso faz X
  (custo/risco/atraso/dívida) acontecer".

Efeito esperado: próximas auditorias devem trazer findings mais
acionáveis e menos. Sistemas bem cuidados podem retornar 0-2 achados
em vez de inflarem pra 3-5 só por causa do mínimo.

---

## [1.138.0] — 2026-06-21

### Corrigido — Auditoria: score que não evoluía + 3 bugs visuais/lógicos

- **Score agora reflete achados de auditoria em aberto + drawer mais limpo + reconciliação anti-duplicidade.** Causa raiz: o cálculo de saúde era 100% determinístico em metadados (propósito, stack, URL, custos, alertas, riscos, MRR) e ignorava completamente os achados das auditorias. Resolver achado via re-auditoria não movia o ponteiro, quebrando a promessa "Auditar com AI → vejo progresso".

Aprendizado direto do caso real: usuário rodou a auditoria incremental
depois de o Cursor implementar 4 fixes (security HIGH + testes +94% cov
+ lint), e o score ficou idêntico (73 → 73). Frustração total — "agora
eu não vi mudanças nas visões sobre o que foi feito e o que falta".

Investigação revelou 4 bugs distintos:

#### Bug 1 — Header do drawer cobria o nome do sistema

Os 4 botões do `extra` (Histórico · Baixar .md · Limpar · Rodar de novo,
todos com texto+ícone) ocupavam tanta largura que sobrepunham a Tag
laranja com o nome do sistema. Em drawers de 720px ficava ilegível.

**Fix**: botões secundários viraram só ícones com `Tooltip`. Só o CTA
"Rodar de novo" mantém texto+ícone. Tag do nome ganhou `maxWidth: 180`
com `text-overflow: ellipsis` e tooltip pro nome completo.

#### Bug 2 (CAUSA RAIZ) — Score nunca refletia o trabalho da auditoria

`calcularSaudeReal` (forja/src/server.ts) tinha 10 fatores totalizando
100 pontos, todos derivados de metadados (sem qualquer leitura de
`Auditorias.payloadJson`). Achados eram informação paralela.

**Fix**:
- Novo fator **"Achados de auditoria em aberto"** (max 15 pontos).
  Começa em 15 e perde: -5 por achado HIGH aberto (cap 3 = -15),
  -2 por MEDIUM (cap 4 = -8), -1 por LOW (cap 3 = -3). Mínimo 0.
- Escala normalizada: `score = (totalPontos / maxPossivel) * 100`.
  Max possível subiu de 100 → 115. Sistemas existentes podem oscilar
  ±3 pts por causa da normalização — esperado e estável.
- `calcularSaudeReal(sistemaId, payloadOverride?)` ganhou 2º
  parâmetro opcional. `_executarAuditoriaIncremental` e o caminho
  completo de auditoria passam o `parsed.payload` direto — assim o
  score já reflete os achados RECÉM-reconciliados em vez dos antigos
  ainda no banco (que só são sobrescritos linhas depois).

Impacto prático: o Cursor fechou um HIGH (security) e dois LOWs em re-
auditoria → score sobe +5+1+1 = +7 pts imediatamente. O ponteiro mexe.

#### Bug 3 — Mesmo achado aparecia em "resolvidos" E em "novos"

Caso real: "URL de produção não registrada" (resolvido) +
"URL de produção não registrada na Forja (campo urlProd vazio)" (novo).
Mesma causa-raiz, redação ligeiramente diferente, criando confusão.

**Fix**: prompt de reconciliação ganhou bloco **ANTI-DUPLICIDADE**
explícito com exemplo concreto: "se um achado está em 'resolvidos',
você NÃO pode criar achado novo cuja CAUSA-RAIZ seja a mesma — escolha
UM dos dois lados". Antes de marcar como NOVO, IA deve checar se a
DIMENSÃO é genuinamente diferente.

#### Bug 4 — Falta de transparência sobre o escopo da reconciliação

Usuário esperava que TODOS os achados históricos fossem reconciliados;
na verdade, só os da ÚLTIMA auditoria entram. Os de auditorias mais
antigas (fechadas ou substituídas) ficam de fora — comportamento
correto, mas não comunicado.

**Fix**: faixa do comparativo "Antes vs Agora" ganhou indicador
**"escopo: N achados anteriores"** com tooltip explicando que só a
última auditoria entra, e que isso é o esperado.

---

## [1.137.0] — 2026-06-21

### Adicionado — Auditoria: detector de docs-only + .md fortalecidos pra não confundir IA externa

- **Detector automático de docs-only + textos fortalecidos** — quando o diff só tem arquivos não-código (.md, configs), aparece alerta peach com "Copiar prompt corretivo" pronto. Prompts master e relatório de baixa reforçados pra não deixar mais a IA externa documentar em vez de implementar.

Aprendizado direto do caso real: usuário levou o `auditoria-realizada.md`
pro Cursor pedindo pra "seguir as instruções dentro", e o Cursor criou 2
commits `docs:` consolidando análise em vez de implementar correções no
código. A Forja, ao re-auditar, viu praticamente o mesmo estado e o
usuário ficou confuso achando que o sistema estava com bug.

Causa raiz: o `.md` original podia ser interpretado como ordem de gerar
documentação, e a Forja não tinha como detectar/avisar.

Esta versão fecha as 3 brechas.

#### 1. Backend: detector automático de docs-only

`getStatusAuditoriaCodigo` agora retorna 3 campos novos:
- `arquivosMudadosTotal: number` — quantos arquivos TOTAL mudaram no diff
  (antes só contava os de código).
- `mudancasSaoDocsOnly: boolean` — true quando o total > 0 mas o filtro
  `_codeArquivoRelevante` exclui todos (ou seja, mudou só .md / .txt /
  configs / paths como `docs/`).
- `listaDocsMudados: string[]` — amostra dos primeiros 8 arquivos
  não-código pra mostrar exemplos no alerta.

#### 2. Frontend: alerta `DocsOnlyAlerta` (peach)

Renderizado logo após o banner de status (antes do hero). Mostra:
- Título: "A última rodada só teve commits de documentação".
- Descrição: "N arquivos mudaram mas nenhum é de código. Isso geralmente
  significa que a IA externa analisou/documentou em vez de implementar".
- Lista dos arquivos `.md` / docs detectados (até 5).
- Botão primário **"Copiar prompt corretivo"** — copia uma instrução
  pronta pro Cursor implementar de verdade. Inclui regras: 1 commit
  por correção, prefixos `fix:` / `feat:` / `refactor:` (NÃO `docs:`),
  proibição de criar mais .md.

#### 3. `prompt-de-ajustes.md` reforçado

Seção "Instruções para a IA" reescrita como ORDEM DE SERVIÇO clara, com
5 regras não-negociáveis no topo:
- O entregável é CÓDIGO, não documentação.
- Cada correção = 1 commit `fix:` / `feat:` / `refactor:` (NUNCA `docs:`).
- Proibido criar arquivos `.md` consolidando ou analisando achados.
- Falso positivo → cita na conversa, não faz commit.
- `git push` ao final + aviso "implementei N, push feito".

#### 4. `auditoria-realizada.md` reforçado

Subtítulo virou "**RELATÓRIO de baixa (não é ordem de serviço)**", com aviso
proeminente no topo: *"⚠ LEIA PRIMEIRO — Este arquivo NÃO é uma ordem
para escrever código. É relatório de status pra você atualizar planning/
backlog interno. Não crie arquivos .md, não escreva código, não faça
commits a partir deste documento."*

Instruções da seção "Para você, IA" reescritas pra deixar inequívoco
que a tarefa é APENAS atualizar planning interno — código mexe-se a
partir do `prompt-de-ajustes.md`, não daqui. Adicionada regra 6 explícita:
*"Se você concluir o trabalho com base SÓ neste arquivo (criando .md,
escrevendo análise, fazendo commits docs:) → você fez ERRADO."*

#### Resultado prático

- Próxima vez que o Cursor (ou outra IA) confundir os dois papéis e só
  documentar, a Forja detecta e te avisa **antes mesmo de você abrir os
  detalhes da auditoria**.
- Com 1 clique você copia um prompt corretivo já pronto e cola no Cursor
  pra ele finalmente implementar.
- E ainda: os próximos `.md` gerados não vão deixar margem pra confusão
  na origem.

---

## [1.136.0] — 2026-06-21

### Melhorado — Auditoria: Comparativo Antes vs Depois + Ação Principal focal

- **Comparativo Antes/Depois 2 colunas + Ação Principal única** — re-auditorias mostram lado a lado o estado anterior e o atual com Resolvidos/Novos no meio. CTAs do hero foram substituídos por UM card de ação que escolhe automaticamente qual .md baixar baseado no momento (primeira auditoria → prompt; re-auditoria → baixa).

Pedido direto do usuário após sequência de iterações que empilharam complexidade:
*"O que eu queria era algo bem simples. Auditei a primeira vez, encontrei 10 coisas, gerei o prompt. Quando eu voltar ele me mostra o antes e depois, só isso."*

#### Componente `ComparativoAntesDepois` (substitui `MudancasDesdeUltima`)

Renderizado SÓ em re-auditorias (histórico ≥ 2). Mostra:

- **Faixa fina no topo**: "Comparando · {N} fechados / {M} novos · [delta pill]"
- **2 colunas lado a lado**:
  - **Antes** (commit base, "há X horas") — score grande, contagem de
    achados, commit SHA.
  - **→** seta visual conectando.
  - **Agora** (recém-auditado) — score, contagem, badge "melhorou" /
    "piorou" se aplicável.
- **Listas em 2 painéis abaixo** (quando houver):
  - **Resolvidos · saíram (N)** — fundo sage, check verde.
  - **Novos · entraram (N)** — fundo peach, marcador `+` com severidade.
- **Linha discreta** sobre achados que persistem ("X persistem · veja em
  Achados detalhados abaixo") sem poluir.

#### Componente `AcaoPrincipal` (substitui os 2 sub-blocos do Hero)

Hoje o hero tinha 2 sub-blocos competindo: "Prompt de ajustes" + "Relatório
de baixa". Confuso porque só um faz sentido por vez. Agora é UM card focal:

- **Primeira auditoria** (peach, ícone Rocket): "Próximo passo: implementar
  as correções" + botão grande "Baixar prompt de ajustes (.md)" +
  "Copiar prompt".
- **Re-auditoria** (sage, ícone ClipboardCheck): "Próximo passo: avisar a
  IA o que foi resolvido" + botão grande "Baixar relatório de baixa (.md)" +
  botão discreto "Também baixar prompt p/ novos achados".

Cada momento do ciclo tem 1 ação óbvia. A alternativa fica disponível mas
em segundo plano.

#### Hero simplificado

`ResultadoHero` agora é só medidor de estado (score grande + delta pill +
severidades + metadados de modelo/tempo). Sem CTAs dentro — eles vivem
no card `AcaoPrincipal` logo abaixo, com contexto próprio.

#### Nova ordem visual

1. Header (Histórico, Baixar .md, Limpar, Rodar de novo)
2. Tabs scope (Completa / Código / Governança)
3. Banner status (em dia / mudou + botão Auditar)
4. **Hero** — score + delta + severidades (compacto, sem CTAs)
5. **Comparativo Antes/Depois** (só re-auditorias)
6. **Ação Principal** (card focal com 1 CTA)
7. Banners contextuais (onboarding, incremental, fechados-auto) se aplicáveis
8. **Achados detalhados** (sempre aberto)
9. Mais detalhes técnicos (colapsados): Fontes, Estado geral, O que empolga,
   Próximos passos, Composição do Score

#### Por que essa estrutura

- Olhar de cima → primeiro entende ESTADO (hero).
- Em seguida vê O QUE MUDOU (comparativo).
- Sabe imediatamente O QUE FAZER A SEGUIR (ação principal).
- Detalhes profundos ficam um clique de distância.

---

## [1.135.0] — 2026-06-21

### Melhorado — Auditoria: drawer enxuto com sections colapsáveis

- **Drawer da auditoria enxuto** — Estado geral, O que empolga, Próximos passos, Composição do Score e Fontes consultadas viram colapsáveis (fechados por padrão), reduzindo o scroll inicial drasticamente. Achados detalhados continuam abertos por padrão (é o coração do trabalho), mas também viraram colapsáveis pra quem já leu fechar.

Conforme a auditoria foi ganhando mais blocos (delta, mudanças desde a
última, relatório de baixa), o drawer ficou enorme. Agora a primeira
visualização cabe em uma tela e o usuário expande só o que importa.

#### Sections colapsáveis (novo padrão de drawer)

`Section` ganhou três props:
- `collapsible?: boolean` — habilita chevron + clique-pra-toggle no header.
- `defaultOpen?: boolean` — estado inicial (default `true`).
- `badge?: string | number` — micro-contagem ao lado do título
  (ex: "Achados detalhados (7)"), pra dar pista do tamanho sem precisar abrir.

#### Estado inicial das seções (após o hero + Mudanças desde a última)

Aberto por padrão:
- **Achados detalhados** (N) — coração do trabalho; mas agora pode fechar
  com um clique pra quem já registrou todos.

Fechado por padrão:
- **Estado geral** — narrativa qualitativa, longa.
- **O que empolga** — positivo mas não acionável.
- **Próximos passos estratégicos** — orientação geral redundante com findings.
- **Composição do Score de Saúde** — detalhe técnico; o número grande já
  está no hero. Quem quer entender "por que 73?" abre.

#### Fontes consultadas pela IA — agora colapsado com resumo inline

O bloco "Fontes" também colapsa, mas mantendo o **resumo na linha do header**
quando fechado: "4/4 metadados · 0/5 backlogs com dados". O bloco
**"Código lido / diff truncado" continua sempre visível** abaixo dos chips —
ele carrega o aviso crítico que afeta a leitura dos resolvidos e não deve
ficar escondido.

#### Resultado

- Antes: ~6-7 sections abertas após o hero ≈ scroll longo.
- Agora: 1 section aberta (Achados) + 4-5 sections fechadas em uma linha
  cada ≈ drawer cabendo numa viewport típica.

---

## [1.134.0] — 2026-06-21

### Adicionado — Auditoria: relatório de baixa pra fechar o ciclo Forja ↔ IA

- **Relatório de baixa (auditoria_realizada.md)** — novo .md gerado ao final de toda auditoria, com instruções diretivas pra IA externa atualizar o backlog: marca resolvidos, mantém persistentes, adiciona novos.

Fecha o ciclo Forja → IA → Forja → IA sem ambiguidade. A IA que executou as
correções recebe um documento oficial dizendo exatamente o que foi fechado,
o que persiste e o que apareceu de novo — não precisa adivinhar.

#### O que o .md contém

- **Cabeçalho técnico**: origem (Forja IA), sistema, tipo da auditoria
  (baseline/incremental/completa), repositório, range de commits auditado
  (`base → head`), volume lido pela IA (arquivos, KB, flag de truncado),
  score atual com delta vs. anterior.
- **Instruções diretivas** pra IA externa (5 regras numeradas):
  marcar como concluído, manter em aberto, adicionar ao backlog, não
  inventar, e o que fazer quando um item não foi marcado como resolvido
  mesmo após o fix (verificação manual).
- **Tabela de saldo** com métricas numéricas: achados anteriores, resolvidos,
  persistem, novos, total atual, score com delta.
- **Checklists Markdown padrão**:
  - `## Resolvidos pela Forja IA` — `- [x] título` (pra IA marcar feito)
  - `## Persistem em aberto` — `- [ ] título` + problema/evidência/solução
  - `## Novos detectados nesta rodada` — `- [ ] título` + detalhes
- **Estado geral + próximos passos** sugeridos pela Forja IA.
- Fallback pra auditorias antigas (sem campo `origem`): mostra como
  "Achados abertos atuais".

#### Como o usuário usa

1. Roda a auditoria na Forja.
2. Baixa o **"Prompt de ajustes .md"** (passo 1 do hero).
3. Cola na IA executora (Cursor/Claude) — ela implementa as correções.
4. Roda a auditoria na Forja de novo (incremental).
5. Baixa o **"Relatório de baixa .md"** (passo 2 do hero) e entrega à mesma
   IA — ela atualiza o backlog/planning dela.

#### UX do hero

O bloco de CTAs foi reorganizado em 2 sub-blocos visuais separados, cada
um marcando o **momento do ciclo**:

- **Sub-bloco 1 — "Prompt de ajustes"** (peach, ícone Rocket, etiqueta
  "antes do fix"): botão primário "Baixar prompt .md" + "Copiar prompt".
- **Sub-bloco 2 — "Relatório de baixa"** (sage, ícone ClipboardCheck,
  etiqueta "depois do fix"): botão primário "Baixar baixa .md" +
  "Relatório completo .md" (movido pra cá pra desafogar o bloco 1).

#### Quando aparece

Sempre que há auditoria concluída — inclusive na primeira (que só tem a
lista "Achados detectados"), pra a IA externa já abrir o backlog inicial
com base no baseline.

---

## [1.133.0] — 2026-06-21

### Melhorado — Auditoria: transparência total sobre o que o LLM viu

- **Transparência da auditoria** — badge de "diff truncado" quando o LLM não viu tudo, e tags `novo`/`persiste` em cada finding pra entender por que o n.º de "resolvidos" pode parecer menor que o n.º real de correções.

Continuação do trabalho de feedback iniciado em `1.132.0`: agora ataca a dor
de *"rodei 27 correções e ele só viu 2 resolvidos"* mostrando explicitamente
o que o LLM analisou.

#### Por que esse problema existe

Os dois números diferentes são fáceis de confundir:

- **N. de correções aplicadas no código**: ex. 27 arquivos tocados pelo Cursor
- **N. de achados resolvidos**: dos N achados originais (ex. 4), quantos o
  diff fechou — porque cada achado vira ~5-10 alterações de código distintas

Quando o diff é grande, ainda tem um terceiro fator: o conteúdo enviado à
IA pode ter sido **truncado por limite de contexto**, e correções no trecho
cortado não são reconhecidas.

#### O que muda na UI

- **Badge "diff truncado — IA não viu tudo"** no bloco de Fontes consultadas,
  em peach com ícone de alerta, quando `codigoTruncado=true`. Tooltip explica
  o impacto na detecção de resolvidos e sugere rodar auditoria completa.
- **Texto contextual**: "Diff lido de GitHub · 28 arquivo(s) · ~108KB" em vez
  do genérico "Código lido de" quando a auditoria é incremental.
- **Tags `novo` / `persiste` em cada FindingCard** — já existiam no payload
  (campo `origem`) e na renderização, agora ficam visíveis em todas as
  auditorias incrementais. Resolve o "esse achado é novo ou já era assim?"
  com um olhar.

#### Quando rodar auditoria completa

Se você fez muitas mudanças estruturais (refatorações grandes, mudança de
arquitetura) e o reconciliador parece estar perdendo correções, o caminho
é usar **"Auditar mesmo assim"** quando o status é "em dia" — força uma
varredura completa que ignora o histórico e re-lê o repo do zero.

---

## [1.132.0] — 2026-06-21

### Melhorado — Auditoria: feedback claro sobre o que mudou entre runs

- **Auditoria com feedback claro entre runs** — delta do score no hero, card "Mudanças desde a última auditoria" e celebração visual dos resolvidos.

Antes, quando você corrigia issues e rodava "Auditar mudanças" de novo, a UI
não te dava feedback do esforço: o score continuava igual, os contadores
pareciam idênticos, e a lista de "Resolvidos" vivia enterrada como texto
riscado lá embaixo. A IA reconciliava certo — mas a interface escondia.

Agora o trabalho feito vira primeira leitura.

#### No hero do resultado

- Pill de delta do score ao lado do título — `↑ +8 pts` em sage quando
  melhorou, `↓ -5 pts` em rose quando caiu, escondido quando não mudou.
- Tooltip mostra o score anterior pra contextualizar a variação.

#### Novo card "Mudanças desde a última auditoria" (entre hero e banners)

- **3 stats lado a lado**: Resolvidos, Novos detectados, Saldo total
  (antes → agora). Resolve o mistério do "resolvi 2 mas o total ficou igual"
  — mostra explicitamente que surgiram 2 novos.
- **Tom geral colorido** pelo desfecho: sage quando você avançou, peach
  quando ficou neutro/empate, rose quando o diff piorou o quadro.
- **Título contextual**: "Você avançou no diff", "Saldo zero: você resolveu
  mas surgiram novos", "Surgiram mais achados que resolvidos" ou
  "Sem alterações detectadas".
- **Lista celebratória dos resolvidos** dentro do mesmo card, com check verde
  e fundo sage — sai do tom postmortem riscado e vira conquista visível.

#### Quando aparece

O card só renderiza se temos ≥2 auditorias no histórico OU pelo menos 1 item
resolvido. Primeiras auditorias seguem limpas, sem ruído extra.

#### Por que isso muda o uso

- O ciclo "rodar IA → aplicar fix → re-rodar IA" agora fecha com um momento
  claro de feedback ("você resolveu 2!").
- Quando o score parecer "estagnado", a UI te diz o motivo (novos achados
  apareceram) em vez de só mostrar o número final.
- A "celebração" dos resolvidos vira parte do hero do resultado, não uma
  section escondida no rolar.

---

## [1.131.0] — 2026-06-20

### Adicionado — Financeiro v2: ficha rica do cliente + Pipeline comercial + cross-links

Quatro frentes que transformam o módulo financeiro em algo profundo e navegável:

#### Ficha financeira do cliente (Snapshot drawer)

- Nova section **"Histórico financeiro"** (estimado) no drawer do cliente com:
  - 4 KPIs adicionais: **LTV estimado**, **Ticket médio**, **Cliente desde**
    (com "há X meses"), **Pendências** (qtd + valor em atraso).
  - **Linha do tempo de cobranças** filtrável por status (Todas/Pagas/Atrasadas/
    Futuras) e por ano. Cada cobrança mostra status com ícone, plano, data e valor.
  - **Tag "estimado"** com tooltip explicando o trade-off: o schema atual de
    `Receitas` não loga eventos de pagamento individuais; a timeline é derivada
    de `inicio` + `recorrencia` + `canceladaEm` + `valor`.

#### Saúde financeira do cliente (FASE 2)

- Novo cálculo automático de **saúde** por cliente derivado das receitas com
  `proximaCobranca` vencida e status `ativa`:
  - 🟢 **Em dia** — sem cobranças atrasadas
  - 🟡 **Atenção** — atraso ≤ 15 dias
  - 🔴 **Inadimplente** — atraso > 15d OU 3+ cobranças pendentes
  - ⚪ **Sem histórico** — cliente sem receitas
- Nova coluna **Saúde** na tabela de Clientes (filtrável e ordenável).
- **Badge no header** do snapshot drawer mostrando saúde + valor em atraso.

#### Pipeline comercial (FASE 3)

- Nova aba **Pipeline** dentro de Clientes, ao lado de Contatos e Radar.
- **Kanban** com 4 colunas: Lead → Em conversa → Proposta enviada → Em negociação.
- Cards mostram: empresa, ticket previsto, próxima ação, origem do contato.
- **Drag-and-drop nativo** (HTML5, sem deps novas) atualiza o `statusComercial`
  com optimistic update e rollback em caso de erro.
- **KPIs no topo**: total em pipeline, valor ponderado (× probabilidade do
  estágio), ticket médio, conversão histórica (ativos / (ativos+perdidos)).
- Filtro por **origem do contato** (Indicação, Instagram, Evento etc).
- Click no card abre o snapshot drawer completo do cliente.

#### Cross-links Cliente ↔ Financeiro (FASE 4)

- Em **Financeiro → A receber**:
  - Novo **filtro por cliente** no topo da tabela de assinaturas.
  - Coluna **Cliente** virou link clicável que abre o snapshot drawer inline.
  - Botão **"Abrir ficha"** quando um cliente está filtrado.
- `getPessoas` agora retorna campos derivados (`saude`, `pendenciasQtd`,
  `pendenciasValor`) calculados a partir das receitas.

### Técnico

- Nova função interna `_calcularSaudePessoa(receitas)` compartilhada entre
  `getPessoas` e `snapshotCliente` (DRY).
- `ClienteSnapshotPayload` ganhou `historicoCobrancas[]`, `kpis.ltvEstimado`,
  `kpis.ticketMedio`, `kpis.clienteDesde`, `kpis.pendenciasQtd`,
  `kpis.pendenciasValor`, `kpis.saude`.
- `Pessoa` ganhou campos derivados read-only: `saude`, `pendenciasQtd`,
  `pendenciasValor`.
- `STATUS_COMERCIAL_OPTIONS` e `ORIGEM_LABEL_MAP` exportados de `PessoasView`
  pra reuso em `PipelineComercial`.
- Novas constantes `PIPELINE_ESTAGIOS` com probabilidade por estágio
  (Lead 10% → Conversa 25% → Proposta 50% → Negociação 75%).

## [1.130.1] — 2026-06-20

### Melhorado — Respiro pós-assinatura na marca FORJA

- **Sidebar**: padding inferior do bloco de marca passou de `20px` → `36px`,
  dando ar entre a assinatura "Inteligência de Negócios" e o campo de Busca.
  Gaps internos da marca também ficaram mais generosos (filete `9→11`, slogan
  `8→10`).
- **Onboarding**: gap entre a assinatura e o título "Bem-vindo ao seu QG"
  passou de `18px` → `28px`.
- **Public form**: o gap interno do Brand (wordmark → filete → assinatura)
  ficou levemente mais largo no modo hero (`7→10/11px`) pra manter o ritmo
  visual consistente entre superfícies.

## [1.130.0] — 2026-06-20

### Melhorado — Identidade visual unificada (wordmark editorial + filete dourado)

- **Marca FORJA refinada em todas as superfícies** — adotada a "Opção B"
  (wordmark editorial), aplicada de forma consistente em sidebar, topbar mobile,
  onboarding, landing page e formulário público (Discovery):
  - **Tipografia mais apertada** (letter-spacing de `0.22em` → `0.08em` no app,
    `0.26em` → `0.18em` na landing) — wordmark ganha peso e autoridade.
  - **Filete dourado** (linha em gradiente peach→transparente) embaixo do
    wordmark — ancora a marca como um selo de masthead editorial (NYT,
    MIT Tech Review). Largura/intensidade adaptadas por superfície.
  - **Assinatura "Inteligência de Negócios"** uppercase com letter-spacing
    `0.28em` substitui o slogan italic anterior no sidebar/onboarding;
    landing mantém a poética "Onde ideias ganham forma" + filete.
  - **Brasa viva** preservada onde já existia (sidebar, topbar, landing) —
    continua sendo indicador funcional de atividade, agora ao lado do
    wordmark refinado.
- **Removido** o "F em quadradinho gradiente" do formulário público — substituído
  pela mesma marca editorial. Sem ícone-mark; tipografia faz o trabalho.

## [1.129.1] — 2026-06-20

### Melhorado — UX premium da capa do Discovery + UF como Select

- **Capa do Discovery público redesenhada**:
  - Marca da Forja vira hero único na intro (some a duplicação da marca pequena
    do topo-esquerdo só nessa tela; ela reaparece nas demais).
  - Hierarquia: brand (56px) → kicker (mais espaçado) → saudação (leve, fora do
    peso) → título (até 46px, letter-spacing negativo) → subtítulo → CTA.
  - Subtítulo reescrito pra não duplicar o título ("Algumas perguntas pra entender
    como vocês trabalham hoje…").
  - Microcopy do rodapé virou linha com bolinhas separadoras (~3 min · a maioria
    é só clicar · respostas confidenciais).
- **Campo UF** no cadastro do cliente agora é Select com os **27 estados** (26 + DF),
  searchable por sigla ou nome.

## [1.129.0] — 2026-06-20

### Adicionado — Ficha rica do cliente (4 seções) + saudação personalizada no Discovery

- **Schema**: `Pessoas` ganha 17 novos campos opcionais:
  - **Pessoa de contato**: `nomeContato`, `cargo`, `telefone`
  - **Empresa**: `empresa`, `cnpj`, `segmento`, `cidade`, `uf`, `site`, `instagram`
  - **Negócio**: `faturamentoFaixa`, `funcionariosFaixa`, `tempoOperacaoAnos`
  - **Financeiro/Comercial**: `ticketPrevisto`, `statusComercial`, `origemContato`, `proximaAcao`
  - `SCHEMA_VERSION` → `v1.63-pessoa-ficha-rica` (migração suave, dados antigos preservados).
- **Modal de cadastro**: agora seccionado (Collapse) com as 4 seções acima — Pessoa e Empresa
  abertas por padrão; Negócio e Comercial recolhidas para não intimidar. Selects pra
  faixas (faturamento, funcionários, status comercial, origem).
- **Tabela de clientes** mostra **Empresa** como destaque + nome do contato/cargo
  logo abaixo, colunas separadas pra email/telefone, segmento e status comercial.
- **Discovery público** agora saúda pelo primeiro nome do contato:
  - "Olá, **Simara** 👋"
  - "Vamos desenhar juntos o sistema ideal da **AC Contabilidade**."
- **Pré-preenchimento**: o nome do contato já aparece no campo "Seu nome" no fim
  do formulário, evitando redigitação.
- Migração: o `nome` antigo continua exibido como fallback se `empresa` estiver vazia.
  Ao salvar, o `nome` é sincronizado automaticamente com `empresa || nomeContato`
  pra manter compatibilidade.

## [1.128.0] — 2026-06-20

### Mudado — "Baixar briefing" no lugar de Imprimir + .md (com Discovery completo)

- **Removido o botão Imprimir** (baixo valor, fragil; pra PDF o usuário usa o
  Cmd+P do navegador).
- **".md" virou "Baixar briefing"** (botão primário, único): agora gera um
  documento único contendo:
  - Identidade do cliente, financeiro com a Forja, sistemas em operação,
    próximas cobranças, oportunidades, entrevistas registradas e alertas
    (como antes);
  - **NOVO — Discovery completo**: todos os roteiros aplicados àquele cliente
    (com blocos/perguntas, datas) e **todas as respostas** que ele deu
    (com score, ferramentas, e cada pergunta-resposta vinculada ao enunciado);
  - **Instrução final** ensinando a colar o briefing na IA pra construir o app.
- Subtítulo do drawer atualizado: "Ficha completa · Snapshot + Discovery".
- Arquivo passa a se chamar `briefing-<cliente>-<data>.md`.

## [1.127.0] — 2026-06-20

### Adicionado — Opção "Outro" em listagens do formulário público

- **Prompt de estruturação**: AI passa a incluir SEMPRE `Outro` como última opção
  em perguntas de listagem não-exaustiva (sistemas, ferramentas, marcas, etc.) e
  gera de 3 a 6 opções (mais a "Outro" quando aplicável).
- **Form público**: ao escolher `Outro` em `unica` ou `multipla`, abre um campo de
  texto inline pra digitar (sem quebrar o ritmo). O valor é enviado como
  `"Outro: <texto digitado>"`.
- **Roteiros antigos**: o normalizador do form público auto-injeta `Outro` em
  listas `unica`/`multipla` com 2+ opções que ainda não tinham — assim
  formulários já publicados ganham o campo aberto na hora, sem republicar.

## [1.126.3] — 2026-06-20

### Adicionado — Data/hora nos discoveries e respostas

- Cards de **discovery** (dentro do cliente e no Radar) mostram **criado em dd/mm/aaaa hh:mm**
  e, quando publicado, **publicado em dd/mm/aaaa hh:mm**.
- Cards de **respostas recebidas** mostram **data/hora do envio**.
- Fica fácil saber a ordem cronológica do que foi gerado e quando o cliente respondeu.

## [1.126.2] — 2026-06-20

### Melhorado — Abrir cliente direto pelo nome (e linha clicável)

- O nome do cliente na lista de Contatos agora é um **link clicável** que abre a ficha
  (snapshot + discovery). Hover em azul, tooltip explica.
- Toda a **linha da tabela** também é clicável (cursor pointer), exceto cliques em
  botões de ação dentro dela. Acabou o atalho escondido só no ícone do caderno.

## [1.126.1] — 2026-06-20

### Corrigido — Discovery do cliente sempre visível na ficha

- Dentro do cliente (Contatos → abrir → aba Discovery), os painéis "Discoveries deste
  cliente" e "Respostas recebidas" agora **renderizam sempre**, com empty state claro
  quando vazios ("Nenhum discovery salvo aqui ainda. Gere acima e clique em Salvar
  em [Cliente]"). Antes os painéis sumiam quando vazios e dava a impressão de que
  os roteiros salvos só apareciam no Radar.
- Adicionado contador (`Tag`) ao lado do título dos dois painéis.
- Botão de salvar agora rotula explicitamente "Salvar em [Cliente]" em modo embutido.

## [1.126.0] — 2026-06-20

### Adicionado — Gerenciar/apagar discoveries no Radar

- **Painel "Discoveries criados"** no Radar de oportunidades: lista TODOS os roteiros/
  formulários (rascunho e publicado), com cliente, status, nº de perguntas e respostas.
  Cada item permite **Publicar/Republicar, copiar Link, Abrir** (vai pra ficha do
  cliente na aba Discovery) e **Remover** (Popconfirm; as respostas já recebidas
  continuam guardadas). Resolve a falta de uma visão global do que já foi feito + apagar.

## [1.125.0] — 2026-06-20

### Mudado — Discovery por cliente + Radar de oportunidades (híbrido)

- **Discovery agora vive dentro de cada cliente**: em Clientes → Contatos, o botão de
  abrir o cliente traz um seletor **Snapshot · Discovery**. Na aba Discovery você gera
  o roteiro, salva, publica o link e vê as respostas + score **sem precisar selecionar
  o cliente toda vez** — tudo já no contexto dele (a "pasta" completa do cliente).
- **Aba global virou "Radar de oportunidades"**: no lugar do antigo Discovery global
  (com seletor), agora há um painel que ranqueia **todas as respostas por score**, mostra
  ferramentas, quem quer amostra, e abre o cliente direto na aba Discovery. Inclui a
  seção "Publicados aguardando resposta" e a configuração do app público.
- **Componente `Discovery` parametrizado** por `pessoaId`: em modo embutido, filtra
  roteiros/respostas/entrevistas do cliente e injeta o cliente automaticamente ao salvar.
- Sem mudança de schema — só reorganização de UX/navegação.



### Melhorado — Discovery focado no sistema do cliente + marca no formulário

- **Perguntas com a régua mais alta**: o prompt agora mira EXTRAIR TUDO sobre o
  sistema/ferramentas/rotina que o cliente usa hoje (telas, funções, o que ama/odeia,
  o que é manual, relatórios que faltam, integrações, volume, jornada ponta a ponta,
  o que seria mágico) — base direta pro app novo em vibe code. Pede exemplos concretos
  e convida a compartilhar prints do sistema atual. Tuned pra negócios não-software.
- **Estruturação equilibrada**: perguntas profundas sobre o sistema viram `texto_longo`
  (resposta rica); qualificação rápida segue clicável. Campos-chave marcados como
  obrigatórios.
- **Formulário público com presença de marca**: "FORJA · Inteligência de Negócios"
  no topo, capa premium saudando o cliente pelo nome, rodapé e tela final com a marca
  + botão **"Enviar outra resposta"**.

## [1.123.0] — 2026-06-20

### Adicionado — Conectar o app público pela própria Forja

- **Configuração do app público na UI**: banner em "Roteiros salvos" pra colar a
  URL `/exec` do formulário público e salvar (`DISCOVERY_PUBLIC_URL`) sem mexer em
  Script Properties. Depois de conectado, o botão **Link** copia `…/exec?f=TOKEN`.
- O projeto público (`forja-public/`) passou a **localizar a planilha da Forja pelo
  nome** (roda como o dono) — dispensa configurar `FORJA_SHEET_ID` na mão.

## [1.122.0] — 2026-06-20

### Adicionado — Promover resposta de Discovery a Ideia

- **"Promover a ideia"** no card de cada resposta recebida: cria uma Ideia no banco
  já com contato, ferramentas, respostas e **impacto sugerido pelo score** (score/10).
  Fecha o ciclo oportunidade → ideia priorizável.

## [1.121.0] — 2026-06-20

### Adicionado — Discovery Leva 2: formulário público estruturado (estrutura na publicação)

Prepara o app principal pro formulário público (projeto separado `forja-public/`).

- **Estruturação na publicação**: ao **Publicar** um roteiro, a IA converte as
  perguntas (texto) em **campos clicáveis** (sim/não, escala 1–5, única, múltipla
  ou texto), priorizando clique. Idempotente e com fallback pra texto se a IA falhar.
- **`forja-public/`** (novo, fora do app): projeto Apps Script anônimo que serve o
  formulário React progressivo (1 pergunta por vez, capa, e-mail como chave,
  ferramentas, "quer amostra" + agenda) e grava na mesma planilha. Inclui runbook
  de setup (`README.md`) e o motor de score replicado.
- **Segurança**: superfície pública mínima (só `doGet` + 2 funções), entrada
  validada/truncada, rate-limit por token e teto de respostas por formulário.

## [1.120.0] — 2026-06-20

### Adicionado — Discovery: roteiro salvo por cliente + base do formulário público

Leva 1 da evolução do Discovery. O roteiro gerado pela IA **deixa de se perder**:
agora é salvo e vinculado ao cliente, com base de dados pronta pro formulário
público (Leva 2).

- **Bug corrigido**: o roteiro gerado só vivia na tela. Adicionado seletor de
  cliente + **"Salvar no cliente"** no card do roteiro.
- **Roteiros salvos**: novo painel lista os roteiros por cliente, com status
  (rascunho/publicado), contagem de perguntas/respostas, **Publicar** (gera token)
  e **copiar link** (quando o app público estiver configurado).
- **Respostas recebidas**: painel que mostra as submissões do formulário público
  com **score de oportunidade** (0–100), ferramentas usadas, "quer amostra" e
  agenda — pronto pra receber os dados da Leva 2.
- **Modelo de dados**: novas sheets `DiscoveryForms` e `DiscoveryRespostas`;
  coluna `email` em `Pessoas` (chave do cliente). `SCHEMA_VERSION` → `v1.62`.
- **Segurança**: a superfície pública será um **projeto Apps Script separado**
  (a Forja continua privada e intocada) — decisão registrada para a Leva 2.

## [1.119.0] — 2026-06-20

### Corrigido — Significado dos estágios consistente

O dashboard descrevia Têmpera/Prateleira ao contrário do formulário de edição
(e da metáfora da forja). Agora tudo segue o mesmo ciclo:
**Faísca → Forja (dev) → Têmpera (no ar/produção) → Prateleira (pausado/aposentado)**.

- **Dashboard**: Têmpera agora é "No ar / em produção" (verde sage); Prateleira é
  "Pausado / aposentado" (cinza) — alinhado ao `StageBadge` e ao formulário.
- **Exemplo Mermaid** e prompt de contexto da IA reescritos com o ciclo correto.
- **Bug**: "Pular sistemas aposentados" (auditoria agendada) checava o estágio
  `aposentado`, que não existe — o valor real é `prateleira`. Agora pula de fato
  os sistemas em Prateleira.

---

## [1.118.0] — 2026-06-20

### Mudado — Botão "Auditar mudanças" pulsa quando há diff

Quando o repositório mudou desde a última auditoria, o botão **Auditar
mudanças (N)** agora **pulsa** (glow brasa) e fica em negrito pra chamar
atenção. Some enquanto está auditando.

---

## [1.117.0] — 2026-06-20

### Adicionado — Histórico de auditorias + auto-fechar backlog

Fecha o loop "auditar → ajustar → re-auditar": o re-run incremental agora
**fecha sozinho** os itens de backlog que o diff resolveu, e há uma **linha do
tempo** da evolução do sistema.

- **Histórico** (botão no cabeçalho da Auditoria): timeline de todas as rodadas
  com score, nº de achados, resolvidos, modelo e commit + **mini-gráfico** da
  evolução do score (SVG inline, sem dependência nova).
- **Auto-fechar backlog**: quando a auditoria incremental marca um achado como
  resolvido, o item que ele originou é fechado automaticamente — Decisão →
  `feito`, Risco → `mitigado`, Oportunidade → `ganho`. Toast + banner listam o
  que foi fechado.
- **Riscos mitigados** somem do Mapa de Quebra e param de penalizar o score
  (nova coluna `status` em `Riscos`; `SCHEMA_VERSION` → `v1.61-risco-status`).

> Versionamento/rollback: o rollback dos ajustes mora no **git do sistema** (PR/
> revert). A Forja só amarra cada auditoria a um commit e guarda o histórico.

---

## [1.116.0] — 2026-06-20

### Adicionado — Score premium + prompt de ajustes (.md)

Ao terminar a auditoria, o drawer agora abre com um **hero de resultado**:
score em destaque e um **prompt mestre** pronto pra levar pra IA.

- **Score premium** num medidor (dashboard) com cor por faixa (saudável/atenção/
  crítico) + contagem de achados por severidade (altas/médias/baixas).
- **Prompt de ajustes (.md)**: gera um único `.md` estruturado com todas as
  instruções — contexto pra IA, achados ordenados por prioridade (problema,
  evidência, solução, instrução detalhada), ordem de execução e próximos passos.
- **Baixar / Copiar** o prompt direto do hero (além do relatório completo).

---

## [1.115.0] — 2026-06-20

### Adicionado — Cronômetro ao vivo na auditoria

Enquanto a auditoria roda, o drawer agora mostra **tempo decorrido ao vivo** +
barra de progresso, pra você acompanhar e perceber risco de timeout.

- **Contador grande** (`12s`, depois `1m 03s`) atualizado em tempo real.
- **Barra de progresso** assintótica que muda de cor (azul → âmbar após 1min →
  vermelho após 4min).
- **Aviso de timeout**: passando de 4min, lembra que o Apps Script corta em ~6min
  e sugere modos mais leves (Código/Governança) ou modelo mais rápido.

---

## [1.114.0] — 2026-06-20

### Adicionado — Conectar repositórios em lote (Sistemas → GitHub)

Pra quem tem o portfólio todo no GitHub mas importou os sistemas do GAS (só com
`scriptId`): um conector em lote pra preencher o `repoUrl` de todos de uma vez —
e assim auditar pelo GitHub, que é mais rico e seguro que a Apps Script API.

- **Botão "Conectar repos (N)"** no topo de Sistemas (aparece quando há sistemas
  sem repoUrl).
- Você informa a **organização do GitHub** e o **campo base do slug** (nome ou
  codinome); a Forja gera `github.com/<org>/<slug>` pra cada sistema sem repo e
  **verifica no GitHub quais existem de verdade** (✓/✗), sem chutar.
- **Preview editável**: ajusta qualquer URL, marca/desmarca, "selecionar só os
  encontrados" e conecta os escolhidos em um clique.

#### Técnico
- Servidor: `sugerirReposGitHub(org, campo)` (slug + verificação via
  `fetchAll` em lotes) e `conectarReposEmLote(itens)`.
- Frontend: `ConectarReposModal` + entrada no `Bancada`.

---

## [1.113.0] — 2026-06-20

### Adicionado — Conectar repo e limpar histórico direto na Auditoria

Dois atalhos pra fechar o ciclo de teste da auditoria sem sair do drawer.

- **Conectar repositório inline**: quando o sistema não tem `repoUrl`, o drawer
  mostra um campo "Conectar repositório GitHub". Você cola a URL, ele salva na
  ficha (`updateSistema`) e **já roda a auditoria completa** lendo o código via
  git — sem precisar abrir o formulário do sistema. Desbloqueia também a
  auditoria incremental.
- **Limpar histórico**: botão **"Limpar"** (com confirmação) apaga todas as
  auditorias salvas do sistema — pra testar do zero depois de mudanças, sem o
  curto-circuito/incremental reaproveitando rodadas antigas.

#### Técnico
- Servidor: `limparAuditoriasSistema(sistemaId)` (bulk delete via `dbDeleteMany`).
- Frontend: campo de conexão de repo + `Popconfirm` de limpeza no `AuditoriaDrawer`;
  estado local de `repoUrl` que re-deriva o modo padrão ao conectar.

---

## [1.112.0] — 2026-06-19

### Melhorado — Auditoria de sistemas "sem dados" (GAS + governança vazia)

Quando a auditoria caía num sistema sem código legível e sem governança, ela
devolvia achados genéricos e um erro de código que era só texto morto. Agora esse
caso é tratado de ponta a ponta.

- **Erro de código acionável**: o aviso "Apps Script API desativada" virou CTA —
  botão **"Ativar Apps Script API"** (abre as configurações) + **"Tentar ler o
  código de novo"** (re-roda forçando a releitura). Para GitHub desconectado,
  aponta pro `GITHUB_TOKEN` em Configurações.
- **Checklist de setup (sem IA)**: se o sistema não tem código, repo nem nenhum
  registro de governança, a auditoria devolve um **passo a passo determinístico**
  (instantâneo, sem gastar LLM): ative a API, conecte o repo, defina propósito/
  stack/URL, registre a 1ª decisão/risco — com botões que já registram.
- **Dica de GitHub pra projetos GAS**: sugere conectar o `repoUrl` (mesmo em
  projetos Apps Script versionados via clasp) pra destravar leitura de código
  mais rica + auditoria incremental.
- **Banner GAS mais claro**: "a auditoria roda completa a cada vez" no lugar do
  confuso "sem histórico de commits pra comparar".

#### Técnico
- Servidor: `_auditoriaOnboarding` (checklist determinístico) + detecção
  "data-starved" em `acaoIAAuditarSistema`; `AuditFontes.onboarding`.
- Frontend: `FontesBlock` com CTAs (Ativar API / re-auditar / dicas); banner de
  onboarding no resultado; mensagem GAS suavizada no banner de frescor.

---

## [1.111.0] — 2026-06-19

### Adicionado — Auditoria focada no diff (Fase 2.5)

Quando o repositório mudou desde a última auditoria, a Forja agora **re-audita só
o que mudou** em vez de reler o código inteiro — e reconcilia os achados antigos.

- **Auditar mudanças (N)** dispara uma **auditoria incremental**: a IA recebe os
  achados anteriores + o **diff** (patches do GitHub) e decide o que foi
  **resolvido**, o que **persiste** e quais problemas **novos** o diff introduziu.
- **Cards marcados**: cada achado ganha um selo **"novo"** (introduzido pelo diff)
  ou **"persiste"** (continua aberto da rodada anterior).
- **Resolvidos desde a última**: bloco no topo lista os achados que o diff
  fechou — feedback de progresso real.
- **Bem mais barato**: o incremental usa só os patches que já vêm na compare API
  (sem baixar o repo) e respeita o mesmo orçamento de arquivos/KB.
- **Banner de rastreabilidade** no resultado mostra "Auditoria incremental —
  N arquivos do diff · `base` → `head`".
- Forçar ("Auditar mesmo assim" quando em dia) continua rodando a varredura
  completa do repositório.

#### Técnico
- Servidor: `_lerDiffGitHub` (compare API → patches, orçado); branch incremental
  em `acaoIAAuditarSistema` + `_executarAuditoriaIncremental` (prompt de
  reconciliação, mesmo formato `AuditPayload`); parser estendido pra `origem` e
  `resolvidos`.
- Types: `AuditFinding.origem`, `AuditPayload.resolvidos`,
  `AuditFontes.incremental` / `baseCommit`.

---

## [1.110.0] — 2026-06-19

### Adicionado — Auditoria incremental (Fase 2): re-run barato

A auditoria de código agora sabe **se vale a pena re-rodar**. Ela compara o HEAD
do repositório com o commit já auditado e, quando nada mudou, não gasta LLM.

- **Banner de frescor** no drawer da Auditoria (modos Completa/Código):
  - 🟢 **Em dia** com o commit `abc1234` quando nada mudou — com botão discreto
    "Auditar mesmo assim".
  - 🟡 **N arquivos mudaram** desde a última auditoria, com lista colapsável dos
    arquivos relevantes alterados e botão primário "Auditar mudanças (N)".
  - ℹ️ Avisos claros quando não dá pra comparar (projeto GAS, base reescrita,
    GitHub indisponível).
- **Curto-circuito sem LLM**: se o HEAD == commit auditado e você não forçar, a
  Forja devolve o resultado salvo na hora, com aviso leve "sem mudanças".
- **Cache efêmero de blobs (6h)**: o conteúdo dos arquivos do GitHub é cacheado
  por SHA de blob (content-addressed — muda o arquivo, muda o SHA, invalida
  sozinho). Re-runs na sessão baixam só o que faltava.

#### Técnico
- Servidor: `getStatusAuditoriaCodigo(sistemaId)` (HEAD + compare API, conta
  arquivos relevantes); `acaoIAAuditarSistema(sistemaId, modo, forcar?)` com
  curto-circuito por commit; `_lerCodigoGitHub` agora persiste o **commit sha**
  real (não a tree sha) e usa `CacheService` por blob.
- Types: `StatusAuditoriaCodigo`; `AuditResult.semMudanca`.

---

## [1.109.0] — 2026-06-19

### Adicionado — Auditoria que lê o CÓDIGO de verdade (Fase 1)

Antes a "Auditar com IA" olhava só os metadados de governança da Forja (custos,
riscos, decisões, campos da ficha) — nunca abria o repositório. Agora ela lê o
código real.

- **Seletor de escopo** no drawer da Auditoria: **Completa** (governança + código),
  **Código** (só o repositório) ou **Governança** (como era). Default = Completa
  quando o sistema tem repositório.
- **Lê o repositório de verdade**:
  - **GitHub** via `repoUrl` + token já configurado (árvore recursiva + download
    dos arquivos-chave em paralelo via `fetchAll`).
  - **Google Apps Script** via `scriptId` (Apps Script API, escopo já presente).
- **Curadoria com orçamento**: prioriza READMEs, manifestos, configs e `src/`,
  ignora `node_modules/dist/locks/binários`, respeita um teto de arquivos/KB pra
  caber no prompt e nos 6 min do Apps Script.
- **Evidência de código**: achados passam a citar **arquivo + trecho literal**
  (segredos hardcoded, dependências, falta de testes/CI, arquitetura, código morto).
- **Rastreabilidade**: o bloco "Fontes" mostra o que foi lido — origem (GitHub/GAS),
  nº de arquivos, KB e o **commit** auditado. Se não houver repositório, um aviso
  claro guia a conectar um `repoUrl`.
- **Custo sob controle**: a auditoria agendada em background continua só em
  governança (barata); a de código roda sob demanda no drawer.

#### Técnico
- Coletores `_lerCodigoGitHub` / `_lerCodigoGAS` + seleção/orçamento; `AuditFontes`
  estendida com metadados de código; `acaoIAAuditarSistema(sistemaId, modo)`.

---

## [1.108.0] — 2026-06-19

### Adicionado — "Ideias de melhoria": capture sua faísca e promova ao Backlog

Antes o Backlog de cada sistema era alimentado quase só pela Auditoria IA. Agora
você tem onde lançar suas próprias ideias de melhoria — sem poluir o acionável e
sem criar conceito duplicado.

- **Uma faísca só**: a seção **Ideias** ganhou tipo **"Novo sistema"** (continua
  indo pra Gênese, como sempre) vs **"Melhoria"** (incremento num sistema que já
  existe → vai pro Backlog). Filtro `Todas / Novos sistemas / Melhorias`.
- **Faixa "Ideias" no Backlog** (dentro de cada Sistema, na aba Backlog e no Kanban):
  captura rápida de 1 campo pra jogar a faísca na hora. Fica separada das colunas
  acionáveis — ideia crua não polui "A fazer".
- **Promover com anti-redundância**: ao promover, a IA estrutura a ideia num item
  de backlog (o quê / por quê / prioridade / estimativa) **e checa duplicado**
  contra o backlog existente daquele sistema, avisando antes de criar. Você revisa,
  edita e confirma — aí vira item "A fazer".
- **Caixa global**: melhorias soltas (sem sistema) podem ser capturadas na seção
  Ideias e destinadas a um sistema na hora de promover.

#### Técnico
- Tabela `Ideias` estendida (`tipo`, `sistemaId`, `prioridade`, timestamps);
  `SCHEMA_VERSION` → `v1.60-ideias-melhoria` (migração automática, ideias legadas
  viram tipo "sistema").
- Novas funções server: `getMelhoriasBySistema`, `refinarIdeiaMelhoria`,
  `confirmarPromocaoIdeia`. Novo componente `IdeiasFaixa` + `PromoverIdeiaModal`.

---

## [1.107.1] — 2026-06-19

### Alterado — instruções do Estúdio viraram modal (tela mais leve)

- O guia de passos saiu do corpo da tela (estava pesado) e virou um **modal** que
  abre sozinho na **primeira visita** (lembrado via `localStorage`) e pode ser reaberto
  pelo link discreto **"Como funciona?"**.
- O estado vazio do Estúdio voltou a ser leve: placeholder + botões (Abrir Pastas /
  Colar link) e a trilha **"Continuar assistindo"** logo abaixo.

---

## [1.107.0] — 2026-06-19

### Adicionado — "Trilhas": planos de estudo por tópico

- Nova aba **Trilhas**: cada trilha é um tópico (ex.: Agents, Skills, Tools) com
  objetivo, status (Planejando/Estudando/Concluído), cor e **barra de progresso**.
- **Plano da trilha:** itens ordenados que podem ser **vídeos** (do YouTube) ou
  **tarefas**, cada um com checkbox de concluído alimentando o progresso.
- **Anexar vídeos** de 3 formas: por **link**, dos seus **Favoritos**, ou **buscando no
  YouTube** (metadados via oEmbed). 
- **Integra com o Estúdio:** "Estudar" um vídeo da trilha abre no Estúdio já com a
  **trilha inteira como Fila** — assiste e anota na sequência do plano.
- **Ponte com o Caderno:** botão "Virar trilha" promove um assunto do Caderno a trilha.
- Schema: novas tabelas `EstudoTrilhas` e `EstudoTrilhaItens` — migração automática
  (`v1.59-estudo-trilhas`).

---

## [1.106.0] — 2026-06-19

### Adicionado — Estudos abre no Estúdio + "Continuar assistindo"

- **Estudos sempre abre na aba Estúdio** (era Pastas). Saiu e voltou, cai no Estúdio.
- **Histórico premium "Continuar assistindo".** Uma trilha horizontal discreta no estado
  vazio do Estúdio com os últimos vídeos abertos (capa + título). Clicou, retoma — e a
  fila vira esse histórico. Só aparece quando há histórico (zero poluição) e tem um
  "Limpar" discreto. Cada vídeo entra uma vez (reabrir sobe pro topo); guarda até 30.
- Schema: nova tabela `EstudoHistorico` — migração automática (`v1.58-estudo-historico`).

---

## [1.105.1] — 2026-06-19

### Corrigido — Estúdio dava play sozinho ao voltar pra aba

- O iframe tinha `autoplay=1` fixo, então toda vez que você saía e voltava pro Estúdio
  o vídeo recomeçava sozinho. Agora o autoplay só acontece quando você **escolhe um
  vídeo de propósito** (clique em Pastas/Favoritos/Fila ou colar link). Voltar pra aba
  reabre o mesmo vídeo **pausado**. Além disso, digitar nas notas não reinicia mais o
  player.

---

## [1.105.0] — 2026-06-19

### Alterado — Estúdio vazio virou uma vitrine de uso (premium)

- Quando não há vídeo aberto, o Estúdio agora mostra um **guia premium** que ocupa o
  espaço: hero com eyebrow, 4 cards de passos (Escolha → Assista → Anote → Caderno)
  com ícones em cores de acento, e um rodapé com CTAs **"Abrir Pastas"** / **"Colar um
  link"** + dicas (autosave, fila, favoritos). Fundo com gradiente radial sutil.

---

## [1.104.0] — 2026-06-19

### Adicionado — "Estúdio": assistir e anotar ao mesmo tempo

- **"Assistir" virou "Estúdio".** É a tela de foco: player grande de um lado, painel
  de **Notas** do outro. As notas são um **rascunho que salva sozinho** (autosave),
  amarrado ao vídeo — reabriu o vídeo, a nota volta.
- **Botão "Mandar pro Caderno"** promove a anotação a um assunto estruturado do
  Caderno (título já vem do vídeo, link preenchido), sem perder o rascunho.
- **Aba "Fila"** no painel: os vídeos da pasta/busca de onde você veio ficam listados
  pra escolher o próximo ali mesmo — assistir + anotar + sequência num lugar só.
- **Pastas/Buscar viraram o seletor.** Clicar num vídeo (capa corrigida, proporção
  16:9) leva pro Estúdio já com a fila daquela pasta carregada. O player embutido das
  Pastas saiu (consolidado no Estúdio).
- **Favoritos** também manda pro Estúdio com a gaveta inteira como fila.
- Schema: nova tabela `EstudoVideoNotas` (uma nota por vídeo) — migração automática
  (`v1.57-estudo-videonotas`).

---

## [1.103.1] — 2026-06-19

### Corrigido — capa do Favoritos colapsada (16:9)

- O card de Favoritos tinha `paddingTop: '56.25%'` (proporção 16:9) e `padding: 0` no
  **mesmo** `<button>` — o `padding: 0` anulava o `paddingTop`, colapsando a área da
  capa pra altura ~0 (capa some, título sobe por cima). A proporção foi movida pra um
  `div` wrapper e o botão agora preenche em `position: absolute`. Capa + alinhamento OK.

---

## [1.103.0] — 2026-06-19

### Corrigido — Favoritos: capas + trava de duplicados

- **Capas dos Favoritos voltaram.** Os cards usavam `<img>` sem `referrerPolicy`, então
  as thumbs do YouTube falhavam no iframe do Apps Script. Agora reusam o mesmo
  `ThumbImg` robusto (no-referrer + fallback pelo `videoId`).
- **Trava de duplicados.** Salvar o mesmo vídeo (mesmo `videoId`) não cria um segundo
  card: o servidor detecta e responde `duplicado`, e a UI avisa "Esse vídeo já está em
  Favoritos". Vale pro botão Salvar e pro import a partir das Pastas/Buscar.
- Obs.: duplicados já existentes continuam lá — remova o repetido pela lixeira do card.

---

## [1.102.0] — 2026-06-19

### Alterado — Pastas estilo YouTube (player embutido + lista lateral)

- **Player embutido dentro da pasta.** Ao abrir uma pasta (ou buscar), agora aparece
  um player grande à esquerda e a **lista de vídeos ao lado** — clicar num item troca
  o vídeo na hora, sem ir-e-voltar pra aba Assistir. O primeiro vídeo já entra tocando.
- **Capas voltaram a aparecer.** As thumbs do YouTube falhavam dentro do iframe do
  Apps Script; agora usam `referrerPolicy="no-referrer"` e caem em variações pelo
  `videoId` (`mqdefault`/`hqdefault`/`default`) se a primeira falhar.
- Ações do vídeo em foco: salvar em Favoritos, abrir em **tela cheia** (aba Assistir)
  e abrir no YouTube. A mesma lista vale pra Pastas e pra Buscar.

---

## [1.101.0] — 2026-06-19

### Alterado — Estudos com "Pastas" (suas playlists do YouTube como fonte única)

- **Nova aba "Pastas":** suas playlists do YouTube viram as pastas de estudo. Em
  **Adicionar pasta** você vê todas as suas playlists e marca quais **acompanhar**
  (as que já têm o que você quer). Abrir uma pasta lista os vídeos **ao vivo** — pra
  assistir aqui dentro ou salvar em Favoritos. Fonte única: você organiza no YouTube,
  o QG só reflete.
- **Coleções manuais removidas.** A organização agora é uma só (suas playlists).
- **"Minha conta" virou "Pastas"**; "Curtidos" segue fora.
- **Favoritos** voltou a ser uma **gaveta plana** de vídeos soltos salvos por link/busca
  (sem coleções).
- Schema: nova tabela `EstudoPlaylists` (playlists acompanhadas) — migração automática
  (`v1.56-estudo-pastas`).

---

## [1.100.0] — 2026-06-19

### Alterado — Estudos com foco "zero distração"

- **Favoritos viraram o coração dos Estudos, com Coleções/temas.** Você cria e edita
  coleções (nome + cor — ex.: Vibe Code, IA, Bancos), filtra por elas em chips no topo
  e move um vídeo de coleção direto no card. Novo gerenciador de coleções (criar,
  renomear, recolorir, remover — ao remover, os vídeos voltam pra "Sem coleção").
- **"Minha conta" (YouTube) agora é garimpo sob demanda**, não vitrine: só **Playlists**
  (abre uma playlist sua e importa o que interessa) e **Buscar**. No topo, um seletor
  "Importar p/ [coleção]" manda o vídeo direto pra coleção certa.
- **Removida a aba "Curtidos"** — trazia tudo que você já curtiu (ruído). Fora.
- Schema: nova tabela `EstudoColecoes` + coluna `colecaoId` em `EstudoVideos`
  (migração automática — `v1.55-estudo-colecoes`).

---

## [1.99.1] — 2026-06-19

### Corrigido / Alterado

- **YouTube (Fase 2) agora conecta por OAuth próprio — fim da tela branca.** A v1.99.0
  pedia a permissão sensível `youtube.readonly` no manifesto do app. Em contas
  **Google Workspace** com app não verificado, o Google **bloqueava a autorização e
  devolvia tela em branco**, derrubando o app inteiro. Revertido.
  - Agora o YouTube usa a mesma infra de **conectores OAuth do Driver** (provedor
    `google-youtube`): você cadastra um Client ID/Secret próprio (com a **YouTube
    Data API v3** habilitada), conecta a conta e o app chama a API via **REST com o
    token do conector** — **sem nenhum scope sensível no manifesto**.
  - Nova UI em **Estudos → Minha conta**: passos guiados (configurar credenciais →
    conectar), botão de verificar conexão, avatar do canal e desconectar.
  - Guia passo-a-passo em `YOUTUBE_OAUTH.md`.
- O conector do YouTube fica fora do painel **Driver** (não é nuvem de arquivos).

---

## [1.99.0] — 2026-06-19

### Adicionado

- **Estudos → "Minha conta" (YouTube conectado — Fase 2).** Nova sub-aba que liga
  o seu próprio canal do YouTube ao QG, **somente leitura**, via OAuth nativo do
  Apps Script (scope `youtube.readonly` + YouTube Advanced Service). Sem chaves de
  API nem configuração no Google Cloud Console.
  - **Curtidos**: lista os seus vídeos curtidos com capa, título e canal.
  - **Playlists**: navega pelas suas playlists e entra em cada uma pra ver os itens.
  - **Buscar**: pesquisa no catálogo do YouTube direto do app.
  - Cada vídeo pode ser **tocado** na aba Assistir (sem sair do QG) ou **salvo nos
    favoritos** com 1 clique (metadados já preenchidos, sem chamada extra).
  - Cabeçalho mostra o canal conectado; paginação "Carregar mais" em todas as listas.
- Quando o scope ainda não foi autorizado, a aba mostra um aviso amigável com botão
  **"Recarregar e autorizar"** (o Google pede o consentimento no carregamento do app).

> Requer reautorização: ao abrir o app após o deploy, aceite a permissão do
> YouTube na tela do Google.

---

## [1.98.0] — 2026-06-19

### Adicionado

- **Nova seção "Estudos"** no menu lateral (atalho `g e`) — um canto de
  aprendizado dentro do QG, com 3 sub-áreas:
  - **Assistir**: cola um link do YouTube (vídeo, `youtu.be` ou shorts) e assiste
    embutido no app, em player 16:9. Botão pra salvar o vídeo nos favoritos.
  - **Favoritos**: biblioteca de vídeos salvos em cards com **capa, título e canal
    preenchidos automaticamente** (via oEmbed público do YouTube — sem API key nem
    login). Categoria, tags e notas por vídeo; tocar/editar/remover; busca e filtro.
  - **Caderno**: registro de assuntos/dicas pra revisar e aprofundar (banco de
    dados, IDE, ferramenta, linguagem, conceito, IA…), com status (A rever /
    Aprofundando / Dominado), prioridade, tags e link.
- Schema ganhou `EstudoVideos` e `EstudoNotas` (migração automática append-only —
  `v1.54-estudos`).

> Fase 2 (futuro): conectar a conta do YouTube via OAuth pra importar vídeos
> curtidos/playlists e busca no catálogo dentro do app.

---

## [1.97.4] — 2026-06-19

### Adicionado

- **Atelier → selo de bancada no rodapé do sidebar.** O espaço da moldura esticada
  ganhou um selo discreto (martelo + wordmark "Forja"), ancorado embaixo e bem
  leve (opacidade baixa) — toque clássico/minimalista. Some no mobile.

---

## [1.97.3] — 2026-06-19

### Alterado

- **Atelier → sidebar emoldurado e alinhado.** A coluna lateral de estações agora
  estica até o fim do painel de conteúdo (as duas colunas ficam alinhadas, mais
  harmônico), enquanto a lista de botões continua sticky no topo ao rolar. Mobile
  segue virando a faixa horizontal de pílulas.

---

## [1.97.2] — 2026-06-19

### Alterado

- **Atelier mais largo.** A área do Atelier passou de 1240px → 1440px de largura
  máxima, dando mais respiro ao conteúdo (ex.: nomes de conta como "Google One Pro
  5TB" deixam de ser cortados nas colunas de Contas).

---

## [1.97.1] — 2026-06-19

### Adicionado

- **Contas → autocomplete também no E-mail de recuperação.** O campo de e-mail de
  recuperação agora sugere os e-mails já cadastrados (mesma lista do campo de
  login), com o serviço de origem ao lado.

---

## [1.97.0] — 2026-06-19

### Adicionado

- **Contas → sugestão de e-mails já cadastrados.** Ao adicionar/editar uma conta,
  o campo de e-mail virou autocomplete: ao digitar (ou focar) ele puxa os e-mails
  que você já usou em outras contas, mostrando ao lado em quais serviços cada um
  aparece. Continua dando pra digitar um e-mail novo normalmente.

---

## [1.96.2] — 2026-06-19

### Adicionado

- **Contas → estrela de recuperação na lista.** A estrelinha de recuperação agora
  aparece também em cada linha das colunas Grátis/Premium (e Por categoria), ao
  lado do nome da conta — dá pra ver de relance quais contas já têm recuperação
  sem abrir o detalhe.

---

## [1.96.1] — 2026-06-19

### Adicionado

- **Contas → estrela de recuperação.** No modal de detalhe da conta, ao lado do
  nome, aparece uma estrelinha discreta quando a conta já tem dados de recuperação
  preenchidos (tooltip "Dados de recuperação preenchidos").

---

## [1.96.0] — 2026-06-19

### Adicionado

- **Contas → campos de Recuperação.** Em `Atelier → Contas → Editar` agora há uma
  seção destacada **Recuperação** com e-mail de recuperação, telefone de
  recuperação e um campo livre (códigos de backup, 2FA, perguntas). Aparece também
  em destaque no modal de detalhe da conta (com botão de copiar).
- **Contas → Relatórios.** Novo botão **Relatórios** no topo das Contas, com duas
  abas:
  - **Recuperação** — agrupa as contas por cada e-mail/telefone de recuperação
    (marcando os **compartilhados por 2+ contas**) pra você achar tudo que depende
    de um contato antes de trocá-lo/cancelá-lo; lista também as contas ativas
    **sem nenhum dado de recuperação**.
  - **Visão geral** — total de contas, pagas × gratuitas, distribuição por status
    e por categoria (com barras) e custo mensal recorrente.
- Schema `Contas` ganhou `recEmail`, `recTelefone`, `recNotas` (migração
  automática, append-only — `v1.53-contas-recuperacao`).

---

## [1.95.0] — 2026-06-19

### Adicionado

- **Skills → cache das adaptações por IA.** Cada adaptação (por ambiente) fica
  guardada por skill (`adaptacoes`); reexportar o mesmo kit pro mesmo ambiente
  reusa o cache e não gasta tokens de novo. Invalidado quando o conteúdo da skill
  muda.

---

## [1.94.0] — 2026-06-19

### Adicionado

- **Skills → preview da adaptação por IA.** Ao exportar com "Adaptar com IA", o
  modal agora mostra uma etapa de revisão: cada skill num colapsável com toggle
  Adaptado/Original e tag "adaptada/sem mudança". Só baixa o `.zip` depois que
  você revisa (as skills originais não são alteradas).
- **Skills → lembra a última config de export.** IDE/destino, SO, shell e as
  opções (contexto/adaptar) ficam salvos (localStorage) e voltam preenchidos no
  próximo export — não precisa reescolher toda vez.

---

## [1.93.0] — 2026-06-19

### Adicionado

- **Skills → escolher a IDE/destino no export.** O modal de export agora pergunta
  onde o kit vai ser usado e adapta a estrutura do `.zip`:
  - **Cursor** → `.cursor/rules/<skill>.mdc` (com frontmatter `description`/`alwaysApply`).
  - **Claude Code** → `.claude/skills/<skill>/SKILL.md`.
  - **Genérico** → `skills/<skill>/SKILL.md` (padrão agent-skills).
  Combina com ambiente (SO/shell) + contexto (AGENTS.md) + adaptação por IA.

---

## [1.92.0] — 2026-06-19

### Adicionado

- **Skills → export parametrizado por ambiente.** No exportar (pasta ou kit
  custom) dá pra definir o ambiente alvo (SO + shell + contexto livre, com
  presets Windows/macOS/Linux) e escolher:
  - **Incluir contexto** (grátis): injeta um `AGENTS.md` + cabeçalho em cada
    SKILL.md descrevendo o ambiente.
  - **Adaptar com IA**: reescreve comandos/caminhos/exemplos pro ambiente
    (bash→PowerShell etc.). As duas opções são combináveis.

---

## [1.91.0] — 2026-06-19

### Adicionado

- **Skills → exportar pasta como .zip.** Cada pasta tem um botão de exportar que
  gera um `.zip` com `skills/<nome>/SKILL.md` + um `README.md`. Extrai na raiz do
  projeto e o Cursor/Claude/outras IDEs leem. Geração 100% no cliente, sem
  dependências (gerador de ZIP próprio).
- **Skills → montar kit custom.** Botão "Montar kit" entra em modo seleção:
  marque skills de qualquer pasta, dê um nome e gere um `.zip` só com elas — ideal
  pra levar um kit parametrizado pra um projeto novo.

---

## [1.90.0] — 2026-06-19

### Adicionado

- **Skills → cor da pasta.** No editar pasta dá pra escolher uma cor de destaque
  (paleta do tema); o ícone da pasta passa a usá-la.
- **Skills → mover skill entre pastas.** No detalhe da skill (drawer), botão
  "Mover" lista as pastas existentes + "Avulsas" e troca a skill de pacote.
- **Skills → remover pasta.** No editar pasta, botão "Remover pasta": apaga a
  pasta e manda as skills dela pra "Avulsas" (não apaga as skills).

---

## [1.89.0] — 2026-06-19

### Modificado

- **Skills → temas colapsáveis dentro de cada pasta.** Cada classificação (tema)
  dentro de uma pasta agora é um sub-colapsável, recolhido por padrão: você abre
  a pasta, vê a lista de todos os temas e expande só o que quiser. Com busca
  ativa, os temas abrem sozinhos pra revelar os resultados.

---

## [1.88.0] — 2026-06-19

### Adicionado

- **Skills → pastas como pacotes editáveis.** Cada pasta agora tem nome e
  descrição próprios (nova aba `SkillFontes`), editáveis pelo lápis no cabeçalho
  — inclusive a do GAS App Kit. As pastas existentes são semeadas
  automaticamente, então já aparecem prontas pra editar.
- **Skills → "Importar pacote".** Botão que cria uma pasta com nome + descrição
  e sobe vários `.md` de uma vez; tudo entra sob esse pacote (`fonte`
  "&lt;pacote&gt;/&lt;skill&gt;"). Ideal pra quando você pega o pack de outra pessoa.

---

## [1.87.0] — 2026-06-19

### Adicionado

- **Skills → classificação por tema (IA).** Botão "Classificar por tema": a IA lê
  nome + descrição de cada skill e atribui um tema de alto nível de um conjunto
  fixo (Design, Frontend, Backend, Dados, Infra/DevOps, Testes, Segurança,
  IA/Prompts, Automação, Documentação, Revisão de código, Produtividade, Outro).
  As seções dentro de cada pasta passam a usar esse tema (com fallback pra
  `categoria` do frontmatter quando existir). Resultado fica em cache (`tipoIA`),
  numa única chamada à LLM pra todas as pendentes — não re-gasta tokens.

---

## [1.86.0] — 2026-06-19

### Adicionado

- **Skills → organização por pastas (fonte).** As skills agora ficam agrupadas
  por origem em pastas colapsáveis (ex.: **GAS App Kit**), fechadas por padrão —
  a tela não enche mais. Cada pasta mostra contagem e tamanho; ao importar novos
  packs no futuro, cada um vira sua própria pasta automaticamente (convenção de
  `fonte` "&lt;pack&gt;/&lt;skill&gt;"; uploads avulsos caem em "Avulsas / Importadas").
- **Skills → seções por categoria dentro de cada pasta.** Dentro de cada fonte,
  as skills são separadas por categoria com um rótulo (ex.: "review", "design"),
  pra entender o tipo num relance.
- **Skills → tradução das descrições em lote.** Botão "Traduzir descrições"
  traduz pra pt-BR todas as descrições ainda no original (uma frase cada),
  guardando em cache (`descricaoPt`) pra não re-gastar tokens. Os cards passam a
  mostrar a descrição traduzida quando disponível. Busca também olha o pt-BR.

---

## [1.85.0] — 2026-06-18

### Alterado

- **Contas → detalhes em modal (visão sempre limpa).** Clicar numa conta não
  expande mais inline (que empurrava a lista e desequilibrava as colunas) — agora
  abre um **modal premium** com todos os detalhes. As linhas ficam sempre no
  estado enxuto (ícone, nome, custo, status, seta).
  - **Seletor de conta/e-mail:** quando o serviço tem mais de um login (ex.: Gmail
    Pessoal + Empresarial), o modal mostra chips pra escolher qual ver, com o
    e-mail em destaque e botão de **copiar**.
  - Metadados organizados em grade (plano, cobrança, custo, renovação, pagamento,
    categoria), notas, tags e ações (Abrir · Cofre · Editar · Remover) no rodapé.
  - Removido o "Expandir/Recolher tudo" (não faz mais sentido sem expansão inline).

---

## [1.84.0] — 2026-06-18

### Adicionado

- **Contas → visão "Grátis / Premium" (dois lados).** Novo toggle de
  organização: à esquerda as contas **Gratuitas** (acento sálvia, ícone folha),
  à direita as **Premium / pagas** (acento pêssego, ícone coroa) com o **custo
  mensal recorrente** da coluna no cabeçalho. Cada lado é um card leve com as
  linhas colapsáveis — sem agrupar por categoria, pra ficar minimalista. A visão
  **Por categoria** continua disponível no mesmo toggle (default: Grátis/Premium).
  Colunas se empilham sozinhas em telas estreitas.

---

## [1.83.1] — 2026-06-18

### Corrigido

- **Assistente sem barra de rolagem no estado inicial.** A área do chat agora
  estica mais pra baixo (e o hero ficou um pouco mais compacto), então o título,
  o texto e os 4 cards de sugestão encaixam sem precisar rolar.

---

## [1.83.0] — 2026-06-18

### Alterado

- **Forja IA — passe de design premium em todas as abas.**
  - **Seletor de contexto em cartões (novo).** "Sem contexto / Portfólio /
    Sistema" no Assistente — e "Ideia / Sistema / Texto livre" no Conselho,
    Blueprint e Diagramas — viraram cartões com ícone, título e **uma linha
    explicando o que cada modo faz**. Quem seleciona entende a feature na hora;
    o cartão ativo acende no accent (borda + tint + ícone preenchido).
  - **Estados vazios premium.** Conselho, Blueprint e Prompts ganharam um empty
    com ícone em brilho ambiente, título em Fraunces e subtítulo orientando o
    próximo passo — em vez do `Empty` genérico.
  - **Conselho:** cards de parecer com fio de cor no topo (por especialista) e
    micro-elevação no hover.
  - **Prompts:** intro virou banner premium com ícone, separando "o que é" de
    "como usar".
  - Componentes reutilizáveis novos: `ContextCards` e `PremiumEmpty`.

---

## [1.82.0] — 2026-06-18

### Alterado

- **Forja IA → Assistente — passe de design premium.**
  - **Ações rápidas com identidade:** cada chip ganhou ícone num chip colorido
    próprio (azul/rose/argila/sálvia/lavanda/pêssego), sombra suave e
    micro-elevação no hover — o poder de cada ação fica visível, não chapado.
  - **"Pensa em melhorias" e "Gera backlog .md"** unificados ao mesmo visual dos
    demais chips, com divisória sutil antes do bloco de cliente.
  - **Estado inicial virou hero:** ícone com brilho ambiente, título em Fraunces
    ("O que vamos forjar hoje?") e as sugestões como cards com ícone, elevação e
    borda que acende no accent — em vez do `Empty` genérico.
  - **Campo de input com foco premium:** borda e halo no accent pêssego ao focar.

---

## [1.81.1] — 2026-06-18

### Alterado

- **Painel Contas — passe de design premium.**
  - **Stat tiles** ganharam profundidade (sombra + contorno vivo, ícone em chip
    colorido, fio de luz no topo) — sem mais "contorno morto".
  - **Grupos viraram cards reais** com cabeçalho destacado (faixa muted, ícone em
    chip, badge de contagem e custo do grupo em pill).
  - **Status em pill colorida** (em vez de bolinha + texto) — leitura imediata.
  - **Colapsado mais informativo:** mostra o custo recorrente sem precisar abrir.
  - **Expandido com respiro:** mais espaçamento, faixa única de metadados
    (plano · custo · renovação · pagamento), notas com filete lateral e ações em
    rodapé com divisória.

---

## [1.81.0] — 2026-06-18

### Adicionado

- **Contas → atalho pro Cofre.** Cards de conta com "senha no Cofre" agora têm
  botão **Cofre** que salta direto pra estação Cofre já filtrada pelo label do
  segredo associado — acha a chave em um clique.
- **Contas → custo por grupo.** O cabeçalho de cada categoria mostra o custo
  mensal recorrente do grupo (mensais + anuais rateados), por moeda.

### Corrigido

- **Erro amigável ao conectar contas (Driver OAuth).** Antes, falhas mostravam
  erro cru — e o timeout do poll não avisava nada (usuário ficava no vácuo).
  Agora um diálogo explica a causa provável (redirect_uri_mismatch, acesso
  negado, credenciais inválidas, pop-up bloqueado, timeout…) e oferece **Tentar
  de novo** / **Abrir credenciais** + **Ver passo a passo**. Também detecta
  pop-up bloqueado pelo navegador.

---

## [1.80.7] — 2026-06-18

### Corrigido

- **Faixa horizontal embaixo da Home (causa raiz).** A camada de aurora+dither
  cobria só a caixa do conteúdo; quando o conteúdo era mais curto que a tela, o
  `appBg` puro aparecia abaixo e a borda inferior do dither virava uma faixa
  horizontal. Agora o Dashboard tem `minHeight: 100vh`, então o fundo ambiente
  preenche a viewport inteira de forma uniforme — sem faixa, sem seam.

---

## [1.80.6] — 2026-06-18

### Alterado

- **Aurora mais sutil (zera a serrilha).** Opacidades das manchas reduzidas
  (~0.11 / 0.075 / 0.09). Menos contraste de cor = menos degraus pra escalonar =
  banding praticamente imperceptível, e o efeito fica mais discreto/premium.

---

## [1.80.5] — 2026-06-18

### Corrigido

- **Contraste e cards de baixo flutuando.**
  - Aurora suavizada na faixa do topo (opacidades menores e manchas reposicionadas)
    pra não lavar o "mestre" nem o botão "Novo sistema" — de quebra, menos banding.
  - Botão "Novo sistema" ganhou sombra suave na cor da brasa, saltando da aurora.
  - Cards "Aplicações" e "Atividade técnica" agora usam a mesma sombra encorpada
    dos cards de cima, então flutuam igual — visual harmonizado.

---

## [1.80.4] — 2026-06-18

### Corrigido

- **Blur da aurora de volta pra 100px.** O 130px deixava o carregamento mais
  lento e criava uma faixa escura na parte de baixo, sem ganho real contra a
  serrilha. Mantidos o dither e a harmonização de altura dos cards.

---

## [1.80.3] — 2026-06-18

### Corrigido

- **Banding da aurora mais suave + cards harmonizados.**
  - Reforço anti-banding: blur 100→130px e dither mais presente (0.045→0.08,
    ruído mais fino) pra matar a serrilha que ainda aparecia no degradê.
  - O Hero (Saúde operacional) agora preenche 100% da altura da coluna, ficando
    do mesmo tamanho do card Conexões ao lado — alinhamento harmonizado.

---

## [1.80.2] — 2026-06-18

### Corrigido

- **Aurora sem banding + respiro no topo.** O degradê mostrava "granulado"
  (banding — degraus de cor em fundo escuro). Aumentei o blur (80→100px) e
  adicionei uma camada de *dither* (ruído finíssimo, opacidade 0.045) que quebra
  os degraus e deixa a transição imperceptível — mesmo truque de Stripe/Apple.
- **Conteúdo desceu** (padding do topo 40→68px): o header "Boa tarde, mestre"
  não fica mais colado no topo; melhor distribuição vertical.

---

## [1.80.1] — 2026-06-18

### Corrigido

- **Aurora sem bandas marcadas + movimento visível.** O brilho ambiente estava
  preso na coluna central de 1280px com recorte, criando duas faixas marcadas
  nas laterais em telas largas. Agora é full-bleed: cobre toda a área de
  conteúdo, sangrando de ponta a ponta com fade radial (o recorte só acontece na
  borda real do viewer). As animações ganharam deslocamento maior e uma terceira
  trajetória, então o movimento agora é perceptível (continua lento e discreto).

---

## [1.80.0] — 2026-06-18

### Adicionado

- **Home premium — passe de design.** A Dashboard ganhou profundidade e impacto
  sem perder o "quiet luxury":
  - **Aurora ambiente:** manchas de cor da paleta (brasa, argila e a cor do
    status de saúde), muito borradas, derivando devagar no fundo — dá vida e
    profundidade sem poluir. Respeita `prefers-reduced-motion`.
  - **Profundidade nos cards:** Hero, Conexões, Aplicações e Atividade sobem 4px
    de leve no hover (`.forja-lift`) e usam sombra mais encorpada.
  - **Score que conta:** o número da Saúde anima de 0 ao valor no carregamento e
    ganhou um brilho sutil (`text-shadow`) na cor do status.
  - **Anel com glow:** o `RingProgress` agora tem um halo suave na cor do arco.
  - Mais respiro: padding vertical e gutters ajustados.

---

## [1.79.1] — 2026-06-18

### Corrigido

- **"Decisões em aberto" não conta mais itens concluídos.** O contador da Home
  só excluía `concluido`/`cancelado`, mas o Kanban marca "Feito" como `feito` —
  então tarefas concluídas seguiam aparecendo como em aberto. Agora todos os
  status finais (feito, concluído, cancelado, descartado, revertida) são
  desconsiderados.

---

## [1.79.0] — 2026-06-18

### Adicionado

- **Indicadores do Dashboard agora ensinam o que fazer.** Tooltips didáticos (com
  recomendação acionável) no score de Saúde, no selo de status, nos 4 estágios
  (Forja/Têmpera/Prateleira/Atenção), no anel de Conexões, no "X ativos de Y" e
  nos contadores de decisões/findings. Passar o mouse explica o indicador e diz
  a próxima ação pra manter tudo perto de 100%.

---

## [1.78.0] — 2026-06-18

### Corrigido

- **Pulso monitorado agora conta como "Atividade nos últimos 30 dias".** Antes, o
  fator de saúde só olhava a Timeline, e um pulso respondendo OK não gravava nada
  lá (só incidentes 5xx gravavam) — então monitorar uma URL saudável não mexia no
  score. Agora cada checagem grava `verificadoEm`, e um pulso verificado nos
  últimos 30 dias já marca o sistema como ativo. `SCHEMA_VERSION` →
  `v1.48-pulso-verificadoem`.

---

## [1.77.1] — 2026-06-18

### Alterado

- **Pulsos: URL truncada no meio (início + fim) com tooltip.** A URL longa do web
  app ocupava a linha toda e escondia status/latência. Agora aparece encurtada
  (igual chave de API), liberando as colunas; a URL completa fica no hover.
- **Riscos: estado vazio explica o racional.** Deixa claro que riscos vêm da
  "Auditar com IA" (descoberta automática) ou do "Mapear Risco" (manual).

---

## [1.77.0] — 2026-06-18

### Corrigido

- **Riscos agora podem ser excluídos.** O painel só tinha o lápis (editar) — não
  havia como remover um risco (nem duplicados). Adicionado botão de excluir com
  confirmação + função `deleteRisco` no servidor.
- **Gravidade de risco unificada em texto (Alta/Média/Baixa).** A auditoria criava
  riscos com gravidade textual ("alta"), mas o painel usava número (1-10) — então
  editar quebrava e o fator de saúde "Sem riscos de gravidade alta" não batia.
  Agora tudo usa Alta/Média/Baixa (com tag colorida), e registros antigos em número
  são normalizados automaticamente. Mexer em riscos recalcula a saúde na hora.

### Adicionado

- **Pulsos: botão "Verificar agora".** Antes, as URLs só eram checadas pelo trigger
  de 15 min — sem trigger ativo, ficavam "Sem dados". Agora dá pra checar na hora
  e ver status/latência imediatamente (`verificarPulsosSistema`).

---

## [1.76.0] — 2026-06-18

### Adicionado

- **Fatores da Saúde agora são acionáveis.** No breakdown do score (clique no
  número), cada fator pendente vira um atalho que leva direto pra onde resolver:
  propósito/stack/URL/repo → "Editar ficha"; custos/receita → aba Custos;
  atividade → aba Pulsos; risco → aba Riscos. Acabou o "sei o que está errado
  mas não sei onde arrumar".
- **Aba Custos agora permite adicionar e remover.** Antes era só leitura (sem
  jeito de cadastrar pelo detalhe do sistema). Agora tem botão "Adicionar custo"
  com fornecedor, valor, recorrência, categoria e próxima cobrança — e ao salvar,
  o score de saúde e o checklist de graduação recalculam na hora.

### Alterado

- O checklist de graduação recarrega automaticamente quando você mexe nos custos.

---

## [1.75.2] — 2026-06-18

### Alterado

- **Score de saúde recalcula e salva sozinho ao abrir o sistema.** Antes, o
  número exibido era recalculado ao vivo, mas o valor persistido (usado nas
  listas da Bancada/Dashboard) só atualizava no botão "Recalcular" ou após
  auditoria. Agora, abrir o detalhe do sistema recalcula **e persiste** o score,
  mantendo tudo fresco automaticamente. O botão "Recalcular" segue para forçar
  manualmente.

---

## [1.75.1] — 2026-06-18

### Corrigido

- **Backlog não duplica mais ao re-rodar a auditoria.** O anti-duplicação dos
  findings era amarrado a cada rodada de auditoria; rodar de novo e registrar
  recriava cartões iguais. Agora `registrar_decisao` e `registrar_risco`
  deduplicam por sistema + título (decisão) ou sistema + área/descrição (risco)
  antes de criar — se já existir, não duplica e avisa "já existia".

---

## [1.75.0] — 2026-06-18

### Adicionado

- **Checklist de graduação (portão Forja → Têmpera).** No detalhe de qualquer
  sistema em estágio *Forja*, um painel "Pronto pra Têmpera?" mostra 5 critérios
  objetivos de saída: deploy no ar com acesso, dossiê técnico mínimo (propósito +
  stack + repositório), custos mapeados, riscos e decisões registrados, e fluxo
  principal validado. Quatro são **auto-avaliados** a partir dos dados que a Forja
  já guarda; "fluxo validado" é um toggle manual. Com tudo verde, o botão
  **"Graduar pra Têmpera"** move o sistema de estágio e registra um marco na
  timeline. (Origem: backlog A Origem v3 #3 — vale pra todos os sistemas.)
- **Schema:** coluna `fluxoValidado` em `Sistemas` (append-only) e funções
  `graduacaoStatus`, `setFluxoValidado`, `graduarSistema`. `SCHEMA_VERSION` →
  `v1.47-graduacao`.

---

## [1.74.1] — 2026-06-18

### Alterado

- **Detalhe do Sistema: barra de ações em uma única linha.** Os botões utilitários
  (Abrir, Repo, GAS, Sincronizar) viraram só ícone + tooltip, evitando que o
  "Editar" quebrasse pra outra linha. Os botões de ação (Passaporte, Auditar com IA,
  Editar) seguem com texto.

---

## [1.74.0] — 2026-06-18

### Alterado

- **Refino da lista de Contas.** Estado de abertura das linhas agora é controlado
  (sobrevive a filtros/buscas) e ganhou um botão **"Expandir tudo / Recolher tudo"**
  acima da lista, com a contagem de contas filtradas. Hover das linhas reescrito de
  forma mais limpa (estado local, sem manipular o DOM direto).

---

## [1.73.0] — 2026-06-18

### Alterado

- **Contas mais clean e premium (Atelier → Contas).** Os cards grandes deram lugar a
  uma **lista colapsável agrupada por categoria**: cada linha mostra só o essencial
  (ícone, serviço, nº de contas e o **status** — pra saber de bate-pronto se está
  ativa) e **expande** ao clicar pra revelar logins, plano, custo, renovação,
  pagamento, notas, tags e ações. Dentro de cada grupo, as contas vêm ordenadas por
  status (ativas primeiro) e nome.
- **Abre direto em "Ativas"** por padrão (antes era "Todos"), reduzindo o ruído ao
  entrar.

---

## [1.72.0] — 2026-06-18

### Adicionado

- **Múltiplos logins por conta (Atelier → Contas).** Agora um mesmo serviço pode
  ter várias contas/e-mails (ex.: Manus pessoal + trabalho), cada um com e-mail e
  apelido próprios, compartilhando o resto dos dados (plano, custo, etc.). No card,
  quando há mais de um login, eles aparecem como chips; a busca varre todos os
  e-mails/apelidos.
  - Schema `Contas` ganhou a coluna `logins` (JSON, append-only →
    `SCHEMA_VERSION v1.46-contas-logins`). Contas antigas de e-mail único migram
    automaticamente (o e-mail vira o 1º login) — sem perda de dados.

---

## [1.71.0] — 2026-06-18

### Adicionado

- **Nova estação "Contas" no Atelier** — inventário central de todas as suas contas:
  e-mails, ferramentas de IA (ChatGPT, Claude.ai, Gemini, Manus, Perplexity…), dev
  (Cursor, Replit, Copilot, v0, Lovable…), mídia, infra e e-mail. Cada conta guarda
  **categoria, rótulo, e-mail, URL, plano, tipo de cobrança, custo + moeda, forma de
  pagamento, próxima renovação, status e tags**.
  - **Resumo no topo:** total de contas, custo mensal recorrente (por moeda),
    renovações nos próximos 14 dias e nº de categorias.
  - **Filtros:** busca + categoria + status (ativa/avaliar/trial/cancelada).
  - **Semear catálogo:** botão que popula sugestões de ferramentas atuais de IA/dev/
    e-mail pra você só completar (idempotente — não duplica o que já existe; entram
    como "avaliar").
  - **Segurança por design:** só metadados ficam aqui. Senha/API key vão pro **Cofre**
    (E2E) — a conta marca *“senha no Cofre”* + o label pra você achar rápido. Nada de
    credencial em texto plano fora do cofre.
- Tabela `Contas` no SheetDB (`SCHEMA_VERSION` → `v1.45-contas-hub`) + funções
  `contasList`, `contasSave`, `contasDelete`, `contasSeedCatalogo`.

---

## [1.70.0] — 2026-06-18

### Adicionado

- **Roteamento de IA estendido a todos os serviços.** O catálogo de roteamento
  agora cobre também: **Conselho de especialistas**, **Entrevistas & discovery**,
  **Ações rápidas** (resumo executivo, preço, release notes, ideias de cliente,
  risco de portfólio, refinar prompt) e **Finanças** — separadas em *planos*
  (pesada), *leitura de fatura* (média) e *reclassificar categorias* (simples).
  Cada um pode ter modelo próprio via `LLM_MODEL_<SERVICO>`.
- **Farol de status por serviço.** Cada serviço do proxy agora tem seu próprio
  indicador (●) que reflete a **última chamada real daquele serviço** (verde = ok,
  vermelho = falhou, cinza = sem chamada recente nos últimos 30 min). O tooltip
  mostra latência e mensagem de erro. Backend persiste status em
  `FORJA_STATUS_USO_<servico>` a cada chamada.

### Alterado

- **Configurações → Inteligência (IA) agora é colapsável e respirável.** Os quatro
  blocos (Conexão Proxy, Gemini, Roteamento, Auditoria) viraram um acordeão
  **colapsado por padrão** — o status de conexão continua visível no cabeçalho de
  cada bloco mesmo fechado, então a página deixou de ser uma rolagem longa.
- `RoteamentoIAPanel` e `ModeloAuditoriaPanel` ganharam modo `embedded` (sem a
  moldura `Panel`) para se encaixarem no acordeão sem cabeçalho duplicado.

---

## [1.69.0] — 2026-06-18

### Adicionado

- **Roteamento de IA por serviço (Configurações → IA).** Novo painel que lista
  cada serviço que consome IA (Forja IA/chat, Lume, dica, tradução de skills,
  blueprint, diagrama, auditoria + os de Gemini) com: descrição, **complexidade**,
  endpoint, modelo efetivo, se tem override e o farol de status do proxy.
  - **Modelo por serviço:** dá pra escolher um modelo específico por serviço
    (dropdown com os modelos disponíveis do provedor); vazio = usa o padrão global.
    Persistido em `LLM_MODEL_<SERVICO>`.
  - **Sugestão por IA:** botão "Sugerir modelos (IA)" manda os modelos disponíveis
    + o catálogo de serviços (com complexidade) pra própria LLM recomendar o modelo
    mais barato/eficiente pra cada um (estimando custo pelo nome) — com justificativa
    e botões "Aplicar" / "Aplicar todas". Evita gastar modelo caro onde um simples
    resolve.
  - **Resincronizar:** re-lista modelos e relê o status.

### Alterado

- **Roteamento real ligado nos serviços principais.** `chat`, `lume`, `dica`,
  `traducao`, `blueprint` e `diagrama` agora resolvem o modelo via
  `getModeloParaUso(uso)` (override por serviço → senão global). Auditoria já tinha
  override dedicado. Quem não passa `uso` continua no modelo global (zero quebra).

---

## [1.68.1] — 2026-06-18

### Corrigido

- **F5 voltava pra home.** A tela atual vivia só na memória; ao recarregar (ou
  reabrir o app) caía sempre no Dashboard. Agora a navegação (view + sistema/ideia
  selecionados) é persistida no `localStorage` e restaurada no carregamento — o F5
  mantém você onde estava. Telas que dependem de um id (detalhe/edição de sistema)
  caem na lista correspondente se o id não existir mais, evitando tela quebrada.

---

## [1.68.0] — 2026-06-18

### Alterado

- **Lume: status real do modelo no cabeçalho.** O selinho "● online" era fixo
  (decorativo) e não dizia qual modelo o chat usava. Trocado pelo `ModeloBadge`
  real: mostra o modelo do chat + farol verde/vermelho de online, com latência e
  "Testar conexão" no tooltip. Agora dá pra saber, de forma discreta, qual cérebro
  responde a Lume e se está up.

---

## [1.67.1] — 2026-06-18

### Corrigido

- **Lume travada em "loop eterno" gerando a DICA DA LUME.** O carregamento da dica
  não tinha timeout: se o proxy de IA demorava/travava, o `google.script.run` ficava
  pendurado e o spinner rodava pra sempre. Agora há **timeout de segurança (30s)**,
  guarda contra respostas obsoletas (ignora chamadas antigas) e **fallback com
  mensagem + retry** (↻) em vez do spinner infinito. Limpa o timer ao desmontar.

---

## [1.67.0] — 2026-06-18

### Adicionado

- **Status do modelo de IA no home das Skills.** No topo de "Minhas skills" agora
  aparece qual LLM está sendo usado (com tier) e um **farol** verde/vermelho/cinza
  indicando se está online — reaproveitando o `ModeloBadge` já existente (Chat,
  Blueprint, Diagramas). Tooltip mostra latência da última chamada e traz o botão
  **"Testar conexão"** (ping leve de 1 token). É o mesmo modelo que faz a tradução
  das skills, então o usuário sempre vê de onde vem o texto e se está vivo.

---

## [1.66.0] — 2026-06-18

### Corrigido

- **Crash ao editar um sistema (React #310).** O componente `DomainHints` (sugestões
  de domínio no formulário de sistema) chamava `Form.useWatch('dominioCustomizado')`
  **depois** de um `return` condicional. Ao abrir um sistema que já tinha `codinome`
  preenchido (ex.: "A Origem v3"), os dados carregavam, um hook extra rodava e a tela
  travava com "Algo travou na tela". Movidos todos os hooks pra antes do return.

### Alterado

- **Skills traduzidas por padrão + cache persistente.** Ao abrir uma skill, o Forja
  agora mostra **português direto**. A tradução é **guardada** (coluna `traducaoPt`
  na aba Skills) — abrir de novo não gasta token. O seletor vira **Português / Original**
  pra ver o texto-fonte (inglês) quando quiser. O cache é invalidado automaticamente
  se o conteúdo da skill mudar (reimport/edição).
  - Server: `skillsTraduzir` persiste/lê cache; `skillsGetContent` devolve `traducao`;
    `skillsSave` limpa o cache quando o conteúdo muda. `SCHEMA_VERSION` → `v1.44`.

---

## [1.65.0] — 2026-06-18

### Adicionado

- **Skills Hub → tradução sob demanda.** No drawer de uma skill (Atelier → Skills),
  novo botão **Traduzir** que traduz a descrição e o conteúdo Markdown para
  português do Brasil via LLM, **preservando o original** (código, comandos,
  caminhos, URLs e a chave `name` do frontmatter não são tocados). Depois de
  traduzir, um seletor **Traduzido / Original** alterna entre as duas versões a um
  clique. A tradução é efêmera (não altera a planilha) e some ao trocar de skill.
  - Server: `skillsTraduzir(id, idioma?)` reusando `forjaCallLLM`.
  - Cliente: estados de tradução + `Segmented` no `SkillsHubModal`.

---

## [1.64.0] — 2026-06-18

### Adicionado

- **Driver → aba "Como conectar".** Manual passo a passo dentro do app, pra leigo,
  com instruções detalhadas pra conectar contas **Google** e **Microsoft (OneDrive)**:
  Redirect URI com botão de copiar, seções recolhíveis por provedor e dicas de erro
  comuns. Sempre à mão, sem depender de doc externo.

## [1.63.4] — 2026-06-18

### Alterado

- **Driver: abas de fonte com status + tooltip.** Cada aba de conta na tela de
  Arquivos ganha bolinha verde de "conectada" e tooltip com provedor + e-mail
  ao passar o mouse.

## [1.63.3] — 2026-06-18

### Alterado

- **Driver: status visual de conexão.** O avatar de cada conta fica **verde com
  bolinha de status** quando está conectada (cinza quando só registrada). O Drive
  deste app também mostra o indicador verde.

## [1.63.2] — 2026-06-18

### Adicionado

- **Driver: editar conta + rótulo automático.** Botão de editar em cada conta
  (provedor, e-mail, rótulo, notas). Ao registrar/editar, o rótulo vazio assume
  a parte do e-mail antes do @ (ex.: `lazaroweb`) — fim dos vários "Pessoal"
  iguais. No formulário, o rótulo é sugerido automaticamente ao digitar o e-mail.

## [1.63.1] — 2026-06-18

### Alterado

- **Driver → Arquivos: abas de contas no lugar do dropdown.** As fontes (Meu Drive
  + contas conectadas) viram abas lado a lado, estilo navegador. Alternar é
  **instantâneo**: cada aba tem cache de itens por pasta e **lembra a pasta** onde
  você estava. O botão Atualizar força o recarregamento da pasta atual.

## [1.63.0] — 2026-06-18

### Adicionado

- **Driver multi-cloud ao vivo (OAuth).** Conecta de verdade OneDrive (Microsoft
  Graph) e contas Google extras via fluxo OAuth2 (lib `apps-script-oauth2`):
  - Modal **Credenciais OAuth** por provedor (Client ID/Secret no ScriptProperties)
    exibindo a **Redirect URI** (`/usercallback`) pra copiar no Azure/Google.
  - Botão **Conectar** abre o consentimento e verifica a conexão automaticamente
    (polling); **Desconectar** revoga o token local.
  - Aba **Arquivos** ganha seletor de fonte: navega o Drive deste app **ou** as
    contas remotas conectadas (Google extra / OneDrive), com trilha e busca.
  - Tokens por conta no `UserProperties`; credenciais do app por provedor. Nunca
    armazenamos senha.

### Alterado

- `appsscript.json`: adicionada a biblioteca `OAuth2` (apps-script-oauth2, v43).

## [1.62.0] — 2026-06-18

### Adicionado

- **Atelier → Driver (novo).** Estação que navega o Google Drive desta conta
  (read-only, via Advanced Drive Service + escopo `drive.readonly`): trilha de
  pastas, busca dentro da pasta, abrir arquivo no Drive. Trata o caso de
  autorização pendente com CTA pro consentimento do Google.
- **Driver → Contas & nuvens.** Registro central das suas nuvens (OneDrive,
  contas Google extras, Dropbox…). Guarda **apenas metadados** (provedor, e-mail,
  rótulo, status) na sheet `DriveConnectors` — **nunca senha**. A sincronização
  real é desenhada via OAuth (botão "Conectar" preparado, ativação na próxima fase).

## [1.61.0] — 2026-06-18

### Adicionado

- **Importar GAS App Kit (Skills Hub).** Botão na aba "Minhas skills" que semeia a
  biblioteca com as 10 skills do `gas-app-kit` de uma vez. As skills são embarcadas
  no build (`esbuild` lê `gas-app-kit/skills/*/SKILL.md`) e a importação é
  idempotente — reimportar atualiza por `fonte` em vez de duplicar.
- **Padrão de README (skill `gas-readme-standard`).** Novo SKILL.md no kit com a
  ordem canônica de seções, badges, blocos de deploy/rollback e um template
  pronto, pra todas as aplicações subirem pro git no mesmo padrão. O README deste
  repo foi alinhado ao padrão (badges + seção "Deploy & rollback").

## [1.60.2] — 2026-06-18

### Corrigido

- **Tipagem zerada (riscos médios da auditoria).** Eliminados todos os 31 erros de
  `tsc --noEmit` (strict) que o build via esbuild ignorava — agora o type-check
  passa limpo (35 → 0 desde o início da auditoria). Principais:
  - `FinPessoal.tsx`: colisão do identificador `Tag` (antd × lucide) resolvida com
    alias `TagIcon`; `highlight` agora é boolean.
  - `cofreCrypto.ts`: `b64ToBuf` tipado como `Uint8Array<ArrayBuffer>` (compatível
    com `BufferSource` da Web Crypto no TS 5.7).
  - `server.ts`: tipos do Drive, série do DRE (`despesa`), guarda de `hora`,
    índice `ordem`, config do WhatsApp e headers do proxy de LLM.
  - `ObsidianMindmap.tsx`: `dominantBaseline` inválido (`baseline` → `alphabetic`).
  - `Dashboard.tsx`: retorno `null` trocado por fragmento.

### Segurança

- **XSS hardening no Receituário.** `renderMarkdown` passou a escapar todo o input
  antes de aplicar o markdown (antes só o miolo de code blocks era escapado).
  Fecha o sink de `dangerouslySetInnerHTML` para conteúdo de receitas que possa
  vir de import/compartilhamento. (A versão do Norte já escapava tudo.)

## [1.60.1] — 2026-06-18

### Corrigido

- **`_fmtBRL` duplicada (bug de formatação de moeda).** Havia duas definições da
  função `_fmtBRL` em `server.ts` com comportamentos diferentes — uma com 2 casas
  decimais e outra com 0. No escopo global do Apps Script a segunda vencia e
  zerava os centavos em vários textos (análises do Norte, MRR/custo dos sistemas).
  Agora existe uma única `_fmtBRL` canônica em pt-BR, com 2 casas e separador de
  milhar (ex.: `R$ 1.234,56`).
- **Função `_vencimentoNoMes` duplicada** removida (colidia com a versão original).
- **Placeholders de e-mail** trocados para o domínio `example.com` (formulários e
  dados de exemplo), atendendo à política de DLP.

### Manutenção

- Primeiro commit versionando todo o app no git (ponto de rollback). Erros de
  tipo sob `tsc --noEmit` caíram de 35 → 31.

## [1.60.0] — 2026-06-17

### Adicionado

- **Relatórios — Fases 2 e 3 (conclusão da implementação).**
  - **Financeiro** ganhou 3 novos relatórios (todos com PDF, CSV e Excel):
    - **Faturas de cartão** — fatura do mês por cartão (vencimento, status pago/
      aberto, nº de lançamentos) + **provisão das próximas 5 faturas** a partir
      das compras parceladas já lançadas.
    - **Parcelas em aberto** — todas as compras parceladas com parcelas a vencer:
      quanto falta pagar, valor da parcela, restantes e a próxima competência.
    - **Fechamento anual** — 12 meses do ano (entradas × despesas × saldo +
      acumulado) e o ranking de categorias do ano.
  - **Empresa** saiu do placeholder e virou seção completa:
    - **DRE simplificado** — receita recorrente (MRR), custos recorrentes,
      despesas variáveis do mês, resultado, margem e quebra por app.
    - **Livro-caixa** — despesas da empresa no mês (pago/pendente) por categoria
      e app.
    - **MRR / assinaturas** — assinaturas ativas, valor mensal equivalente,
      próxima cobrança e total de MRR.
  - O Excel (XLSX) trata valores como número (dá pra somar) e o CSV sai em pt-BR.

---

## [1.59.0] — 2026-06-17

### Adicionado

- **Relatórios financeiros (Fase 1).** A tela de Relatórios foi reorganizada em
  seções (SubNav): **Financeiro · Empresa · Portfólio · Exportar**.
  - **Financeiro** traz 3 relatórios com filtro de período e pré-visualização:
    - **Extrato mensal** — todos os lançamentos do mês (data, descrição,
      categoria, pagamento, valor) com totais de despesas/entradas/saldo.
    - **Por categoria** — ranking com %, nº de lançamentos e variação vs. o
      mês anterior.
    - **Fluxo de caixa** — entradas × despesas × saldo, com janela de 6/12/24
      meses e saldo acumulado.
  - Cada relatório exporta em **PDF**, **CSV** (pt-BR, separador `;`) e **Excel
    (XLSX)**. O XLSX é montado direto como pacote OOXML (sem Drive nem arquivo
    temporário), respeitando os escopos atuais.
  - **Empresa**: placeholder do que vem a seguir (DRE, livro-caixa, MRR).
  - **Portfólio** e **Exportar**: o relatório mensal, backup JSON, CSV por
    entidade e o resumo por e-mail seguem como estavam, agora organizados.

---

## [1.58.0] — 2026-06-17

### Melhorado

- **Visão geral mais respirável e interativa.**
  - O cartão "Por categoria" deixou de esticar a página sem fim: a lista agora
    **rola internamente** (altura ≈ a do meno Panorama), com scrollbar fina.
  - **Donut interativo (SVG):** ao passar o mouse numa fatia, ela destaca, mostra
    **tooltip com a categoria** (valor e %) e o **centro do gráfico** passa a
    exibir aquela categoria. Fonte do valor central reduzida pra dar mais ar.
  - **Widget "Por método de pagamento" → "Como você pagou":** ganhou ícone,
    uma frase explicando o que é e a **quantidade de lançamentos** por meio, além
    do valor e do percentual.

---

## [1.57.1] — 2026-06-17

### Melhorado

- **Selo de parcela na lista de Lançamentos.** O marcador `2/4` virou
  `parcela 2/4`, com tooltip "Parcela 2 de 4". Parcelas **futuras provisionadas**
  (pendentes em meses à frente) ganham selo **azul** com sufixo `· futura`, pra
  separar visualmente o que já caiu do que ainda vai vencer.

---

## [1.57.0] — 2026-06-17

### Corrigido

- **Importação de fatura: "excedeu o total" agora é tratado como crédito de saldo
  anterior.** Em faturas onde o pagamento do mês anterior foi maior que o saldo
  (ex.: Porto Seguro — pagou R$ 5.600 num saldo de R$ 5.572,31), o "Saldo" da
  fatura já abate esse crédito, então a soma dos lançamentos fica acima do total.
  Antes isso virava um alerta de erro sem saída. Agora:
  - O alerta explica que é, quase sempre, um **crédito de saldo anterior**.
  - Botão **"Lançar −X como crédito"** adiciona uma linha negativa "Crédito de
    saldo anterior" que reconcilia a soma com o total exato da fatura.
  - Os prompts (proxy e Gemini) passaram a detectar esse crédito e emiti-lo como
    item negativo, e a deixar claro que `total` é o valor a pagar ("Saldo").

### Melhorado

- **Provisão de parcelas mais confiável e visível.**
  - Detecção de parcela no servidor agora aceita também **"x de y"** e
    **"parcela x/y"** (antes só "x/y").
  - Os prompts reforçam que a parcela `(x/y)` deve SEMPRE ser preservada na
    descrição — é o que projeta as próximas faturas.
  - Na revisão da importação, cada compra parcelada mostra um **selo**
    (`parcela 2/4 · +2 futura(s)` ou `última`) e um aviso no topo resumindo
    quantas **parcelas futuras serão provisionadas** nos próximos meses.

---

## [1.56.0] — 2026-06-17

### Mudado

- **Menu lateral do Financeiro Pessoal mais enxuto e organizado.** Pra conter o
  crescimento do menu:
  - **"Perfil ideal" e "Ideal × Real" viraram um único item** ("Perfil ideal"),
    com **pílulas internas** trocando entre os recortes: **Meu ideal**,
    **Comparáveis**, **Fora do ideal** e **Plano do real ao ideal**. Tudo do
    perfil num lugar só, sem inflar a barra.
  - **Agrupamento visual no SubNav.** Os itens agora aparecem sob cabeçalhos
    leves de seção — **Panorama**, **Movimento** e **Organização** — deixando a
    lista escaneável e respirável mesmo com muitos itens.
  - Novo componente `FinPerfil` (container dos recortes); `FinIdealVsReal` passou
    a ser controlado por prop (`aba`), sem `Segmented` próprio. Suporte a `group`
    no `SubNav`.

---

## [1.55.0] — 2026-06-17

### Adicionado

- **Plano "do real ao ideal" (nova aba em Ideal × Real).** Um roteiro pra sair do
  gasto de hoje e chegar no orçamento ideal:
  - **Resumo instantâneo (grátis):** anel de "% alinhado ao ideal", **distância
    até o ideal** (R$/mês), **economia potencial** (mês e ano) e a **sobra quando
    no ideal** (puxando a renda da Norte).
  - **Maiores ofensores:** lista priorizada por economia, cada um marcado como
    **cortar**, **adequar** (gasta × alvo), **extra** ou **classificar**.
  - **Roteiro por fases (IA):** a IA sequencia cortes e ajustes em **fases mensais
    realistas** (quick wins primeiro), com economia por fase e acumulada até o
    ideal, o que fazer com a sobra e lembretes pra não recair. O último plano fica
    salvo.
  - Backend: `getPlanoIdealResumo`, `gerarPlanoIdealIA`.

---

## [1.54.0] — 2026-06-17

### Mudado

- **Perfil ideal agora é 100% seu — só o ideal, sem ruído da realidade.** A página
  virou pura construção do orçamento-alvo: cabeçalho enxuto (custo total + anel
  essencial × desejável) e as despesas agrupadas por categoria em **blocos
  colapsáveis** — leve, respirável e premium (fim da lista carregada). Nenhum dado
  do real aparece aqui; você desenha o destino primeiro.

### Adicionado

- **Nova seção "Ideal × Real" (com IA).** Sob demanda, cruza o seu ideal com o
  gasto real em dois recortes (pílulas):
  - **Comparáveis** — só as categorias que têm alvo no ideal: real × alvo, com
    barra + marca e status (dentro / pouco acima / acima). Compara apenas o que é
    equivalente ao ideal.
  - **Fora do ideal** — todo gasto sem alvo, cada um com um **de-para**: mapear
    numa categoria do ideal, **cortar** (não-estrutural) ou **manter fora**. O
    de-para fica salvo e passa a reger a comparação.
  - **Analisar com IA** — a IA relaciona automaticamente cada categoria real ao
    destino (alvo / cortar / fora), explica o porquê e resume o que adequar; você
    revisa e **aplica as sugestões em lote**.
  - Backend: `getIdealComparativo`, `getDeParaIdeal`, `salvarDeParaIdeal`,
    `salvarDeParaIdealLote`, `analisarIdealIA` (sheet `FinIdealDePara`).

---

## [1.53.0] — 2026-06-17

### Adicionado

- **Perfil familiar ideal (novo).** Uma seção em Financeiro › Pessoal pra desenhar
  o **orçamento-alvo** da família: cada despesa essencial (moradia, mercado, saúde,
  educação…) com o valor mensal **ideal**. A tela cruza o alvo com o **gasto real**
  (fixas + variáveis, vindo da Norte) e mostra, **categoria por categoria**, o que
  está dentro e o que precisa regular pra chegar lá — com barra (real) + marca
  (alvo), status colorido e um bloco "pra chegar no ideal, regule primeiro".
  - **Atalho premium:** "Começar do meu real" semeia o perfil com o que você já
    gasta hoje — aí é só baixar pro patamar ideal e correr atrás da diferença.
  - É também o lugar pra **lançar suas despesas fixas/essenciais** (essencial ×
    desejável), dando uma visão clara dos custos que sustentam a casa.
  - Backend: `getPerfilIdeal`, `salvarItemPerfilIdeal`, `removerItemPerfilIdeal`,
    `getPerfilIdealComparativo` (sheet `FinPerfilIdeal`).
- **Norte: despesas variáveis no topo.** O cabeçalho da Norte agora mostra
  **Despesas variáveis** ao lado de renda, fixas e sobra — fim da sensação de
  "desconectado do financeiro real".

### Mudado

- **Lume repaginada — copiloto flutuante e premium.** Saiu o drawer "careta",
  entrou um **painel flutuante** ancorado no canto, com cantos arredondados,
  brilho de topo em gradiente, header com selo "online", sombra em camadas e
  animação de entrada (surge da fagulha). Fecha com **Esc**, é responsivo
  (vira folha quase full no celular) e mantém toda a conversa/dica proativa.

---

## [1.52.0] — 2026-06-17

### Corrigido

- **"Norte" não refletia seus lançamentos de despesa.** A análise de despesas
  variáveis tinha três falhas que faziam o gasto real "sumir":
  1. **Janela errada** — usava só os **3 meses fechados** (excluindo o mês atual),
     então o que você lançava agora não entrava na média. Agora a janela inclui o
     **mês corrente** (+ 3 anteriores).
  2. **Mês contábil errado** — agrupava pela **data da compra**, não pela
     **competência/fatura** (igual ao resto do app). Gastos de cartão importados
     caíam no mês da compra, fora da janela. Agora usa `_competenciaLancamento`.
  3. **Diluição** — dividia por 3 fixo mesmo com 1 mês de dados. Agora calcula a
     **média sobre os meses fechados com dados** (e usa o mês corrente só quando é
     o único histórico, pra um mês parcial não puxar a média pra baixo).

### Adicionado

- **Despesas variáveis por categoria** na "Norte": novo painel mostrando pra onde
  vai o gasto livre (média mensal por categoria, com barras e %), mais um insight
  dedicado ("Despesas variáveis somam ~R$ X/mês, Y% da renda, lideradas por …").
  Agora os lançamentos avulsos alimentam custo total, comprometimento, sobra,
  score e projeções.

---

## [1.51.0] — 2026-06-17

### Adicionado

- **Lume — sua copiloto de IA, em todo o app.** Um botão flutuante (🔥) em todas
  as telas abre a Lume: uma assistente que conhece o **mapa do app** e os seus
  **dados reais** (sistemas, clientes, ideias, custos, alertas) e também responde
  qualquer pergunta de conhecimento geral (código, negócios, design). Movida a
  **Claude** via o proxy já configurado.
  - **Proativa:** ao abrir, ela "puxa assunto" com uma **dica pertinente**
    baseada nos seus dados e na seção em que você está (com botão de nova dica).
  - **Contextual:** sabe em qual seção você está pra sugerir o próximo passo.
  - **Consultiva (read-only):** orienta e explica, sem executar ações — pra ações
    aprováveis (criar ideia/sistema, registrar risco) continue usando a Forja IA.
  - Backend: `lumeChat` e `lumeDica` montam persona + mapa do app + contexto do
    portfólio e chamam o LLM configurado.

---

## [1.50.1] — 2026-06-17

### Corrigido

- **Importação "ficou doida" com pagamentos da fatura (ex.: Porto Seguro).** Depois
  que passamos a capturar estornos como valor negativo, a IA começou a tratar
  também as linhas de **PAGAMENTO** da fatura (ex.: "PAGAMENTO PIX -2.000,00",
  "-3.600,00") como se fossem estornos — o que zerava/invertia o total (a fatura
  de R$ 4.911,48 vinha como −R$ 660,85). Agora distinguimos: **pagamento da
  fatura** (quitação, ex.: PAGAMENTO/PGTO/PAGTO/PIX/débito automático) é
  **ignorado**; só **estornos/devoluções/reembolsos** de compras entram como
  negativo. A regra está no prompt (Gemini e proxy) e também numa trava no
  servidor (`_ehPagamentoFatura`), que barra qualquer linha de pagamento mesmo
  que a IA insista — defesa em profundidade.

---

## [1.50.0] — 2026-06-17

### Alterado

- **Operações no mesmo padrão de seções do Atelier/Configurações.** As tabs
  horizontais ("Status & APIs", "Aplicações", "GitHub", "Monitoramento") viraram
  um trilho lateral (sticky) com ícone, descrição e accent por área — usando o
  componente `SubNav` reaproveitável. No mobile, o trilho vira faixa horizontal
  rolável. Só a seção ativa é montada (mesmo efeito do `destroyInactiveTabPane`).
- **Guia do Atelier mais leve (sem perder a amostragem).** A primeira tela do
  Atelier estava carregada: cada um dos 8 cards trazia "Quando usar" + um
  passo-a-passo de 3 itens, deixando a página muito alta. Agora os cards são
  compactos (ícone, contagem, o que é em até 3 linhas e CTA) e o "Quando usar"
  aparece no tooltip ao passar o mouse — a vitrine das estações continua, mas
  cabe muito mais na tela. Boas-vindas e checklist de setup foram preservados,
  só um pouco mais enxutos.

---

## [1.49.0] — 2026-06-17

### Corrigido

- **Flash do aviso "Gemini não conectado" na importação de fatura.** Ao abrir a
  janela de importar, o alerta laranja piscava por uma fração de segundo antes
  da checagem da chave voltar do servidor. Agora a verificação acontece por trás
  e o aviso (e a etiqueta "Modo texto") só aparecem **depois** de confirmado que
  o Gemini realmente não está conectado.
- **Estornos/créditos ignorados na leitura da fatura (valor errado).** A IA
  estava instruída a *ignorar* estornos e o código forçava valor positivo —
  então um "ESTORNO DE ANUIDADE -22,00" sumia e a soma estourava o total da
  fatura (ex.: fatura Itaú fechava em R$ 1.422,30 mas vinha R$ 1.444,30,
  "excedendo R$ 22"). Agora estornos, créditos, devoluções e descontos entram
  como **valor negativo** e abatem o total — a conciliação bate. Vale tanto pra
  leitura via Gemini (PDF direto) quanto pelo proxy (texto). A linha de revisão
  passa a aceitar valores negativos.

---

## [1.48.0] — 2026-06-17

### Alterado

- **Redesign da tela de Configurações (premium e navegável).** Em vez de uma
  única página gigante com tudo empilhado, agora há um trilho lateral de seções
  (estilo "Ajustes" do macOS): Conta & Acesso, Inteligência (IA), Integrações,
  Financeiro, Automações & Alertas, Dados & Backup e Catálogo de Stacks. Cada
  seção mostra ícone, descrição e um indicador de status (verde = configurado,
  laranja = pendente) para IA e GitHub — dá pra ver tudo que existe de relance,
  sem rolar. No mobile, o trilho vira uma faixa horizontal de abas.

---

## [1.47.2] — 2026-06-17

### Corrigido

- **Contraste do `Alert` no tema noturno.** Os avisos apareciam como "caixa
  branca" ilegível no escuro porque o app não usa o darkAlgorithm do antd.
  Tematizamos o `Alert` (info/success/warning/error) globalmente em `theme.ts`,
  derivando fundo, borda, ícone e texto da paleta — conserta todos os alerts de
  uma vez (atuais e futuros).

### Adicionado

- **Regra do Cursor `theme-contrast`** (`.cursor/rules/`): passa a validar
  contraste nos temas claro/noturno em todo trabalho de UI, exigindo uso de
  tokens em vez de cores fixas.

---

## [1.47.1] — 2026-06-17

### Adicionado

- **Passo a passo de ativação do WhatsApp** dentro do próprio card (recolhível):
  instruções para Twilio (Sandbox), Meta Cloud API (oficial) e observações
  importantes sobre templates, opt-in e número dedicado.

---

## [1.47.0] — 2026-06-17

### Adicionado

- **Canal de WhatsApp para alertas.** Novo canal em Configurações → Automações &
  Alertas que envia os alertas (incluindo vencimentos) por WhatsApp para vários
  números (você + família). Suporta dois provedores:
  - **Meta WhatsApp Cloud API** (oficial): Phone Number ID + Token; envio por
    template aprovado ou texto livre (número de teste / janela de 24h).
  - **Twilio** (Sandbox ou número aprovado): Account SID + Auth Token + remetente.
- **Botão "Salvar e enviar teste".** Dispara uma mensagem de teste para todos os
  números e reporta erros por destino.
- Os tokens ficam guardados no servidor e nunca voltam para a tela (só uma flag
  "token salvo"); preencha de novo apenas para substituir.

---

## [1.46.2] — 2026-06-17

### Alterado

- **Tema e Atalhos voltaram pro rodapé da barra lateral.** O ícone de tema saiu
  de perto do perfil (estava apertado) e agora fica no rodapé da sidebar, com
  rótulo "Modo claro/noturno", junto de "Atalhos" — ambos sempre visíveis. O
  canto superior direito ficou só com o menu de perfil.

---

## [1.46.1] — 2026-06-17

### Alterado

- **Alertas não abrem mais sozinhos.** O painel de alertas deixou de abrir
  automaticamente no login. Agora só sinaliza com a bolinha/badge (no avatar,
  no menu de perfil e no sino do mobile) — você abre quando quiser.

---

## [1.46.0] — 2026-06-17

### Alterado

- **Menu de conta no perfil (desktop).** O cartão de perfil no canto superior
  direito virou um menu: ao clicar, abre **Guia de início**, **Alertas** (com
  contador de não-lidos) e **Configurações** (admin). Esses itens saíram do
  rodapé da barra lateral pra concentrar "tudo da minha conta" num lugar só.
  No mobile continuam acessíveis pelo menu lateral e pelo sino da topbar.
- **Badge de alertas no avatar.** O número de alertas não-lidos aparece sobre a
  sua foto, visível de qualquer tela.

### Adicionado

- **Alertas no login.** Quando há alertas não-lidos, o painel de alertas abre
  automaticamente uma vez por sessão ao entrar no app.

---

## [1.45.0] — 2026-06-17

### Adicionado

- **Categoria "Mercado Livre".** Nova categoria padrão (criada automaticamente na
  sua base no próximo carregamento). A IA e as regras aprendidas passam a encaixar
  compras do Mercado Livre nela.
- **Modal de resultado da reclassificação.** Ao terminar de reclassificar com IA,
  um modal mostra o resumo: quantos foram por regra, quantos pela IA e quantos
  continuam em "Outros".
- **Botão "Reclassificar 'Outros' com IA" fora do modal.** Aparece direto no
  cabeçalho "Por categoria" da Visão geral (quando existem itens em "Outros").
- **Tela de regras aprendidas em Configurações.** Novo painel "Regras de categoria
  aprendidas" pra revisar, trocar a categoria ou apagar cada regra (comércio →
  categoria), com indicação de origem (manual ou IA).

---

## [1.44.0] — 2026-06-17

### Adicionado

- **Reclassificação inteligente de categorias (com aprendizado).** No modal de
  "Outros" da Visão geral há um botão **"Reclassificar com IA"**: a IA (Gemini,
  com fallback proxy) encaixa os lançamentos nas suas categorias existentes pelo
  nome do comércio. Além disso, toda vez que você **recategoriza manualmente** um
  item, o app **aprende uma regra** (comércio → categoria) e a reaplica
  automaticamente em lançamentos iguais do mês — e também nas **próximas
  importações** de fatura. Nova aba `FinPessoalRegrasCategoria` guarda as regras
  e a IA também vira regra quando acerta.

## [1.43.0] — 2026-06-17

### Adicionado

- **Detalhe de categoria com recategorização.** Na Visão geral, cada categoria
  do "Por categoria" agora é clicável e abre um modal listando os lançamentos
  daquele mês que a compõem — com cartão (bolinha colorida + nome), data, valor e
  status. Dá pra **recategorizar inline** (Select por item) ou abrir o lançamento
  pra edição completa. Reaproveita o `salvarLancamentoPessoal` e atualiza os
  totais na hora.

## [1.42.0] — 2026-06-17

### Corrigido

- **Modelo Gemini atualizado (gemini-2.0-flash foi desligado).** O Google desligou
  o `gemini-2.0-flash` em 01/06/2026 (erro 404 NOT_FOUND). O padrão agora é
  `gemini-3.5-flash` e adicionei **migração automática**: quem tinha um modelo
  antigo salvo (2.0-flash, 1.5-flash etc.) passa a usar o sucessor atual sem
  precisar reconfigurar. O seletor em Configurações foi atualizado com os modelos
  vigentes (3.5-flash, 3.1-flash-lite, 2.5-flash, 2.5-pro).

## [1.41.1] — 2026-06-17

### Alterado

- **Mensagem de erro 429 do Gemini mais útil.** Agora explica que é cota do free
  tier e lista as soluções (aguardar, ativar faturamento no projeto da chave, ou
  usar o proxy — para o qual o app já cai automaticamente).

## [1.41.0] — 2026-06-17

### Adicionado

- **Aviso forte quando o Gemini não está conectado.** O modal de importar fatura
  agora mostra um alerta destacado explicando que a leitura vai usar o proxy
  (menos estável, sujeito a 529) e ensinando a conectar o Gemini em
  Configurações → Google Gemini pra leitura direta do PDF.

### Alterado

- **Gemini mais resiliente na importação.** `geminiGenerateContent` ganhou retry
  com backoff (2s, 4s) em erros transitórios (429/500/502/503/529), reduzindo a
  chance de cair pro proxy por um soluço passageiro. A cadeia de fallback
  continua: Gemini (primário) → proxy (texto via pdf.js) se o Gemini falhar.

## [1.40.1] — 2026-06-17

### Corrigido

- **Importação de fatura mais resiliente a sobrecarga do LLM (HTTP 529).** O erro
  "overloaded_error" não é do nosso endpoint — é o provedor do LLM (Anthropic)
  temporariamente sobrecarregado. Agora o `llmFetch` tenta de novo
  automaticamente em códigos transitórios (429/500/502/503/529) com backoff
  exponencial (2s, 4s) antes de desistir, e a mensagem de erro de 529/503 ficou
  mais clara, sugerindo aguardar ou conectar o Gemini pra leitura mais estável.

## [1.40.0] — 2026-06-17

### Adicionado

- **Aviso de vencimentos próximos (popup).** Ao abrir o mês corrente, se houver
  cartões com fatura em aberto vencendo nos próximos 7 dias (ou já vencida),
  aparece uma notificação no canto listando cada cartão, quantos dias faltam (ou
  há quanto venceu) e o valor pendente, com um botão "Ver cartões". Aparece uma
  vez por sessão pra não incomodar a cada refresh e usa o `aPagarMes`/
  `diaVencimento` de cada cartão.

## [1.39.1] — 2026-06-17

### Alterado

- **Cartões mais retangulares (formato de cartão real).** Aumentei o mínimo do
  grid (244px → 360px), então os cards crescem pros lados em vez de ficarem quase
  quadrados — em geral 2 por linha, com respiro. Sem voltar ao tamanho antigo.
- **Sinal de status com contorno branco.** O círculo verde/laranja ganhou borda
  branca + sombra suave pra destacar do fundo colorido do cartão, resolvendo o
  problema de contraste.

## [1.39.0] — 2026-06-17

### Adicionado

- **Sinal de status na frente de cada cartão.** Um círculo colorido ao lado do
  ícone do cartão mostra num relance a situação da fatura do mês selecionado:
  **verde** = paga (sem pendência), **laranja** = em aberto. O tooltip mostra o
  valor exato pendente. `getCartoesPessoais` passou a receber o mês e enriquece
  cada cartão com `aPagarMes` (pendente por competência da fatura).

### Alterado

- **Cartões mais compactos.** Reduzi padding, fontes e o mínimo do grid
  (280px → 244px) mantendo respiro — agora cabem mais cartões por linha sem
  ficar apertado.

## [1.38.1] — 2026-06-17

### Corrigido

- **Cards de resumo numa linha só.** O card "Assinaturas/mês" estava quebrando
  pra uma segunda linha e empurrando o layout. Reduzi o mínimo do grid
  (184px → 150px) e deixei os 6 cards um pouco mais compactos (ícone, fontes e
  espaçamento) com truncamento elegante — agora cabem todos na mesma linha em
  telas normais e quebram bem em telas estreitas. Nenhuma informação removida.

## [1.38.0] — 2026-06-17

### Alterado

- **Visão geral redesenhada (premium).** Novo hero com um donut de gastos por
  categoria (furo central com o total do mês) + ranking de categorias usando os
  ícones outline da biblioteca (lucide) — adeus emojis. "Por método de pagamento"
  também ganhou os mesmos badges de ícone, barras mais encorpadas e melhor
  distribuição visual.
- **Ações do drawer da fatura voltaram pro topo.** "Atribuir a membro" e
  "Remover importados" estavam descendo pro meio quando a janela atual tinha
  muitos itens; agora ficam fixas no topo do drawer, junto da barra de
  atribuição em lote.

## [1.37.1] — 2026-06-17

### Alterado

- **Badge "A pagar" do menu lateral agora reflete o mês.** Antes contava todos
  os pendentes (incl. parcelas futuras); agora mostra a mesma quantidade do
  widget "A pagar no mês" (competência selecionada). A seção "A pagar" segue
  listando tudo agrupado por vencido / 7 dias / futuro.

## [1.37.0] — 2026-06-17

### Alterado

- **Widget "A pagar" agora é do MÊS, não do total.** Antes mostrava todos os
  pendentes (incluindo parcelas futuras), o que inflava o número. Agora "A pagar
  no mês" mostra só o que falta pagar na competência selecionada — então
  `Gasto do mês = Pago no mês + A pagar no mês`.

### Adicionado

- **Widget "Pago no mês"**: total já pago na competência selecionada (verde),
  ao lado do "A pagar no mês".

## [1.36.3] — 2026-06-17

### Corrigido

- **CAUSA RAIZ da "Fatura atual" zerada (e parcelas no mês errado).** O Google
  Sheets converte strings de data (ex.: "2026-06-19") em objetos `Date` ao
  gravar. No servidor, `_competenciaLancamento` fazia `String(vencimento)` num
  `Date` ("Fri Jun 19 2026…"), o regex `YYYY-MM` falhava e a competência caía no
  mês da COMPRA em vez do mês do VENCIMENTO. Por isso as parcelas atuais iam pro
  mês de compra e a "Fatura atual" do mês aparecia R$ 0, mesmo com os dados
  gravados corretamente. Agora normaliza com `_toYYYYMM` (trata `Date` e string).
  Afeta também Painel 12 meses, Visão geral, Lançamentos e o KPI "próximos 7
  dias" — todos passam a posicionar a despesa de cartão no mês certo. **Não
  precisa reimportar**: os vencimentos já estavam corretos, só a leitura quebrava.

## [1.36.2] — 2026-06-17

### Corrigido

- **"Remover importados" travava e parecia não responder** (e às vezes removia
  "em duas etapas"). A remoção apagava as linhas UMA A UMA — cada apagada relia
  a planilha inteira e deslocava linhas (O(n²)), engasgando com muitos itens.
  Agora apaga em lote (1 leitura + 1 reescrita) via `dbDeleteMany`. O mesmo vale
  pra remover um grupo de parcelas e pra dar baixa em fatura (`dbUpdateMany`).

### Adicionado

- **Indicador de progresso** nos botões "Remover importados" e "Pagar fatura":
  ficam com spinner ("Removendo…" / "Dando baixa…"), bloqueiam clique duplo e
  mostram um aviso de carregamento até concluir.

## [1.36.1] — 2026-06-17

### Corrigido

- **"Fatura atual" do cartão aparecia R$ 0 após importar.** O cálculo filtrava
  pela DATA da compra dentro da janela do ciclo; itens importados (data de compra
  antiga + vencimento explícito no mês) ficavam de fora, então a "Fatura atual"
  zerava mesmo com tudo certo em "Total em aberto". Agora a "Fatura atual" é a
  fatura que VENCE no mês selecionado (competência), igual ao resto do app
  (painel, lançamentos, a pagar) — e a janela exibida foi corrigida pro ciclo
  certo. As parcelas futuras seguem aparecendo só nos seus meses ("Próximas
  faturas") e em "Total em aberto" (limite comprometido).

## [1.36.0] — 2026-06-17

### Adicionado

- **Provisionamento de parcelas na importação.** Ao importar uma fatura, as
  compras parceladas (formato `x/y` na descrição — ex.: Bradesco `(05/06)`,
  Porto `03/03`) agora geram a parcela atual + as **parcelas futuras** como
  lançamentos pendentes nos meses seguintes. Vira "débito futuro": aparece no
  Painel anual, em "Próximas faturas" do cartão e compromete o limite — igual o
  banco mostra em "Total para próximas faturas".
- **Proteção contra duplicação ao reimportar.** Cada compra parcelada recebe um
  `parcelaGrupoId` determinístico (cartão + descrição + total de parcelas +
  valor + mês da 1ª parcela). Quando você importa a fatura seguinte, a mesma
  compra cai no mesmo grupo (que já existe) e é **ignorada** — só as compras
  novas entram. Itens à vista têm dedupe por (cartão + mês + descrição + valor).
  A tela de conclusão mostra quantas parcelas foram provisionadas e quantos
  itens já existiam (ignorados).

### Corrigido

- **Parser de parcela mais robusto** e prompts (texto e Gemini) reforçados pra
  preservar o `x/y` na descrição, essencial pra projetar as próximas faturas.
- A projeção client-side de "Próximas faturas" deixou de duplicar parcelas que
  agora já são materializadas como lançamentos reais.

## [1.35.0] — 2026-06-17

### Alterado

- **Status padrão da importação agora é "Pendente".** Ao abrir a importação, a
  opção já vem como Pendente (antes era Pago), evitando lançar uma fatura como
  paga sem querer.

### Adicionado

- **Cronômetro durante a importação.** A tela de leitura mostra um contador
  `mm:ss` enquanto a IA lê a fatura, deixando claro que o processo está rodando.

### Corrigido

- **Importação falhando com "A IA não retornou um JSON válido" (ex.: Itaú).**
  Faturas com valores no formato brasileiro (1.285,90) faziam a IA devolver JSON
  inválido (vírgula no meio do número). Agora há (1) prompt reforçado proibindo
  vírgula/separador de milhar nos números e (2) um reparo automático que
  normaliza os campos `valor`/`total` (BR → ponto decimal) antes do parse, nos
  caminhos de texto e do Gemini. O limite de tokens do caminho de texto subiu de
  4000 para 8000 pra reduzir truncamento em faturas grandes.

## [1.34.1] — 2026-06-17

### Alterado

- **Mais ícones de pessoa/gênero para os membros.** O set de ícones (contorno) foi
  ampliado com mulher, homem, criança, bebê, casal e família, além de relação
  (estudante, trabalho, casa) e pets. São SVGs inline no estilo Tabler Icons (MIT),
  sem adicionar dependência. Chaves antigas têm alias pra não quebrar quem já
  escolheu um ícone.

## [1.34.0] — 2026-06-17

### Alterado

- **Conta e tema saíram do sidebar pro canto superior direito.** O cartão de
  perfil/login e a alternância de tema (agora só um ícone Sol/Lua) viraram um
  cluster fixo no topo direito (`TopRightControls`), dando mais respiro ao
  sidebar. O rodapé do menu ficou só com Guia, Alertas, Atalhos e Configurações.
- **Widget "Gastos por membro" maior e com mais respiro.** Ocupa mais largura na
  hero da Família; donut maior com **anel mais fino** (o valor central não encosta
  mais na cor). O toggle **Em aberto / Total** virou um seletor custom com mais
  contraste (pílula preenchida no estado ativo).

## [1.33.2] — 2026-06-17

### Alterado

- **Ícones dos membros agora são de contorno (lucide), iguais aos do menu.** Os
  avatares de membro deixaram de usar emoji e passaram a usar a mesma biblioteca
  do sidebar (`lucide-react`), só contorno. Novo seletor de ícones no cadastro do
  membro (pessoa, coração, casa, formatura, bichos, etc.). Aplicado em: cards de
  membro, título do drawer, seletor de cobrança e chips/avatares de atribuição no
  Pessoal. Membros antigos com emoji continuam exibindo o emoji (compatibilidade);
  sem ícone, cai na inicial do nome. Componente compartilhado em
  `components/membroIcone.tsx`.

## [1.33.1] — 2026-06-17

### Alterado

- **Pizza de gastos por membro reposicionada e com toggle.** Saiu do rodapé (onde
  ficava solta) e foi **embutida no widget de topo da Família**, lado a lado com o
  "A receber". Ganhou um **toggle "Em aberto / Total"** (em aberto = só o pendente;
  total = pendente + pago) e um donut mais compacto com legenda enxuta.
- **Cards de membro mais compactos.** Padding, avatar e fontes reduzidos e grid de
  `220px` (antes `280px`) pra caber mais por linha e dar mais harmonia à página.

## [1.33.0] — 2026-06-17

### Adicionado

- **Limite disponível na frente do cartão.** O card do cartão agora mostra o
  **limite disponível** (em vez do limite total), com barra de uso e "X usado de
  Y". O `getCartoesPessoais` passou a enriquecer cada cartão com `emAberto` e
  `disponivel` (soma dos lançamentos de cartão não pagos). Sem itens em aberto,
  continua mostrando o limite total.
- **Importar fatura direto do cartão.** O botão de importar saiu do topo do painel
  de Cartões e virou uma ação **em cada card** (ícone de importação), que abre o
  modal já com **aquele cartão pré-selecionado**. Mais limpo e sem escolher o
  cartão errado. O botão global no topo do Financeiro continua disponível.
- **Pizza de gastos por membro na Família.** Novo gráfico de rosca (donut) que
  mostra a **participação de cada membro** no total atribuído (pendente + pago),
  com legenda de valor e percentual, usando a cor de cada membro.

## [1.32.0] — 2026-06-17

### Adicionado

- **Atribuição em lote de uma fatura a membros da família.** Na gaveta do cartão,
  em "Todos os lançamentos deste cartão", há um botão **"Atribuir a membro"** que
  liga o modo de seleção: escolhe-se um membro e ou se atribui a **fatura inteira**
  (100% de cada item) ou se **marcam itens específicos** via checkbox. Dá pra
  atribuir um conjunto a um membro e, em seguida, trocar de membro e marcar o
  restante. Cada item vai 100% pro membro (na competência do mês ativo), refletindo
  na seção Família. Backend: novo `atribuirLancamentosLote` (replace idempotente
  por lançamento).

## [1.31.3] — 2026-06-17

### Corrigido

- **Alertas da importação com fundo claro no tema noturno.** O tema não usa o
  darkAlgorithm do antd, então o `Alert` (ex.: "Bate com o total da fatura")
  renderizava com fundo pastel claro/"branco", ilegível no escuro. Agora os
  alertas da importação (conciliação e erro) usam cores derivadas do tema.
- **Botão "Ver em A pagar" não navegava.** Ao concluir a importação, o botão só
  recarregava sem mudar de seção. Agora ele fecha o modal e **leva direto** pra
  "A pagar" (se importou como pendente) ou "Lançamentos" (se pago), com o rótulo
  ajustado ao destino.

## [1.31.2] — 2026-06-17

### Corrigido

- **Importação de fatura sem feedback / "volta pra mesma tela".** O spinner de
  leitura era estático (parecia travado) e, quando a leitura/gravação falhava, o
  erro era só um toast que sumia — o usuário caía de volta no upload sem entender.
  Agora: spinner **animado** + barra de progresso ativa + aviso "não feche", e o
  erro fica **fixo num alerta** com a mensagem real (closable), na leitura e na
  gravação. Endurecido o tratamento de `null` do `google.script.run`.

## [1.31.1] — 2026-06-17

### Adicionado

- **Mini-gráfico de barras por cartão no drawer do mês.** Logo abaixo dos stats,
  uma barra horizontal por cartão mostra a proporção de cada um no total de
  despesas (valor + %), usando a cor do cartão. Leitura instantânea de "onde foi
  o dinheiro" no mês.

## [1.31.0] — 2026-06-16

### Adicionado

- **Detalhe do mês no Painel 12 meses (clicável).** Cada widget de mês agora abre
  um drawer com a **composição completa**: 3 stats (receita/despesa/saldo),
  despesas **agrupadas por cartão** com cada lançamento (data, categoria, status,
  valor) e o bloco de receitas. Escala bem com vários cartões — o widget de capa
  fica enxuto e o detalhe vai pro drawer.
- **Export PDF do mês.** Botão "PDF" no drawer do mês gera um resumo premium
  (stats + cada cartão com seus itens + receitas), igual ao PDF da Família. Novos
  endpoints `getComposicaoMes` e `gerarPdfMesPainel` (fonte única com o drawer).

## [1.30.1] — 2026-06-16

### Mudado

- **Competência de cartão agora é o mês do VENCIMENTO (quando você paga), não o
  mês da compra nem o do fechamento.** É isso que importa pro painel e pro "gasto
  do mês": o que você tem que pagar naquele mês. Novo helper `_faturaInfoCartao`
  (usa `diaFechamento` + `diaVencimento`).
- **Importação de fatura ganhou seletor "Mês da fatura (vence)".** Toda a fatura
  importada entra junta no mês escolhido — cada item recebe o `vencimento` do
  cartão naquele mês, então não se espalha por competências diferentes só porque
  as datas de compra cruzam o dia de fechamento. (Pra corrigir uma fatura já
  importada no mês errado, reimporte escolhendo o mês certo.)

### Adicionado

- **PIX e telefone no membro da Família.** Campos no cadastro do membro; o PIX
  aparece no PDF de cobrança (com fallback pro PIX do perfil) pra o membro te
  pagar, junto com relação/telefone no cabeçalho.

## [1.30.0] — 2026-06-16

### Adicionado

- **Painel 12 meses (Pessoal › "Painel 12 meses").** A visão "ouro": o ano
  inteiro num relance. Por mês mostra **receita** (salário e afins), **despesa
  por cartão** + outros, **saldo do mês** e **saldo acumulado** (positivo ou
  negativo). Meses futuros **projetam** salário, gastos recorrentes e parcelas já
  lançadas. Navegação por ano e totais do ano no topo. Botão "Lançar salário".
  Novo endpoint `getPainelAnual(ano)`.
- **PDF de cobrança do membro (Família › drawer › botão "PDF").** Gera um
  documento premium com tudo que o membro deve, detalhando **cartão, data da
  compra, vencimento da fatura, competência e valor**, com total e PIX. Novos
  endpoints `getCobrancasMembroDetalhado` e `gerarPdfCobrancasMembro`.

### Corrigido

- **Drawer do membro aparecia vazio (Família).** `getCobrancas` devolvia linhas
  cruas; o `competencia`/`dataPagamento` vinham do Sheets como `Date` e o
  `google.script.run` falhava em silêncio (voltava `null`). Agora sanitiza tudo —
  o drawer lista **todas as cobranças somadas**, de todos os meses, com detalhe
  do cartão, data da compra e vencimento.
- **Receita não refletia na aba Receitas.** `getRecorrenciasAtivas` não
  sanitizava o campo `data` (vira `Date`), quebrando a serialização → a lista de
  recorrências (e o salário cadastrado) ficava vazia. Sanitizado.
- **Visão geral e Lançamentos vazios.** Filtravam pelo mês da **data da compra**;
  despesas de cartão (datadas em meses anteriores) só apareciam em "A pagar".
  Agora despesa de cartão entra no **mês da fatura (competência)** — o "gasto do
  mês", a Visão geral e a aba Lançamentos passam a refletir o cartão. Novos
  helpers `_compFaturaCartao` / `_competenciaLancamento`.

## [1.29.3] — 2026-06-16

### Corrigido

- **Atribuição não aparecia na Família mesmo com o avatar marcado.** A Família
  filtrava as cobranças do membro **só pelo mês ativo**. Uma atribuição lançada
  em outra competência (ex.: uma cobrança criada por uma versão anterior na
  competência do lançamento, maio) tinha o avatar (que não olha mês) mas ficava
  invisível na Família de junho. Agora o card do membro mostra **tudo o que ele
  deve em aberto, somando todos os meses** — nada de atribuição "escondida". O
  drawer do membro lista o histórico completo com a tag da competência de cada
  cobrança.
- **Valor "mudava" de R$ 92 pra R$ 91,96 ao atribuir.** Não era a atribuição: o
  `formatBRL` exibia **reais inteiros** (`maximumFractionDigits: 0`), então uma
  despesa de R$ 91,96 aparecia como "R$ 92" no cartão, e o campo de atribuição
  (com o valor exato) mostrava 91,96. Agora os valores são exibidos com **2
  casas decimais** em todo o app — o que está no cartão bate com o da atribuição.

### Alterado

- Hero da Família: "A receber" passou a ser **em aberto (todos os meses)**;
  "Recebido no mês" continua mensal.

---

## [1.29.2] — 2026-06-16

### Corrigido

- **Atribuir membro "sumia" / não criava cobrança** (causa raiz do relato
  "atribuí pro Lazaro e não apareceu nada"). Ao marcar um membro, o valor ficava
  em **R$ 0** e o salvar descartava quem tinha valor 0 — então marcar e salvar
  não criava cobrança nenhuma (e ainda mostrava "Atribuição removida"). Agora:
  - marcar um membro **auto-preenche o valor** com o saldo ainda não atribuído
    (o 1º membro pega o valor cheio do lançamento; os demais, o que sobrou);
  - se houver membro marcado com valor 0, o salvar **avisa** em vez de apagar a
    atribuição em silêncio.

  Com isso a cobrança passa a ser criada de fato, o avatar do membro aparece na
  linha do lançamento e o valor reflete na aba Família no mês ativo.

---

## [1.29.1] — 2026-06-16

### Corrigido

- **Atribuição não aparecia na aba Família**. A cobrança era gravada na
  competência do *mês do lançamento* (ex.: maio, no caso de fatura importada),
  mas a Família mostra o **mês ativo** (junho) — então a atribuição "sumia".
  Agora a cobrança é criada na competência do mês ativo da tela, aparecendo
  imediatamente na Família. A modal informa em qual mês a cobrança vai cair.

### Alterado

- **Avatar do membro no lugar do "boneco"**. Depois de atribuir, a linha do
  lançamento (no cartão e em A pagar) mostra o(s) avatar(es) do(s) membro(s)
  (emoji/inicial na cor dele) no lugar do ícone genérico de pessoas. Clicar
  continua abrindo a modal pra editar/remover a atribuição. Tooltip lista os
  nomes.
- Novo endpoint leve `getAtribuicoesLancamentos` (só `origemId`+`membroId`, de
  todos os meses) pra marcar os lançamentos já atribuídos em qualquer tela.

---

## [1.29.0] — 2026-06-16

### Adicionado

- **Atribuir lançamento a membro(s) da família (com rateio)**. Botão de membro
  (ícone de pessoas) nas linhas de lançamento do **cartão** e em **A pagar**.
  Abre uma modal pra escolher um ou mais membros e dividir o valor — botão
  "Dividir igualmente", validação de quanto sobra (sua parte) ou excede, e
  pré-preenchimento se o lançamento já tiver atribuição. Cria uma cobrança
  pendente por membro na aba Família.
  - Backend: `atribuirLancamentoMembros` (replace idempotente das cobranças do
    lançamento) e `getCobrancasDoLancamento` (pré-preenchimento).

---

## [1.28.1] — 2026-06-16

### Corrigido

- **Segurança/lógica: item de fatura não se paga individual**. Em "A pagar", os
  lançamentos de cartão agora mostram **"Via fatura"** (desabilitado, com dica
  apontando pra Cartões → cartão), porque você quita a fatura inteira, não item
  a item. Só lançamentos avulsos (pix, boleto, dinheiro) mantêm o botão "Pagar".

---

## [1.28.0] — 2026-06-16

### Adicionado

- **"Pagar fatura" (baixa em lote) no drawer do cartão**. Botão que dá baixa de
  uma vez em tudo que está **vencido ou vence no mês corrente** — sem tocar nas
  parcelas futuras. Mostra quantos itens e o total antes de confirmar. Novo
  endpoint `marcarLancamentosPagos` no servidor (uma chamada para N baixas).

### Melhorado

- **Botão de pagamento por item agora diz "Pagar"** (era "Pago", que parecia um
  status de "já pago"). Deixa claro que é a ação de dar baixa.

---

## [1.27.1] — 2026-06-16

### Melhorado

- **Fluxo visual da importação de fatura**. Antes, se a gravação falhava (ou o
  google.script.run devolvia resposta truncada), a tela ficava "importando" pra
  sempre e nada era lançado. Agora:
  - Etapa **"Importando…"** com spinner e aviso "não feche esta janela".
  - Etapa **"Importação concluída"** com check verde, total lançado, cartão e
    status — e botão **"Ver em A pagar"** que fecha o modal e dá refresh
    (o valor aparece no widget A pagar na hora).
  - Em caso de falha, volta pra revisão **mantendo os dados** e mostra erro
    acionável (em vez de travar). A janela fica protegida contra fechar acidental
    durante a gravação.

---

## [1.27.0] — 2026-06-16

### Adicionado

- **Provisionamento de faturas futuras (aba "Próximas faturas" no drawer do
  cartão)**. Projeta os próximos meses de fatura a partir dos lançamentos em
  aberto:
  - Detecta parcelamento por dois caminhos: campos estruturados (parcela manual
    "12x") e **parse do "x/y" no texto** das linhas importadas (ex.: "Ethos Car
    4/8" → projeta 5/8, 6/8, 7/8, 8/8 nos meses seguintes).
  - Agrupa por mês, marca cada parcela futura com tag **"provisão"**, e mostra
    o total provisionado dos próximos meses.

### Melhorado

- **Topo do drawer do cartão com visão dupla**: "Fatura atual" (janela de
  fechamento) **e** "Total em aberto" lado a lado, com a barra de uso do limite
  baseada no em aberto. As listas ("Lançamentos" e "Próximas faturas") ficam em
  abas separadas.

---

## [1.26.6] — 2026-06-16

### Melhorado

- **Painel do cartão: uso real do limite**. O topo do drawer mostrava "FATURA
  ATUAL" com a soma só da janela de fechamento do mês — que fica R$ 0 logo após
  o fechamento, dando a falsa impressão de cartão zerado mesmo com parcelas em
  aberto. Agora:
  - O valor de destaque é **"Em aberto"** = soma de tudo não-pago no cartão.
  - **Barra de progresso de uso do limite** real (em aberto ÷ limite), com cor
    que escala (verde < 50% · âmbar < 80% · vermelho ≥ 80%).
  - **Disponível = limite − em aberto**, exibido com o valor usado.
  - A fatura da janela atual vira uma linha secundária (transparência), e o
    placeholder "Sem lançamentos nessa janela" só some quando a janela está
    vazia — a lista completa do cartão fica logo abaixo.

---

## [1.26.5] — 2026-06-16

### Corrigido

- **Drawer do cartão mostrando "0 lançamentos" (mesma causa raiz da v1.26.4)**:
  `getLancamentosPorCartao` e `getFaturaAberta` também devolviam linhas cruas da
  planilha, então uma célula não-serializável fazia o google.script.run voltar
  null e o painel "TODOS OS LANÇAMENTOS DESTE CARTÃO" aparecia vazio — mesmo com
  os itens visíveis em "A pagar". Agora ambos sanitizam as linhas com
  `_sanitizarLinha`, então a lista (com botões editar/excluir e "Remover
  importados") finalmente carrega.

---

## [1.26.4] — 2026-06-16

### Corrigido

- **CAUSA RAIZ encontrada — "A pagar" vazia apesar do resumo apontar pendentes**:
  o `google.script.run` devolve `null` SILENCIOSAMENTE quando o retorno tem
  algum valor não-serializável (célula que o Sheets devolveu como `Date`, número
  `NaN`/`Infinity`, ou valor de erro tipo `#N/A` vindo da importação da fatura).
  Por isso o resumo (que retorna só números agregados) funcionava, mas a lista
  de pendentes (linhas cruas da planilha) voltava vazia — divergência clássica.
  - Novo `_sanitizarLinha()` no servidor coage todo campo a um primitivo
    JSON-safe (Date → `YYYY-MM-DD`, `NaN/Infinity` → 0) antes de devolver.
    Aplicado a `getPendentesPessoais` e `getLancamentosPessoais`.
  - `getResumoFinPessoal` agora devolve `pendentesLista` (sanitizada). O client
    usa essa lista como **fonte única** — contador e lista são calculados no
    mesmo lugar, então é impossível divergirem. O endpoint dedicado vira só
    fallback.

---

## [1.26.3] — 2026-06-16

### Corrigido

- **Causa raiz da lista de pendentes vazia**: o cliente chamava `getLancamentosPessoais`
  duas vezes em paralelo (uma com mês, outra sem) e o Apps Script estrangulava
  a chamada duplicada, devolvendo vazio na segunda. Resultado: o resumo (widget
  topo) calculava certo, mas a aba "A pagar" mostrava "Tudo em dia 🎉" mesmo
  com pendentes existindo.
  - Novo endpoint `getPendentesPessoais()` no servidor, dedicado e leve (filtra
    direto). Cliente passa a usar uma chamada só pra cada finalidade. Sem mais
    duplicação, payload menor, mais rápido.

---

## [1.26.2] — 2026-06-16

### Corrigido (bug crítico)

- **"A pagar" mostrava vazio mesmo com pendentes existindo no servidor**:
  o `callServer` resolvia `null` quando o GAS engolia uma resposta (rate limit,
  payload grande, erro silencioso). O handler do FinPessoal tentava acessar
  `null.ok` e estourava `TypeError: Cannot read properties of null (reading 'ok')`,
  abortando o resto do carregamento — incluindo a lista de pendentes. Resultado:
  o widget do topo mostrava o valor (do resumo, que vinha primeiro) mas a aba
  "A pagar" ficava "Tudo em dia 🎉" enganosamente.
  - **callServer**: nunca mais resolve com `null`/`undefined`; devolve
    `{ok:false,error:'Sem resposta'}` no lugar (com warn no console).
  - **FinPessoal**: todos os `res.ok` agora usam optional chaining (`res?.ok`)
    pra resistir a respostas malformadas; o `.catch` loga em vez de silenciar.
  - **A pagar**: se o resumo aponta N pendentes mas a lista chegou vazia, mostra
    um alerta amarelo com botão **Recarregar** em vez de fingir que está tudo
    em dia.

---

## [1.26.1] — 2026-06-16

### Corrigido

- **A pagar (Pessoal) mostra agora o cartão e detecta órfãos**: cada linha da
  sub-view "A pagar" exibe o nome do cartão (quando o método é cartão). Itens
  cujo `cartaoId` aponta pra um cartão removido/inválido recebem badge **"órfão"**
  vermelho e a tag **"cartão inválido"**, com fundo levemente avermelhado.
  - Banner no topo da aba mostra a quantidade e o valor total dos órfãos, com
    orientação clara: usar **Editar** pra vincular ao cartão certo (o seletor de
    cartão já existe no modal de edição) ou **Excluir** pra remover.
  - Adicionei o botão **Excluir** direto em cada linha de "A pagar" (com
    confirmação). Antes só dava pra marcar como pago ou editar.
- Isso resolve o caso real: lançamentos importados de fatura no cartão errado /
  com cartão depois removido apareciam só no widget "A pagar pendentes" do topo
  mas sumiam de Cartões e de Lançamentos do mês — agora aparecem em A pagar com
  destaque vermelho e dá pra resolver direto.

---

## [1.26.0] — 2026-06-16

### Corrigido / Adicionado

- **Conciliação de fatura na importação por IA**: a tela de revisão agora compara
  a **soma dos itens** com o **total da fatura** declarado no PDF e mostra um
  banner em tempo real:
  - **Verde** quando bate (tolerância de R$ 0,02);
  - **Amarelo** quando faltam X reais — caso típico de encargos (juros, multa,
    IOF, anuidade, seguro) que escaparam — com botão **"Lançar X como encargo"**
    que cria a linha de uma vez;
  - **Vermelho** quando excede o total (item duplicado ou valor maior).
- **Adicionar/remover linhas manualmente**: cada linha tem um botão de excluir e
  há um botão **"Adicionar linha manualmente"** pra inserir uma compra que a IA
  não viu (ou um encargo personalizado), sem precisar fechar a modal.
- **Prompts da IA melhorados (Gemini e texto)**: agora pedem explicitamente pra
  capturar **encargos financeiros** (juros, multa por atraso, IOF, anuidade/
  mensalidade, seguro) como linhas próprias, com categoria `encargos`. Antes a
  instrução mandava ignorar — por isso esses valores sumiam.

---

## [1.25.0] — 2026-06-16

### Corrigido / Adicionado

- **Gerenciar lançamentos pelo cartão (Financeiro Pessoal)**: ao abrir um cartão,
  a gaveta de fatura agora mostra, além da janela atual, **TODOS os lançamentos
  daquele cartão** (qualquer mês e qualquer status) — e cada item tem botões de
  **editar** e **excluir**.
  - Resolve o caso de importar uma fatura no **cartão errado**: os itens antes
    ficavam "órfãos" (não apareciam em Lançamentos do mês por serem de meses
    anteriores, nem em A pagar por virem como "pago", e a fatura só mostrava a
    janela do mês). Agora dá pra achá-los e removê-los direto no cartão.
  - **Excluir baixa de tudo automaticamente** (fatura, A pagar, resumo e
    lançamentos do mês) — tudo deriva da mesma tabela.
  - **Editar** abre o lançamento e permite **trocar o cartão** (corrigir em vez
    de apagar).
  - Botão **"Remover importados (N)"** desfaz de uma vez uma importação inteira
    feita no cartão errado.
  - Backend: `getLancamentosPorCartao` e `deletarLancamentosImportadosCartao`.
- **Empresa**: verificado — não tem o mesmo problema. As despesas importadas caem
  na competência da própria data e aparecem no livro-caixa do mês (com editar/
  excluir por linha); basta navegar até o mês. Sem cartão no meio, sem órfãos.

---

## [1.24.0] — 2026-06-16

### Adicionado / Corrigido

- **Responsividade mobile completa (pente fino)**: a aplicação inteira agora se
  adapta a telas de celular, não só a moldura (menu/topo).
  - **SubNav e Atelier**: a coluna lateral fixa (que espremia o conteúdo no
    celular) vira uma **faixa horizontal rolável de pílulas** no topo, com o
    conteúdo ocupando a largura toda. Afeta Financeiro (Empresa e Pessoal) e Atelier.
  - **Grids internos**: layouts de 2–3 colunas fracionárias (`1fr 1fr`, `2fr 1fr`,
    etc.) e master-detail de coluna fixa colapsam pra **uma coluna** no mobile.
  - **Cards em grade** com mínimo largo (≥310px) usam `min(100%, …)` pra não
    estourar a largura em telas estreitas.
  - **Tabelas largas** (Despesas, A receber, Custos, Visão geral, Contatos, etc.)
    passam a **rolar na horizontal** em vez de espremer as colunas.
  - **PageHeader**: as ações quebram pra baixo do título quando não cabem.

---

## [1.23.1] — 2026-06-16

### Adicionado

- **Avatar do Google no topo (mobile)**: o cabeçalho mobile agora mostra a foto da
  conta Google (com fallback pras iniciais) no canto direito; tocar abre o menu
  com o card de perfil completo.

---

## [1.23.0] — 2026-06-16

### Adicionado

- **Perfil do usuário na sidebar**: card com **foto, nome e e-mail** do Google de
  quem está logado, mais o badge do papel (Admin/Operacional/Leitor). Aparece no
  rodapé do menu (desktop e mobile).
  - Backend: `getMeuAcesso` agora também devolve `nome` e `foto` reais do Google,
    via endpoint OpenID `userinfo` (não exige habilitar a People API). Resultado
    cacheado por 6h no `CacheService` pra não bater na rede a cada load.
  - Novo scope `userinfo.profile` no manifesto.
  - Avatar usa `referrerPolicy="no-referrer"` (foto do Google carrega sem 403) e
    cai pra iniciais quando não há foto.

---

## [1.22.0] — 2026-06-16

### Adicionado

- **Controle de acesso (RBAC) — Fase 1**: base de papéis e gestão de usuários.
  - Papéis: **Admin** (tudo) > **Operacional** (dia a dia, sem financeiro/config)
    > **Leitor** (somente leitura). O **owner** (quem implantou) é sempre Admin e
    não pode ser rebaixado/removido.
  - Nova planilha `Usuarios` + tela **Usuários & acesso** em Configurações (Admin):
    adicionar/editar/remover colaboradores por e-mail, definir papel e ativar/inativar.
  - **Financeiro** e **Configurações** ficam **ocultos e bloqueados** para não-Admin
    (gating de navegação + tela de "acesso restrito").
  - Backend: `getMeuAcesso`, `getUsuarios`, `salvarUsuario`, `removerUsuario`
    (protegidos por papel Admin), helpers de hierarquia e bootstrap do owner.
  - O acesso da implantação **continua `MYSELF`** — por enquanto só o owner entra.

### Pendente (Fase 2 — login externo)

- Login com Google (GIS) + verificação de token no servidor + sessão, para
  colaboradores com contas Google externas; gating server-side completo do
  Financeiro; e abertura do acesso da implantação com allowlist (fail-closed).
  Requer um OAuth Client ID (Google Cloud Console) — setup único do owner.

---

## [1.21.4] — 2026-06-16

### Corrigido

- **Nome do projeto self agora vem do Drive** (em vez da Apps Script API, que
  estava falhando e caía no fallback "FORJA"). Usa o mesmo serviço que já lista
  os demais projetos com sucesso, com fallback para `projects.get`. No próximo
  Sincronizar, o card existente é renomeado automaticamente para o título real
  (ex.: "Forja - CRM Gestão 360").

---

## [1.21.3] — 2026-06-16

### Corrigido

- **Sync agora cria o card da própria Forja se ele não existir**: antes só
  funcionava se já houvesse um card "FORJA" pra vincular. Como o portfólio podia
  não ter esse card, o projeto atual não aparecia. Agora o sync vincula um card
  "forja" existente OU **cria um novo** sistema self (nome do GAS, `scriptId`
  self, estágio Forja, web app URL), garantindo que ele sempre apareça na bancada.

---

## [1.21.2] — 2026-06-16

### Corrigido

- **O próprio projeto da Forja agora também sincroniza**: ele é excluído da
  listagem do Drive (pra não se auto-importar nem se auto-flagar como removido),
  então o sync passou a tratá-lo à parte — vincula o card **FORJA** ao `scriptId`
  real, **nunca** o marca como removido e **atualiza o nome** a partir do título
  do projeto no GAS (ex.: "FORJA" → "Forja - CRM Gestão 360").

---

## [1.21.1] — 2026-06-16

### Alterado

- **Sync do GAS agora traz as nomenclaturas atuais**: ao sincronizar, os apps já
  importados têm o **nome atualizado** a partir do GAS (match por `scriptId`, que
  é estável mesmo após renomear). Banner informativo mostra "nome antigo → novo".
  Com isso a lista de "Removidos no GAS" fica confiável — só sobra o que de fato
  não existe mais. Sem chamadas extras (usa os nomes da própria listagem do Drive).

---

## [1.21.0] — 2026-06-16

### Adicionado

- **Sincronização com o Google Apps Script** na sessão Sistemas (two-way leve):
  - Detecta **projetos novos** no GAS ainda não importados (banner + atalho de import).
  - Detecta apps cujo `scriptId` **sumiu do GAS** (apagado/lixeira) e os
    **sinaliza** como "Removido no GAS" (não-destrutivo) — a governança no Forja
    é preservada; você decide **Remover** ou **Manter**.
  - Se um app sinalizado **reaparece** no GAS, a flag é limpa automaticamente.
  - Sistemas **sem `scriptId`** (criados manualmente, ex.: FORJA) nunca são tocados.
  - Roda no **botão "Sincronizar"** e também **automaticamente** ao abrir Sistemas
    e o Dashboard.
  - Badge "Removido no GAS" aparece no card do sistema e na lista de Aplicações
    do Dashboard.

### Técnico

- `server.ts`: `sincronizarGAS`, `removerSistema`, `descartarFlagRemocaoGas`;
  novas colunas `removidoNoGas` / `removidoNoGasEm` em `Sistemas`
  (SCHEMA_VERSION → `v1.20-gas-sync`). Trava anti-falso-positivo: só conclui
  remoção se a listagem do Drive retornar ao menos 1 projeto.
- `Bancada.tsx`: botão Sincronizar, auto-sync e banners de novos/removidos.
- `SystemCard.tsx` / `Dashboard.tsx`: badge "Removido no GAS".

---

## [1.20.0] — 2026-06-16

### Adicionado

- **Despesas da empresa em PDF**: botão **Baixar PDF** no livro-caixa gera um
  relatório mensal (KPIs, por categoria, lançamentos) e cada despesa ganha um
  **Comprovante** individual em PDF — ambos no serviço server-side confiável.
- **Resumo financeiro por e-mail** (em Relatórios → Exportar): digest com
  cobranças **a receber (15d)**, **em atraso**, **contas a pagar (15d)** e
  **despesas pendentes** do mês, com total recebido no mês.
  - **Enviar agora** para qualquer e-mail (ou o e-mail da conta Google).
  - **Envio diário agendado** (escolha da hora) via trigger do Apps Script.

### Técnico

- `server.ts`: `gerarRelatorioDespesasPdf`, `gerarComprovanteDespesaPdf`;
  motor de e-mail `enviarResumoFinanceiroEmail` + handler de trigger
  `enviarResumoFinanceiroDiario`, com `getConfigResumoFinanceiro` /
  `salvarConfigResumoFinanceiro` / `ativarResumoFinanceiroDiario` /
  `desativarResumoFinanceiroDiario` (config em `PropertiesService`).
- `FinEmpresaDespesas.tsx`: ações de PDF (relatório + comprovante por linha).
- `Relatorios.tsx`: novo painel `ResumoEmailPanel`.

---

## [1.19.0] — 2026-06-16

### Adicionado

- **Serviço de PDF server-side (confiável)**: PDFs agora são gerados no servidor
  (GAS `Utilities…getAs('application/pdf')`) e baixados via base64 — sem depender
  de `window.print()`, que era instável dentro do iframe do Apps Script (origem
  dos erros anteriores).
- **Recibo / Fatura de assinatura em PDF** em **Financeiro › Empresa › A
  receber**:
  - Ação por assinatura para gerar **Fatura** (a cobrar) ou **Recibo** (último
    pago) em PDF, com layout premium.
  - Após registrar um recebimento, oferta direta de **baixar o recibo** daquele
    pagamento.
  - **Dados do emissor** (nome, documento, PIX, contato) configuráveis e exibidos
    no cabeçalho dos documentos.
- **Relatório mensal em PDF**: botão **Baixar PDF** gera o relatório no servidor
  (mantém o Imprimir como alternativa).

### Alterado

- **Dashboard**: o widget **Aplicações** passa a ter **rolagem interna** e
  acompanha a altura do painel **Atividade técnica**, equilibrando a home.

### Técnico

- Backend: `gerarDocumentoReceitaPdf`, `gerarRelatorioPdf`, `getEmpresaPerfil`,
  `salvarEmpresaPerfil` + helpers de HTML→PDF. Novo `src/pdf-client.ts`
  (`gerarEbaixarPdf` / `baixarPdfBase64`).

---

## [1.18.0] — 2026-06-16

### Adicionado

- **Fecha o ciclo da cobrança — recebimentos e inadimplência** em **Financeiro ›
  Empresa › A receber**:
  - **Registrar recebimento** em uma assinatura (na tabela e na lista de próximas
    cobranças). Ao registrar, a **próxima cobrança é rolada automaticamente** pro
    próximo ciclo (mensal/trimestral/semestral/anual).
  - Novos KPIs: **Recebido no mês** (realizado) e **Em atraso** (inadimplência —
    cobranças ativas vencidas), com destaque quando há atraso.
  - Ledger de **Recebimentos** persistido (valor, data, competência, notas).

### Técnico

- Backend: `registrarRecebimento` (com rolagem de ciclo via `_avancarCiclo`),
  `getRecebimentos`, `deletarRecebimento`. `getResumoReceitas` agora retorna
  `recebidoMes`, `recebimentosMesQtd`, `inadimplenciaValor`, `inadimplenciaQtd`.
- Nova planilha `Recebimentos`. `SCHEMA_VERSION` → `v1.18-recebimentos`.

---

## [1.17.1] — 2026-06-16

### Alterado

- **Visão geral**: KPIs reorganizados em dois grupos — **Fluxos** (MRR, Custo
  recorrente, Despesas do mês) e **Resultados** (Margem recorrente vs. Resultado
  de caixa do mês). Separa a rentabilidade do modelo (MRR − custo) do caixa real
  (que inclui despesas variáveis), cada um com sua margem %.

### Técnico

- `getFinanceiro`: novo `margemRecorrente` (margem só do recorrente); `margem`
  passa a ser a margem de caixa (com despesas).

---

## [1.17.0] — 2026-06-16

### Adicionado

- **Visão geral da Empresa fecha a foto entrada × saída**: os KPIs do topo viram
  **MRR (entrada)**, **Custo recorrente**, **Despesas (mês)** e **Resultado
  (mês)** — agora o livro-caixa de despesas entra na conta de saída de caixa,
  não só os contratos recorrentes.
  - Gráfico **Entrada × saída (6 meses)** com legenda de MRR, custo, despesas e
    resultado.
  - Tabela **Lucro por aplicação** ganhou a coluna **Despesa**, mostrando o
    **lucro real por app** (MRR − custo − despesa do mês).
- **Despesas com camada de análise**: abaixo do livro-caixa, três painéis novos —
  **Despesas por categoria** (barras de proporção com %), **Evolução (6 meses)**
  (gráfico de tendência + variação vs. mês anterior) e **Despesa por app**
  (quanto cada produto puxa de custo variável).

### Técnico

- `getFinanceiro`: soma `FinEmpresaDespesas` da competência atual → `despesasMes`,
  `saidaMes`, `resultadoMes`; `despesa` por app e por mês na série.
- `getResumoDespesasEmpresa`: agora retorna `serie` (6 meses) e `porApp`.

---

## [1.16.0] — 2026-06-16

### Adicionado

- **"A receber" virou painel de receita recorrente (SaaS)**: a aba em
  **Financeiro › Empresa** agora enxerga o negócio pela lente de assinaturas
  (core: cada app vendido como plano mensal).
  - **Hero com MRR** em destaque + **ARR (12m)**, **assinaturas ativas**,
    **clientes** e **ARPU** (receita média por assinatura).
  - **Cartões do mês**: **Novo MRR**, **Churn** (MRR perdido em cancelamentos),
    **Avulsas** (vendas únicas faturadas no mês) e **A receber em 45 dias**.
  - **MRR por app**: barra de proporção mostrando quanto cada produto fatura de
    recorrente, com nº de assinaturas e clientes.
  - **Próximas cobranças (45 dias)**: timeline com cliente/plano, valor e
    destaque para cobranças atrasadas e da semana.
- **Cliente como primeira classe**: nova coluna **Cliente** na tabela e seleção
  no cadastro de assinatura, com **criação de cliente na hora** (sem sair do
  modal).
- **Catálogo de planos por app**: novo drawer pra cadastrar os planos de cada app
  (nome, valor, recorrência, descrição). Ao criar uma assinatura, escolha o app e
  o plano — **valor e recorrência entram automaticamente**.
- **Vendas personalizadas/avulsas**: nova recorrência **Avulsa** — entra no
  faturamento do mês, mas **fica fora do MRR/ARR**.

### Alterado

- `toMonthly` passa a tratar recorrências **avulsa/única como R$ 0/mês**, pra não
  inflarem o MRR (ajusta também a Visão geral).
- Cancelamento de assinatura passa a registrar `canceladaEm` automaticamente,
  permitindo medir **churn do mês**.

### Técnico

- Backend: `getResumoReceitas`, CRUD `getPlanosApp`/`salvarPlanoApp`/
  `deletarPlanoApp`. Schema: `Receitas` + `canceladaEm`, nova planilha
  `PlanosApp`. `SCHEMA_VERSION` → `v1.16-receita-recorrente`.

---

## [1.15.0] — 2026-06-16

### Adicionado

- **Despesas da Empresa (livro-caixa mensal)**: nova área em **Financeiro ›
  Empresa** que espelha a estrutura do Pessoal — **mês de referência no topo**,
  KPIs do mês (total, pago, a pagar, maior categoria) e tabela de lançamentos
  com status (pago/pendente/agendado) num clique. É o mês a mês de contas,
  boletos, notas e recibos avulsos — separado de "A pagar" (que segue sendo os
  custos recorrentes/contratos).
- **Importar conta/recibo por PDF ou foto (Gemini)**: leitura multimodal direta
  de boletos, contas (luz, água, internet), notas fiscais e recibos. Extrai
  fornecedor, data (preferindo vencimento) e valor; quando o documento tem itens
  discriminados, traz cada um; senão lança o valor total. Tela de revisão pra
  ajustar antes de importar, com status e app aplicados em lote.
- Cada despesa pode ser **classificada por categoria** (Hospedagem, API/LLM,
  Marketing, Impostos…) e **vinculada opcionalmente a um app**.

---

## [1.14.0] — 2026-06-16

### Adicionado

- **Receituário com "Exemplo"**: cada receita agora pode ter um bloco de
  **exemplo concreto** (markdown/código) que mostra na prática o que ela faz —
  renderizado num bloco destacado no drawer, separado do passo-a-passo. Novo
  campo no formulário de criação/edição.
- **Receita "Sub-Nav Vertical (list-detail)" enriquecida**: explica o nome do
  padrão (list-detail / master-detail / sidebar navigation), quando usar 1 nível
  vs aninhado, e traz um exemplo de uso do componente reutilizável.

### Mudado

- **Empresa padronizada com list-detail**: a aba **Empresa** (Visão geral, A
  receber, A pagar) passou a usar a mesma sub-nav vertical do Pessoal — as duas
  metades do Financeiro agora têm navegação interna idêntica e coesa.
- **Componente `<SubNav/>` reutilizável**: a técnica list-detail foi extraída
  num componente único, usado em Empresa e Pessoal (e documentado no
  Receituário). Menos duplicação, visual consistente.
- **"Sincronizar Forja" agora atualiza receitas-padrão**: além de criar as que
  faltam, o botão refresca o conteúdo canônico das receitas embutidas
  (descrição, conteúdo, exemplo…), preservando o que é seu (destaque, ordem). As
  receitas que você criou nunca são tocadas.

---

## [1.13.1] — 2026-06-16

### Mudado

- **Navegação do Pessoal virou sub-nav vertical (list-detail)**: substituímos a
  barra horizontal de abas — que cortava com 12 itens — pela mesma técnica usada
  no Atelier: uma coluna lateral fixa (sticky) com ícone, rótulo, contador e
  destaque por cor, mais um cabeçalho contextual com descrição da área. É o
  padrão "list-detail / sidebar navigation" (estilo configurações do
  Linear/Notion): escala sem estourar, sem corte e sem quebra de linha.

---

## [1.13.0] — 2026-06-16

### Mudado

- **Financeiro reorganizado em Empresa × Pessoal**: o topo do Financeiro agora
  tem duas abas macro. **Empresa** reúne Visão geral, A receber e A pagar (o que
  é do negócio); **Pessoal** reúne toda a vida financeira pessoal. Mais
  setorizado e visualmente organizado.
- **Navegação interna do Pessoal rolável**: a barra de abas (Visão geral, Norte,
  Lançamentos, Família, Plano de contas…) agora rola na horizontal quando não
  cabe na largura, sem estourar o layout nem quebrar em duas linhas — mantendo o
  minimalismo.

### Corrigido

- **Família: membro recém-cadastrado não aparecia**. A lista passa a usar o
  resumo buscado pela própria aba como fonte de verdade, então um novo membro
  (ex: “Malu Passos”) aparece na hora, mesmo que o refresh global atrase.

---

## [1.12.0] — 2026-06-15

### Adicionado

- **Família (nova aba)**: gestão de contas compartilhadas. Cadastre membros que
  dividem despesas no seu cartão (filha, irmã, cunhada…) e controle quem te deve
  e quem já pagou:
  - **Cobranças por mês** com status (a receber / pago) e marcação de pago num
    clique, no card e no detalhe do membro.
  - **Vínculo à origem**: ligue a cobrança a uma compra do cartão ou a uma
    assinatura — rastreabilidade total do que caiu na sua fatura.
  - **“No seu cartão, ainda sem cobrar”**: lista as compras do cartão do mês que
    ainda não foram atribuídas a ninguém, com botão “atribuir” num clique.
  - **Cobranças recorrentes**: marque “repetir todo mês” (ex: streaming que o
    membro divide) e elas aparecem automaticamente nos próximos meses.
  - Hero premium com total a receber, recebido, nº de membros e alerta do que
    está na fatura sem cobrança; cards de membro com avatar (emoji + cor).

---

## [1.11.0] — 2026-06-15

### Adicionado

- **Google Gemini nativo (free tier)**: conexão direta com a API do Google
  (`generativelanguage`) usando a sua própria conta — configurável em
  Configurações, com passo a passo pra pegar a chave no Google AI Studio, escolha
  de modelo (`gemini-2.0-flash` por padrão) e botão de testar conexão.
- **Leitura de fatura pelo Gemini (multimodal)**: agora a importação manda o
  **PDF direto** pro Gemini, que lê o documento (inclusive escaneado), extrai as
  compras com mais precisão e **já classifica cada uma num centro de custo do
  plano de contas**. O modo texto (pdf.js + proxy) vira fallback automático.
- **Plano de Contas (nova aba ✦)**: estrutura contábil leve (grupo → conta /
  centro de custo). O **Gemini gera um plano sob medida** a partir dos seus
  gastos reais; dá pra editar, adicionar e remover contas manualmente. É o
  catálogo que a importação de fatura usa pra classificar as compras.

---

## [1.10.0] — 2026-06-15

### Adicionado

- **Importar fatura com IA** (botão "Importar fatura" no header e dentro da aba
  Cartões). Faz upload do PDF da fatura, extrai o texto no navegador (pdf.js), a
  IA estrutura as compras e você revisa numa tabela antes de importar:
  - Cada compra vira um **lançamento individual** no cartão escolhido.
  - Tabela de revisão editável (data, descrição, categoria, valor) com seleção
    item a item e total dinâmico.
  - Status configurável (pago/pendente) e escolha do cartão de destino.
  - **Fallback**: colar o texto manualmente (para PDFs escaneados/sem texto).
- **Receitas (nova aba)**: casa das suas entradas. Cadastre seu **salário** como
  receita **mensal** e ele passa a entrar **automaticamente todo mês até você
  cancelar** (alimenta saldo e o Norte). Suporta recorrência mensal/semanal/anual,
  pausar, reativar e cancelar — além de listar entradas avulsas do mês.
- **2 novas cores de cartão**: amarelo e marrom escuro.

---

## [1.9.1] — 2026-06-15

### Adicionado

- **Lançar fatura de cartão** (botão "Lançar fatura" no header do Pessoal).
  Atalho pra registrar a fatura de um cartão como uma despesa única, sem precisar
  lançar compra por compra:
  - Escolhe o **cartão** e o **mês de referência**.
  - **Sugestão automática**: se já houver compras lançadas no mês, mostra o total
    calculado com um botão "usar esse valor".
  - Aceita **fatura inteira ou valor parcial** — você digita quanto quiser.
  - Vencimento pré-preenchido pelo dia de vencimento do cartão (editável) e
    status (a pagar / paga / agendada).
  - Descrição automática `Fatura {cartão} {mês}` (editável).

---

## [1.9.0] — 2026-06-15

### Adicionado

- **Norte — a inteligência financeira do Pessoal** (nova aba ✦ Norte). Une
  análise determinística (rápida, grátis) com plano profundo via IA sob demanda.
  - **Score de saúde financeira** (0-100) com renda × despesas fixas × sobra.
  - **Comprometimento de renda**: barra mostrando fixas, variáveis e sobra.
  - **Fundo de reserva**: meta (X meses de custo), progresso, quanto falta e em
    quantos meses você chega no ritmo atual.
  - **Plano de redução de despesas determinístico**: consolidar streamings/
    operadoras duplicadas, alerta de comprometimento >50%, corte de variáveis —
    cada item com economia estimada/mês e economia potencial total.
  - **Plano profundo com a Forja IA** (botão): diagnóstico + cortes priorizados
    + estratégia de reserva + caminho pra abundância (1-5 anos) + dicas. Fica
    persistido com modelo e data.
  - **Projeções**: saldo acumulado em 12 meses + patrimônio em 5 anos com juros
    compostos (aporte + rendimento configurável).
  - **Despesas fixas por cartão e categoria** (recorrências + assinaturas).
  - **Insights automáticos** + **guia rápido** (50/30/20, reserva, abundância).
  - **Premissas configuráveis**: renda mensal (ou estimada dos lançamentos),
    meta de reserva, valor já guardado e rendimento esperado.
- Backend: `getInteligenciaFinanceira`, `getConfigFinanceira`,
  `salvarConfigFinanceira`, `gerarPlanoReducaoIA`, `getUltimoPlanoIA`.

## [1.8.2] — 2026-06-15

### Adicionado

- **3 novas cores de cartão** no cadastro do Financeiro Pessoal, replicando
  cartões reais: vermelho (Hipercard Itaú Platinum), dourado (Smiles Visa Gold)
  e dourado-bronze (Latam Pass Itaú Gold).
- **Presets de assinatura ClaroTV+, TIM, Vivo, Claro e OI** com cores das marcas.
  Nova categoria **Telefonia/Internet** (ícone smartphone/sinal) pra agrupar
  operadoras; ClaroTV+ entra como streaming.

## [1.8.1] — 2026-06-15

### Alterado

- **Assinaturas mais premium e com respiro** — os 4 cards de KPI iguais viraram
  um **hero strip**: número principal grande (custo mensal) + stats secundárias
  como texto puro separadas por divisores finos, sem caixas/cores repetidas.
- **Cards de assinatura mais minimalistas** — borda neutra (a cor da marca fica
  só no ícone), mais padding e espaçamento maior no grid. Acaba o efeito
  "arco-íris" de bordas coloridas.
- **Header do Financeiro Pessoal** mais compacto pra os 5 cards caberem numa
  linha harmônica em vez de quebrar "4 + 1 sozinho".

## [1.8.0] — 2026-06-15

### Adicionado

- **Assinaturas no Financeiro Pessoal** — nova aba pra cadastrar e controlar
  serviços recorrentes (streaming, música, IA, software, cloud, jogos). Cada
  assinatura é uma entidade própria (separada dos lançamentos) pra medir o
  **custo comprometido mensal** sem risco de dupla contagem.
  - **Cadastro com presets** das marcas mais populares (Netflix, Prime, Max,
    Disney+, Spotify, ChatGPT Plus, Claude Pro, Game Pass...): um clique
    preenche nome, categoria, cor da marca e valor sugerido.
  - **Ciclo mensal ou anual** — o resumo normaliza anual→mensal (valor/12) pra
    o custo equivalente.
  - **KPIs ricos**: custo mensal, projeção anual, média por assinatura, a mais
    cara. Breakdown **por categoria** e **timeline de cobranças do mês**.
  - **Status ativa/pausada/cancelada** — só ativas entram no custo. Pausar não
    apaga, só tira do cálculo.
  - **Card "Assinaturas/mês"** no topo do Financeiro Pessoal, sempre visível e
    clicável (leva direto pra aba).
- Backend: sheet `FinPessoalAssinaturas` + funções `getAssinaturas`,
  `salvarAssinatura`, `deletarAssinatura`, `alternarStatusAssinatura`,
  `getResumoAssinaturas`. `SCHEMA_VERSION` → `v1.8-assinaturas`.

## [1.7.3] — 2026-06-15

### Alterado

- **Brasa do sidebar/topbar agora é IDÊNTICA à da abertura** — trouxe a bola
  (núcleo) + halo de volta, tudo em **pêssego fixo** (cor da brasa da marca),
  na mesma disposição da landing (halo ~1.6x o núcleo + fagulhas). Antes:
  sem bola e com cor variando por saúde (ficava rosa), o que destoava da
  página de entrada. Prop `marca` na `BrasaIndicator` ativa esse modo.
- A cor por saúde (verde/pêssego/rosa) continua disponível na `BrasaIndicator`
  quando `marca=false`, mas o logo agora usa sempre a cor da marca pra bater
  com a abertura.

## [1.7.2] — 2026-06-15

### Adicionado

- **Logo FORJA clicável** → volta pra página de abertura (landing). Vale no
  sidebar (desktop) e na topbar (mobile). Hover no wordmark dá feedback de
  opacidade. App.tsx ganhou `handleShowLanding` que reexibe a landing
  (independente do `sessionStorage`).

### Alterado

- **Brasa: removida a "bola" sólida + halo** — agora é só o efeito de
  fagulhas subindo, com uma fonte de calor difusa (glow radial suave) pra
  ancorar as faíscas. Prop `apenasFagulhas` na `BrasaIndicator`. A cor das
  faíscas continua refletindo a saúde média (verde/pêssego/rosa).
- Aplicado no sidebar (10 faíscas) e na topbar mobile (8 faíscas).

## [1.7.1] — 2026-06-15

### Adicionado

- **Brasa viva no logo do sidebar** — o efeito de fagulhas da landing veio
  pra dentro do app. A `BrasaIndicator` ganhou prop `comFagulhas` (+ keyframe
  `forjaSparkMini`, escala compacta que sobe 28px). A cor continua refletindo
  a saúde média (verde/pêssego/rosa), agora com faíscas subindo — "viva".
- **Slogan no sidebar**: *"Onde ideias ganham forma"* em Fraunces itálico,
  discreto, logo abaixo do wordmark FORJA.

### Alterado

- Logo do sidebar reestruturado: wordmark + brasa (size 10, 8 fagulhas) na
  primeira linha, slogan na segunda. O "ponto de luz" estático virou brasa
  animada. Mobile topbar mantém a brasa simples (sem fagulhas) por espaço.

## [1.7.0] — 2026-06-15

### Adicionado

- **Landing page de entrada** (`src/views/LandingPage.tsx`) — uma "porta da
  frente" minimalista e animada que materializa o significado de *forja*:
  a **brasa que respira** (núcleo peach com glow pulsante) e **fagulhas
  subindo** (18 faíscas com posição/tempo/deriva randomizados, como o metal
  sendo malhado). Wordmark FORJA em Fraunces com reveal suave, slogan e botão
  "Entrar na forja".
- **Slogan oficial**: *"Onde ideias ganham forma"* + tagline mono
  *"da fagulha à entrega"*. Captura a metáfora central — onde a ideia bruta
  vira software, como o metal bruto vira ferramenta no calor da forja.
- Respeita o tema (claro = creme quente / escuro = penumbra com brasa) e tem
  toggle de tema no canto. Enter/Espaço também entram.
- **Aparece uma vez por sessão** (`sessionStorage`): F5 durante o trabalho não
  re-exibe; sessão nova mostra a porta de novo.

### Novos keyframes globais

- `forjaSpark`, `forjaEmberBreath`, `forjaEmberGlow`, `forjaWordIn`,
  `forjaSloganIn` (em `esbuild.mjs`).

## [1.6.10] — 2026-06-15

### Corrigido

- **Backticks na descrição quebravam o deploy** — v1.6.9 falhou com
  `extrairTitulo: command not found` porque a descrição tinha
  `` `extrairTitulo` `` e o shell interpretou como command substitution.
  Fix: trocado `execSync` por `spawnSync` com array de args (sem `shell`),
  e função `limpar()` que converte backtick → aspas simples + trunca em
  120 chars. Agora caracteres ambíguos não passam pelo shell em momento
  algum.

## [1.6.9] — 2026-06-15

### Corrigido

- **Regex do `extrairTitulo` no script de deploy** falhava silenciosamente
  por causa do modificador `m` em `(?=\n## \[|$)` — o `$` casava com
  fim-de-linha em vez de fim-de-string, retornando bloco vazio. Removido
  o `m`. v1.6.8 saiu como "Forja v1.6.8" no painel; a partir daqui as
  descrições vêm preenchidas certas.

## [1.6.8] — 2026-06-15

### Corrigido

- **Drag no mindmap não funcionava** (regressão de v1.6.7). Causa:
  `svg-pan-zoom` escuta **mouse events** tradicionais. Chamar
  `stopPropagation` no `pointerdown` NÃO impede que `mousedown` seja
  gerado depois e bubble pro SVG root — o pan/zoom interceptava antes
  do drag handler reagir. Fix: chamar `preventDefault()` no `pointerdown`
  (suprime mouse events derivados) + `onMouseDown` redundante no hitbox.
- Hitbox transparente agora tem `pointer-events:all` explícito —
  alguns browsers ignoram `fill="transparent"` pra hit testing.
- Footer do mindmap agora explica a nova interação:
  "arraste um node pra reposicionar · arraste o fundo pra mover · scroll pra zoom".

### Adicionado

- **Script `deploy` agora gera descrição automática padronizada** no
  formato `vX.Y.Z — <título do CHANGELOG>`. Antes os deploys entravam
  como "Sem título" no painel "Gerenciar implantações" do Apps Script,
  o que dificultava identificar/rollback. O novo `scripts/deploy.cjs`:
  - Lê versão do `package.json`
  - Extrai o primeiro item `**negrito**` da seção mais recente do CHANGELOG
  - Monta `v{version} — {titulo}` e passa pro `clasp deploy -d`
  - Imprime resumo + dicas de `npm run versions` e `npm run rollback`

## [1.6.7] — 2026-06-15

### Adicionado

- **Mindmap interativo (física tipo Obsidian)** — os nodes agora **podem ser
  arrastados** com mouse ou toque, e os vizinhos se **adaptam suavemente**
  pra abrir espaço. Simulação force-directed com três forças:
  - **Repulsão** entre todos os pares (∝ 1/dist²) — afasta o que está perto
  - **Spring** nas edges parent↔child — mantém distância "ideal" (180px)
  - **Damping** (0.82) — amortece pra sistema settle em vez de oscilar
- **Root âncora**: fica fixo em (0,0) — não se move, todo o resto se acomoda
  em torno dele. Pulse sutil contínuo (3.2s loop) pra sensação "viva".
- **Hitbox transparente maior** (`r+8`) ao redor de cada dot — facilita
  clicar com mouse e tocar com dedo (mobile).
- **Feedback visual ao arrastar**: cursor vira `grabbing`, dot cresce 2px
  e ganha o glow do root.
- **Pan do svg-pan-zoom é desabilitado** durante o drag pra não brigar com
  o movimento do node — reabilitado quando solta.
- Loop de animação pára sozinho quando energia cai abaixo de 0.5 (sistema
  congela na nova posição). Não há overhead de CPU quando idle.
- viewBox com padding generoso pra acomodar movimento sem cortar nodes.

### Como usar

Passa o mouse sobre qualquer dot → cursor vira "grab". Clica e arrasta —
o node segue o cursor, e o resto do grafo se reorganiza pra abrir espaço.
Solta → vai settando suave. Root é fixo (âncora visual). Mobile: idêntico
com toque (usamos pointer events).

## [1.6.6] — 2026-06-15

### Adicionado

- **Mindmap expandido em modal fullscreen** (96vw × 82vh). Novo botão
  `Expandir` na toolbar do mindmap abre a visualização em um modal grande
  com o canvas tendo bem mais espaço, ideal pra navegar grafos densos.
- Refatorado `ObsidianMindmap` em dois: `MindmapCanvas` (renderer puro,
  reutilizável) + `ObsidianMindmap` (wrapper com modal).

### Corrigido

- **Download SVG**: agora embeda um `<rect>` com a cor de fundo da canvas
  como primeiro filho. Sem isso, ao abrir o `.svg` no visualizador padrão
  (fundo branco), o texto cream do tema noturno ficava invisível.

## [1.6.5] — 2026-06-15

### Adicionado

- **Render próprio de mindmap (ObsidianMindmap)** — abandonamos o layout do
  Mermaid pra mindmap. Por que: o algoritmo radial do Mermaid foi feito pra
  caixas; quando as escondíamos, o espaçamento ficava ruim (texto sobre texto).
- Novo `ObsidianMindmap.tsx`:
  - **Parser** próprio da sintaxe Mermaid mindmap (suporta `((round))`,
    `[box]`, `{{hexa}}`, `)bang(`, `(rounded)`, texto puro)
  - **Layout radial inteligente**: arc por subtree (folhas no subtree definem
    quanto espaço o ramo recebe), raio adaptativo pela largura média do texto
    dos filhos (mais nodes = raio maior, sem overlap)
  - **Renderer SVG nativo**: dots por nível, texto posicionado PARA FORA do
    dot na direção oposta à raiz (sem texto sobrepondo dot), curvas Bézier
    suaves, anchor inteligente (text-anchor varia por quadrante)
  - **Pan/zoom + toolbar** (zoom in/out, fit, download SVG)
- Pra qualquer outro tipo (flowchart, ER, sequence, class) continua usando
  Mermaid normal.

## [1.6.4] — 2026-06-15

### Corrigido

- **Mindmap: detecção de nodes por estrutura (não mais por classe)**.
  Mermaid 11.x dá `mindmap-node section-root` no root mas só `section-N`
  nos leaves (SEM `mindmap-node`). v1.6.3 só pegava o root. Agora detecta
  qualquer `<g>` que tem shape + texto como filhos diretos. Funciona em
  qualquer versão Mermaid presente e futura.
- Backup duplo: depois da detecção por estrutura, **nuke** todos os
  rect/polygon/ellipse remanescentes (skipa defs/markers/edgeLabel).
  Garantia anti-rect-órfão.
- Dots posicionados usando bbox do **texto** (mais confiável que bbox do
  node inteiro). Edges (paths fora de qualquer node) ficam finas e cinza.

## [1.6.3] — 2026-06-15

### Mudado

- **Mindmap repensado no estilo Obsidian graph-view**:
  - Caixas COMPLETAMENTE removidas (`display:none !important` no style inline).
  - Cada node ganha um **dot circular** colorido criado dinamicamente no
    centro do bbox via `createElementNS`.
  - **Root**: dot de 12px peach com glow SVG (filter `feGaussianBlur` + `feMerge`).
  - **Leaves**: dots de 4-6px em paleta accent rotacionada por nível
    (sage → blue → lavender → clay → rose).
  - Linhas finas (1.5px) em cinza neutro, não roubam atenção.
  - Texto: Inter, hierarquia por cor + tamanho (root 16px, L0/L1 13px, L2+ 12.5px).
  - Root detection STRITA via `.section-root` apenas — bug da v1.6.2 que
    pegava o container `<g class="root">` do SVG eliminado.

## [1.6.2] — 2026-06-15

### Corrigido

- **Mindmap minimalista de fato**: v1.6.1 não pegava todos os nodes porque
  as classes CSS do Mermaid mudam de versão. Reescrito como brute-force JS
  pós-render:
  - Detecta mindmap via prefixo do code (`/^\\s*mindmap/`)
  - Varre TODAS as formas do SVG e força inline-style com `!important`
  - Detecção robusta do root (5 fallbacks de selector)
  - Linhas: 3px peach com cantos arredondados, opacidade 0.65
  - Root: pill peach (rx=14) com borda accent
  - Não-root: completamente transparente — só texto aparece
  - Texto: Inter, 13/15px, peso 500/600 (hierarquia visual)
- Removidas regras CSS antigas do mindmap (conflitavam e nunca pegaram tudo).

## [1.6.1] — 2026-06-15

### Mudado

- **Mindmap redesenhado — stroke-first, minimalista, premium**:
  - Nodes agora sem caixa (fundo transparente) — a estrutura é a estrela.
  - Linhas grossas (2.5px) em peach com cantos arredondados.
  - Hierarquia via cor/peso do texto (esmaece com profundidade), não via fill.
  - Root em pill destacado com borda peach.
  - Padding aumentado (16→24) e `maxNodeWidth` de 240 pra texto respirar.
- Safety-net JS atualizado pra pular mindmap-nodes (evita reaplicar fundos).

## [1.6.0] — 2026-06-15

### Adicionado

- **Guia do Atelier**: nova estação landing com checklist de setup recomendado +
  cards explicativos de cada uma das 8 estações (Skills, Snippets, Templates,
  Bookmarks, Códex, Receituário, Hospedagem, Cofre). Mostra contagem real de
  itens por estação.
- **Versionamento documentado**: `CHANGELOG.md` + script `npm run rollback` +
  indicador de versão no rodapé do sidebar.

## [1.5.1] — 2026-06-15

### Corrigido

- Contraste no tema noturno do Mermaid:
  - ER attribute rows com `attributeBackgroundColorOdd/Even` apropriados.
  - Mindmap com paleta escalonada via `themeCSS` (todos os níveis legíveis).
  - Edge labels com fundo escuro.
  - Safety net JS pra substituir cores brancas hardcoded em atributos SVG.

## [1.5.0] — 2026-06-15

### Adicionado

- **Galeria de exemplos**: 10 templates Mermaid prontos (5 genéricos + 5 sobre
  Forja). Botão "Ver exemplos" no Estúdio + empty state turbinado.
  Zero IA — carrega no editor direto.
- **Galeria completa do Forja**: novo botão no hero "Forja sobre Forja" que
  gera as 5 visões (flowchart/sequence/ER/class/mindmap) em sequência (~1-2min),
  todas marcadas como referência automaticamente.

## [1.4.11] — 2026-06-15

### Corrigido

- Validação client-side do contexto: botão "Gerar diagrama" agora fica
  desabilitado quando não há descrição/ideia/sistema, com aviso peach explicando
  o que falta — em vez do popup genérico após clicar.

## [1.4.10] — 2026-06-15

### Corrigido

- **Race condition crítica no MermaidView**: renders antigos do Mermaid podiam
  sobrescrever o resultado de gerações novas (mesma imagem aparecia repetida).
  Implementado contador de tokens via `useRef` pra invalidar promises stale.

## [1.4.9] — 2026-06-15

### Adicionado

- Botão inteligente no Estúdio de Diagramas: muda dinamicamente entre "Gerar
  diagrama" / "Re-gerar" / "Gerar como [Tipo]" baseado no contexto + hint
  contextual abaixo da toolbar explicando o próximo passo.

## [1.4.8] — 2026-06-15

### Corrigido

- Contraste do `optionSelectedBg` no Select do Ant Design (tema noturno) — itens
  selecionados em dropdowns estavam quase invisíveis.

## [1.4.7] — 2026-06-15

### Adicionado

- **Farol de saúde no ModeloBadge**: bolinha verde (ativo) / vermelho (última
  chamada falhou) / cinza (não chamado). Tooltip enriquecido com última chamada,
  latência, erro detalhado, sugestão e botão "Testar conexão".

### Corrigido

- Mermaid não cortando mais texto nos nodes: `htmlLabels: false` + padding/spacing
  maiores + viewBox manual com margem + re-fit em 2 passes.

## [1.4.6] — 2026-06-15

### Adicionado

- **Auto-recovery do Mermaid**: server-side `_extrairMermaidBruto()` + client-side
  espelhado. Quando a IA devolve Mermaid em formato sujo (JSON quebrado, wrapped
  em markdown), extraímos automaticamente o desenho. Tag "Recuperado
  automaticamente" + botão "Atualizar código" pra propagar a versão limpa.

## [1.4.5] — 2026-06-15

### Adicionado

- **MermaidView tipo Miro**: pan/zoom via svg-pan-zoom, toolbar flutuante,
  download SVG, grade de pontos no fundo, tema noturno customizado, código
  Mermaid colapsável.

## [1.4.4] — 2026-06-15

### Mudado

- **Dashboard técnico**: removidas métricas financeiras (MRR, custos, lucro)
  do Dashboard principal. Tudo financeiro foi pro módulo Financeiro. Dashboard
  agora foca em saúde operacional, atividade técnica e conexões.

## [1.4.3] — 2026-06-14

### Adicionado

- Tracking de modelo LLM usado em cada geração (Blueprint, Diagrama, Chat).
  Novo `ModeloBadge` reutilizável + colunas `modeloUsado` e `parseAviso` no
  banco.

### Corrigido

- LLM generation hang: redução de maxTokens em geração de blueprint do Forja.
- Lost content em parseamento JSON: agora salva sempre o bruto se falhar.

## [1.4.2] — 2026-06-14

### Adicionado

- **Receituário** no Atelier: catálogo de 18 features reutilizáveis com
  passo-a-passo + busca + categorias + sync.

### Corrigido

- Performance: `initDatabase()` cached via PropertiesService (10s → 400ms).
- `getStatusGeral()`: CacheService 60s TTL + `UrlFetchApp.fetchAll` paralelo.

## [1.4.1] — 2026-06-14

### Adicionado

- **Forja sobre Forja**: dogfooding. Botões "Gerar blueprint do Forja" e
  "Gerar diagrama do Forja" no topo das views de IA. Marca artefatos com
  `origem='forja-self'`. Sistema de "Pin como referência" pra fixar no topo.

## [1.4.0] — 2026-06-13

### Adicionado

- **Códex** no Atelier: catálogo de padrões de desenvolvimento (design system,
  stack, código). Cards marcados com `incluirEmIa=sim` viram contexto do system
  prompt de qualquer gerador IA. Sub-nav vertical do Atelier (Linear/Notion-like).

## [1.3.x] — 2026-06-12 a 2026-06-13

### Adicionado

- **Financeiro pessoal**: módulo completo de finanças pessoais com transações,
  cartões, parcelas automáticas, recorrências, orçamento por categoria e
  gestão de categorias (CRUD com emoji + cor + merge/rename).

## [1.2.x] — 2026-06-10 a 2026-06-11

### Adicionado

- **Backlog Kanban**: decisões viram cards num kanban interno do sistema
  (backlog → andamento → feito). Drawer wide pra detalhes.

## [1.1.0] — 2026-06-09

### Adicionado

- Auditorias agendadas, snapshots de clientes, sugestões de skills.

## [1.0.0] — 2026-06-08

### Adicionado

- **v1.0** com Atelier completo: Skills, Hospedagem, Vault.

### Anteriores (fases 1-15)

- Cobertas em commits do git — pré-1.0 ainda evoluindo features base
  (CRM, Sistemas, Ideias, Operações, Forja IA, Relatórios).
