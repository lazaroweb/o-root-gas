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
