# AGENTS.md — Handoff completo pro próximo agente AI

> **Você é um novo agente IA assumindo este repositório.** Leia este arquivo INTEIRO antes de tocar em qualquer código. Ele te dá em 5-7 minutos tudo que um agente anterior aprendeu trabalhando aqui por meses.

**Última atualização**: 2026-06-22 · **Versão atual da Forja**: `v1.143.0` · **Branch**: `master`

---

## 1. Quem é o usuário (estilo, papel, jeito)

O usuário é **BA (Business Analyst), NÃO desenvolvedor**. Português brasileiro, comunicação direta e informal. Especificidades importantes:

- **Não abre terminal sozinho** pra rodar comandos. Se você precisa de algo no terminal, ou faça você (se tiver `Shell` access), ou peça pra ele colar instruções num agente que tem terminal (tipo Cursor) — sempre com comandos completos, sem `<PLACEHOLDERS>`.
- **Já foi queimado por placeholders**: quando passar URL/IDs, sempre passe completo, real, copia-e-cola. Errou uma vez: "Sempre me passe a url completa não esqueça que eu sou um BA e não o dev."
- **Tom esperado**: direto, pragmático, com tabelas e listas. Sem floreio. Reconheça quando ele tem razão. Não fuja de erros.
- **Princípios fortes que ele explicitou**:
  1. *"Eu não aceito alerta de nada sem tratativa"* — todo alerta na UI precisa ter CTA, "saiba mais" ou opção de descarte. **Princípio #6 do ROADMAP.**
  2. *"Vibe code first"* — UI minimalista premium, microinterações, sem complicar.
  3. *"Faça um plano antes de sair fazendo"* — quando a mudança for grande, traga proposta antes de implementar.

---

## 2. O que é a Forja, em uma frase

> Um **QG pessoal** pra quem desenvolve produtos com IA (vibe coding com Cursor/Claude/ChatGPT) e precisa orquestrar clientes, ideias, sistemas, custos, receitas, auditoria de código, atelier de skills — tudo rodando 100% em Google Apps Script + Sheets, sem servidor, sem assinatura.

Detalhe completo: `README.md` (raiz) + `forja/ARCHITECTURE.md`.

---

## 3. Estrutura do repositório

```
o-root-gas/
├── README.md                  ← README público (atualizado v1.140.1)
├── AGENTS.md                  ← este arquivo (handoff pro próximo agente)
├── forja/                     ← APP PRINCIPAL — React 18 + GAS, privado (acesso só pro usuário)
│   ├── package.json           (v1.143.0)
│   ├── ROADMAP.md             ← O QUE VEM POR AÍ. Leia primeiro.
│   ├── CHANGELOG.md           ← histórico detalhado de todas as versões
│   ├── ARCHITECTURE.md        ← SheetDB engine, chunking, fluxo GAS↔React
│   ├── DEPLOY.md              ← setup completo, scopes OAuth, propriedades
│   ├── SECURITY.md            ← modelo zero-knowledge do Cofre
│   ├── DRIVER_OAUTH.md        ← OneDrive + Google contas extras
│   ├── YOUTUBE_OAUTH.md       ← YouTube API setup (módulo Estudos)
│   ├── src/
│   │   ├── server.ts          ← 9000+ linhas. SheetDB + LLM + ~80 funções server.
│   │   ├── types.ts           ← contratos React↔Server
│   │   ├── App.tsx            ← entrypoint React
│   │   ├── components/        ← ~40 componentes reutilizáveis
│   │   └── views/             ← ~25 telas
│   ├── scripts/deploy.cjs     ← script de deploy (build → push → deploy)
│   └── scripts/rollback.cjs   ← rollback pra versão anterior
│
├── forja-public/              ← APP PÚBLICO de formulário de Discovery, ANÔNIMO
│   ├── package.json
│   ├── README.md              ← motivação (separação por segurança) + setup
│   └── src/                   ← código minimalista: só doGet + 2 funções públicas
│
└── gas-app-kit/               ← Skills/templates referência (não tocar sem motivo)
```

**Por que 2 projetos GAS separados?** Forja é privada (`access: MYSELF`). Pro formulário público de Discovery funcionar, precisava de URL anônima — e expor a Forja inteira teria sido buraco de segurança gigante (OWASP A01). Então criamos `forja-public/` como projeto separado com superfície mínima (`doGet` + 2 funções), gravando na mesma planilha. Detalhes em `forja-public/README.md`.

---

## 4. Estado atual em 2026-06-22

### O que foi feito hoje

| Versão | Foco |
|---|---|
| **1.143.0** | **Fusão Centelha em Ideias + Design System docs** — Centelha some, tudo vira Ideias (caixa única) com captura zero-fricção, 5 visões inteligentes, Modo Foco, drawer rico, design moderno |
| 1.142.0 | Ideias com lifecycle completo — concluir, reabrir, arquivar, descartar, apagar, filtros, timestamps |
| 1.141.0 | Centelha — caixa global de captura zero-fricção (DEPRECATED em 1.143; fundida em Ideias) |

### Sessão Ideias (v1.143.0) — entendimento rápido pro próximo agente

- **Onde fica**: sidebar, ícone 💡 (Lightbulb), hotkey `g+i` pra abrir a view,
  `g+x` em qualquer tela abre modal de **captura rápida** (sem trocar contexto).
- **O que é**: caixa única que substitui Centelha + banco antigo de Ideias.
  Captura zero-fricção, triagem rica, lifecycle completo, modo foco pra batch.
- **5 visões inteligentes** (Segmented no topo, com badge de contagem):
  - **Inbox** — `estado=nova` SEM categoria/sistema (capturada bruta). Quando
    Inbox tem 3+ itens, surge CTA "Triar N no Foco" pra batch.
  - **Foco** — alta prioridade OU criadas nos últimos 3 dias.
  - **Ativas** — em movimento (nova/validando/em andamento) já triadas.
  - **Concluídas** — agrupadas por "Hoje/Esta semana/Este mês/...".
  - **Arquivo** — arquivadas + descartadas (agrupado por tempo).
- **3 componentes novos**:
  - `IdeiaCapturaQuick` (modal flutuante global, hotkey `g+x`).
  - `IdeiaTriagemDrawer` (lateral 520px, sliders visuais, botão "Refinar com
    IA" que sugere TODOS os campos + detecta duplicata).
  - `IdeiaTriagemBatch` (modo Foco fullscreen, hotkeys C/A/D/G/T, navegação
    ← →, contador "5 de 12"). Inspirado em Superhuman/Things 3.
- **Backend**: tabela `Ideias` ganhou `categoria` + `arquivadaEm` (`SCHEMA_VERSION`
  bumpou pra `v1.66-ideias-fusao`). Novas funções: `refinarIdeiaComIA`,
  `getIdeiasInboxCount`. Tabela `Centelhas` + funções `*Centelha*` **mantidas
  no server** pra back-compat (dados antigos não se perdem), mas sem UI
  consumindo. Pode ser removida em release futura.

### Design System docs (v1.143.0) — leia antes de criar view nova

- **Cursor Rule auto-aplicada**: [`.cursor/rules/forja-design-system.mdc`](.cursor/rules/forja-design-system.mdc)
  — `globs: forja/src/views/**/*.tsx, forja/src/components/**/*.tsx`,
  `alwaysApply: true`. Garante wrapper `forja-view`, maxWidth por densidade,
  PageHeader, tokens semânticos, escala de espaçamento, Drawer > Modal,
  Popconfirm em destrutivos, hover state, princípio #6 (alerta sem CTA proibido).
- **Skill humana de referência**: [`forja/docs/SKILL_design-system.md`](forja/docs/SKILL_design-system.md)
  — paleta completa (sage, peach, blue, clay, lavender, rose), tipografia
  (Fraunces/Inter/JetBrains), raios de borda, sombras, padrões de componente,
  anti-padrões com exemplos ❌ × ✅, inspirações (Notion/Linear/Things 3/Superhuman).
- **Motivação**: relato real do usuário após bug visual em 1.141.0:
  "tomei até um susto" porque a Centelha não tinha o wrapper padrão e colou
  na sidebar. As docs garantem que nunca mais.

### Histórico recente (releases anteriores)

| Versão | Data | Foco |
|---|---|---|
| 1.142.0 | 22/06 | Ideias com lifecycle completo (concluir/reabrir/arquivar/descartar) |
| 1.141.0 | 22/06 | Centelha (DEPRECATED em 1.143) — inbox global de captura |
| 1.140.1 | 21/06 | Reconciliação semântica 2 camadas (Jaccard + área+keywords) |
| 1.140.0 | 21/06 | Reconciliação determinística pós-IA (Antes vs Depois sempre) |
| 1.139.2 | 21/06 | Label "Rodar de novo" estável após hard-refresh |
| 1.139.1 | 21/06 | "Rodar de novo" força re-análise (sem cache) |
| 1.139.0 | 21/06 | Soft cap perdoa 2 leves, penalizações rebalanceadas |
| 1.138.0 | 21/06 | Score reflete achados de auditoria |
| 1.137.0 | 21/06 | Detector docs-only + .md fortalecidos |

**Detalhes completos**: `forja/CHANGELOG.md`.

---

## 5. Roadmap — o que vem por aí

Leia `forja/ROADMAP.md` na seção **"Fila > Auditoria Forja IA — alta prioridade"**. Resumo dos 2 itens prioritários **ainda não entregues** (já estavam pendentes desde 21/06):

### 5.1. Leitura paginada de repositórios grandes (resolver `DIFF TRUNCADO`)

**Problema**: quando o repo passa de ~60-80KB, a IA vê só uma fatia e aparece o alerta peach "DIFF TRUNCADO — IA NÃO VIU TUDO". Achados variam de rodada pra rodada porque a fatia muda.

**Proposta**:
1. Dividir leitura em 2-3 batches (por pasta/módulo, priorizando `src/` antes de `tests/`)
2. Rodar IA em cada batch
3. Mesclar achados via `_reconciliarComAnterior` que já existe (Jaccard + área+keywords)
4. Descartar duplicatas

**Estimativa**: 30-45 min. **Trigger**: usuário viu o alerta no `one-colmeia-app` (85KB).

### 5.2. Audit "Alerta sem tratativa proibido" (princípio #6)

**Problema**: alguns alertas/badges na UI ainda não têm CTA claro.

**Proposta**:
1. Varrer todos os componentes `Alert`, `Tag`, banners no `forja/src/`
2. Garantir que cada um tenha: (a) ação primária acionável OU (b) link "saiba mais" OU (c) botão de dispensar com nota
3. Audit deve gerar uma lista — entrega: PR com fixes + lista de quais ficaram OK

**Estimativa**: 1-2h. **Trigger**: usuário levantou diretamente *"Eu não aceito alerta de nada sem tratativa"*.

### 5.3. Outros itens da fila

Ver `forja/ROADMAP.md` seção "Backlog geral" — dunning automático, exportação Excel, multi-moeda, modo offline/PWA, integração Open Finance, etc.

---

## 6. Comandos essenciais

### Forja principal (forja/)

```bash
cd forja
npm install                    # 1ª vez

# Desenvolvimento local (não dá pra testar GAS localmente — só build + deploy)
npm run build                  # esbuild → dist/App.html (~2.7MB, 14 chunks)
npm run dev                    # build watch + servidor estático em :3000 (preview UI sem backend)

# Deploy completo (build + push + deploy automático com descrição do CHANGELOG)
npm run deploy

# Listar todas as versões publicadas
npm run versions

# Rollback pra versão anterior (a URL não muda)
npm run rollback -- <numero>
```

### Forja-public (forja-public/)

```bash
cd forja-public
npm install                    # 1ª vez
npm run deploy                 # build + push (sem auto-deploy — precisa abrir o editor pra publicar nova versão)
```

### Git workflow

```bash
git status                     # ver mudanças
git add <arquivos>
git commit -m "tipo(escopo): descrição (vX.Y.Z)"
git push origin master         # branch é master, não main
```

**Convenção de commit**: `tipo(escopo): descrição (vX.Y.Z)` — onde tipo = `feat|fix|chore|docs|refactor|test|perf|style`.

---

## 7. Padrões e convenções de código

### TypeScript / React

- **Sempre TypeScript estrito**. Sem `any` (a não ser que seja inescapável e com comentário).
- **Componentes funcionais com hooks**. Sem classes.
- **Ant Design** é a biblioteca UI. Use `App as AntApp`, `Drawer`, `Modal`, `Tooltip`, `Tag`, etc.
- **Lucide React** pra ícones (não `@ant-design/icons` exceto em casos raros).
- **`useTokens()`** retorna o tema (cores, fontes) — sempre use em vez de hardcode.
- **`FONTS.display | ui | mono`** pras famílias de fonte.
- **Comentários**: só onde explicam *por quê* (não *o quê*). Veja exemplo em `_executarAuditoriaIncremental` — comentários explicam motivação, não código óbvio.

### Server (GAS)

- **Tudo em `forja/src/server.ts`** — arquivão único, 9000+ linhas, organizado por seções.
- **SheetDB engine** no topo (~150 linhas). Tabelas declaradas em `SCHEMA` array. Use `dbGetAll('NomeTabela')`, `dbCreate`, `dbUpdate`, `dbDelete`.
- **`ServerResult`** é o tipo padrão de retorno: `{ ok: boolean, data?: T, error?: string }`.
- **`forjaCallLLM(messages, timeoutSec, modeloOverride, contextoPraRouting)`** pra chamar LLM.
- **`callServer<T>(fnName, ...args)`** no frontend pra chamar funções server (RPC).
- **NUNCA esquecer**: GAS roda V8 mas sem `Set` em algumas builds — use objetos como `Record<string, boolean>` em vez de `Set` quando puder.

### Estilo do CHANGELOG.md

Cada release tem:
1. Header `## [X.Y.Z] — YYYY-MM-DD`
2. Categoria `### Adicionado|Mudado|Corrigido — descrição curta`
3. Bullet principal com **negrito** explicando o ganho de uma frase
4. Sub-seções `####` com causa-raiz + solução técnica + impacto medido
5. Mencione o caso real do usuário que motivou (quando aplicável)

### Estilo do ROADMAP.md

- **Entregue**: histórico cronológico
- **Fila**: organizada por área (Auditoria Forja IA alta prioridade, Backlog geral)
- Cada item da fila tem: problema, proposta, estimativa, trigger (motivo de existir)
- Items entregues riscam (`~~texto~~`) e ganham marcador **ENTREGUE vX.Y.Z**

---

## 8. Princípios da Forja (do ROADMAP.md)

1. **Vibe code first** — UI gostosa, microinterações, sem complicação.
2. **Sheet-based** — toda persistência no Google Sheets do próprio script; zero dependência externa de DB.
3. **Zero-knowledge onde fizer sentido** — Vault e dados sensíveis criptografados no cliente.
4. **GAS-friendly** — bundle ≤ 1.5MB efetivo, fatiado em chunks, ≤ 9 scripts inline.
5. **Acionável** — toda análise da Forja IA termina em prompt ou ação executável.
6. **Alerta sem tratativa é proibido** — todo alerta/aviso/badge visível precisa ter caminho de resolução. Princípio elevado em 2026-06-21.

---

## 9. Arquitetura crítica que você precisa entender

### 9.1. Auditoria Forja IA (módulo onde mais se trabalhou hoje)

Fluxo:

```
[usuário clica "Rodar de novo" no drawer]
    ↓
[acaoIAAuditarSistema(sistemaId, modo, forcar=true)]
    ↓
    ├─ forcar=true OU sem repo OU governança puro → CAMINHO COMPLETO
    │       ↓
    │   [lê código do GitHub se houver repo]
    │       ↓
    │   [_lerCodigoSistema → arquivos + bytes + commit + truncado?]
    │       ↓
    │   [forjaCallLLM(prompt completo)]
    │       ↓
    │   [_parseAuditPayload → AuditPayload]
    │       ↓
    │   [_reconciliarComAnterior(payload, sistemaId)]  ← NOVO v1.140.0
    │       ↓ usa _mesmoAchado (Jaccard + área+keywords)  ← NOVO v1.140.1
    │   [_fecharBacklogResolvidos]                     ← também aplicado v1.140.0
    │       ↓
    │   [calcularSaudeReal(sistemaId, parsed.payload)]   ← passa payload novo direto
    │       ↓
    │   [salva em Auditorias table]
    │       ↓ retorna AuditResult
    │
    └─ forcar=false E código mudou → CAMINHO INCREMENTAL
            ↓
        [_lerDiffGitHub(repo, baseCommit) → só o diff]
            ↓
        [_executarAuditoriaIncremental]
            ↓
        [forjaCallLLM(prompt incremental com achados anteriores)]  ← IA marca origem nativamente
            ↓
        [_fecharBacklogResolvidos]
            ↓
        [calcularSaudeReal(sistemaId, parsed.payload)]
            ↓
        [salva e retorna]
```

**Cálculo de saúde** (`calcularSaudeReal` em `server.ts:12363`):
- Determinístico, 0-100 normalizado.
- 11 fatores: propósito, stack, URL, repo, custos, atividade 30d, sem críticos, sem avisos, sem riscos alta, equilíbrio custo×receita, **achados em aberto** (novo v1.138.0, soft cap v1.139.0).
- Max possível com fator novo = 110.
- Aceita `payloadOverride` opcional pra refletir auditoria recém-rodada antes de persistir.

**Reconciliação semântica** (`_mesmoAchado` em `server.ts`, v1.140.1):
- Camada 1: Jaccard ≥ 0.4 (palavras-chave normalizadas)
- Camada 2: mesma `area` + ≥1 keyword técnica em comum (whitelist ~40 keywords)
- Qualquer camada positiva = mesmo achado

### 9.2. SheetDB

Veja `forja/ARCHITECTURE.md` seção "SheetDB Engine". Pontos críticos:

- `SCHEMA` declara tabelas e colunas. Adicionar tabela = adicionar entrada lá + `SCHEMA_VERSION` bump.
- `initDatabase()` cria tabelas faltantes na planilha — idempotente.
- Toda escrita usa `dbCreate/dbUpdate` — gera ID automático, atualiza colunas conhecidas.
- Performance: ~50k linhas é o limite prático antes de virar lerdo.

### 9.3. Deploy

`scripts/deploy.cjs` faz:
1. `node esbuild.mjs` → bundle
2. `npx clasp push --force` → manda código pro projeto Apps Script
3. `npx clasp deploy -i <DEPLOY_ID> -d <descrição extraída do CHANGELOG>` → atualiza deployment estável
4. URL do app **NÃO MUDA** — só o conteúdo é substituído

Rollback: `npm run rollback -- 305` volta o conteúdo pra v1.137.0 sem afetar URL.

---

## 10. Coisas pra NÃO mexer sem entender bem

- **`forja/src/server.ts` — SheetDB engine** (linhas ~1-500). Mudar pode quebrar TODA a persistência.
- **`forja/src/server.ts` — `forjaCallLLM`**: orquestra modelos, fallbacks, rate limiting. Frágil.
- **`forja/scripts/deploy.cjs`** — depende do parsing do CHANGELOG.md. Se mudar formato do changelog, mude aqui também.
- **`forja-public/src/server.ts`** — superfície mínima por segurança. Adicionar função aqui = pensar OWASP primeiro.
- **`forja/.clasp.json` / `forja-public/.clasp.json`** — IDs reais, NÃO commitar mudanças aleatórias.
- **Script Properties no GAS** — `FORJA_SHEET_ID`, `LLM_*`, `COFRE_*`, `GH_TOKEN`, `DISCOVERY_PUBLIC_URL`. Não documentadas inteiras aqui — ver `forja/DEPLOY.md`.

---

## 11. Estilo de comunicação esperado com o usuário

Olhando como o agente anterior comunicava (que funcionou bem):

- **Estruture com tabelas** pra comparar antes/depois, estados, opções.
- **Use callouts visuais leves**: `✅ ❌ ⚠ 🎯 🟢 🟡 🔴` (mas sem exagero, ele não pediu emojis em geral).
- **Diga o que ESTÁ ACONTECENDO**: ele é BA, então traduza tecniquês.
- **Antes de mudanças grandes, traga PLANO** (use AskQuestion com 3-5 opções).
- **Reconheça quando o usuário tem razão**, sem subserviência. Ex: *"Você tem toda razão, e os prints confirmam: 3 problemas..."*.
- **Sempre dê próximo passo concreto** no fim. Não termine no vazio.
- **Use `AskQuestion`** quando há decisão dele a tomar (não liste opções no texto).
- **Mostre matemática quando ele estranhar um número** (ex: "Score 76 → 75 explicado: ..." com fórmula).
- **Se descobrir buraco/limitação, seja honesto** e adicione ao ROADMAP. Não esconda.

---

## 12. O que está commitado vs não-commitado em 2026-06-21

**Branch `master` está MUITO atrás do que está deployado.** A última commit do git é `bbc4838 (v1.74.1)`, mas estamos publicando `v1.140.1`. Trabalho de meses no `working tree` esperando consolidação.

Este commit que fecha o dia 21/06/2026 traz:
- Todas as features acumuladas (Discovery, Pipeline, Pessoas rich, Auditoria IA evoluída, Financeiro v2, Atelier expandido, etc.)
- O projeto novo `forja-public/`
- Documentação atualizada (este AGENTS.md, ROADMAP, CHANGELOG)

Próximo agente: a partir daqui, **commit por feature/fix** (não acumule mais).

---

## 13. Protocolo de dívida técnica & TODOs (Forja v1.148+)

A Forja escaneia este repositório procurando 4 marcadores em comentários do código e os apresenta na aba **Dívida técnica** do Sistema correspondente. Itens fecham automaticamente quando você apaga o comentário do código + faz commit.

### Marcadores reconhecidos

| Marcador | Quando usar | Vira na Forja |
|----------|-------------|---------------|
| `// DEBT(area,severidade): desc` | Dívida formal — atalho consciente que vai ficar | Card estruturado (categoria + severidade) |
| `// TODO: desc` | Tarefa pequena sem categoria clara | Item TODO |
| `// FIXME: desc` | Bug conhecido ainda não consertado | Item FIXME |
| `// HACK: desc` | Gambiarra consciente que funciona mas vai voltar | Item HACK |

**Prefira `DEBT(...)` sempre que conseguir classificar** — os outros 3 são pra rascunho rápido.

### `DEBT(area, severidade)`: valores válidos

- **areas**: `governanca` · `arquitetura` · `seguranca` · `dependencias` · `testes` · `operacional` · `performance` · `ux` · `codigo`
- **severidades**: `alta` · `media` · `baixa`

### Sintaxe aceita

- Prefixos: `//`, `/* */`, `/*! */`, `#`, `--`, `<!-- -->`
- Case-insensitive (`// TODO:`, `// todo:`, `// Todo:` valem)
- Descrição máx: 280 caracteres
- **Em código que passa por bundler que remove comentários** (esbuild, terser, etc.), use `/*! DEBT(...) */` (legal comment) — o `!` sinaliza pra preservar.

### Regras pro agente IA (Cursor/Claude/Codex)

1. **Antes de refatorar dívida silenciosamente, marque-a primeiro.** Identificou problema fora do escopo? Insere `// DEBT(...)` e segue. Não "consertar de bônus" — usuário perde controle do PR.
2. **Não use `DEBT` pra trivialidades resolvíveis na hora.** Renomear, formatar, ajustar 3 linhas? Conserte. `DEBT` é pra coisa que **fica**.
3. **Não duplique.** Antes de marcar, verifique se já existe TODO/FIXME/DEBT no mesmo contexto.
4. **Não marque em testes, gerados, vendor/lib.** Forja filtra `node_modules`, `dist`, `build`, `.min.`, mas seja consciente.
5. **Descrição curta, acionável, no infinitivo.** Não `// TODO: melhorar`. Sim `// DEBT(arquitetura,media): essa fn faz fetch+parse+escrita — quebrar em 3`.
6. **Quando user fala "registra essa dívida" ou "vou pagar depois", use `DEBT(area,sev)`** formal, não `TODO:`.

### Resumo de bolso

> Resolver **agora**? → Resolva.
> Resolver **depois**? → `// DEBT(area,sev): ...`
> Tarefinha **trivial**? → `// TODO: ...`
> **Bug** conhecido? → `// FIXME: ...`
> **Gambiarra** consciente? → `// HACK: ...`

---

## 14. Como começar (TL;DR pro agente novo)

1. **Leia este arquivo inteiro** (você acabou — bom trabalho).
2. **Leia `forja/ROADMAP.md`** seção "Fila > Auditoria Forja IA — alta prioridade" pra saber o que está mais quente.
3. **Leia `forja/CHANGELOG.md`** seções `[1.140.1]` até `[1.137.0]` pra entender o que se discutiu/decidiu hoje.
4. **Cumprimente o usuário** com algo concreto: *"Li o AGENTS.md e o ROADMAP. Vejo que paramos no fim do dia 21/06 com o sistema `one-colmeia-app` em score 79. Os 2 itens prioritários no roadmap são: (1) leitura paginada pro DIFF TRUNCADO; (2) audit do princípio #6. Por onde quer começar?"*
5. **Use `AskQuestion`** sempre que houver bifurcação real de decisão.
6. **Quando entregar algo**: bump versão, atualize CHANGELOG, deploy, e (mais importante) atualize este AGENTS.md se mudou algo estrutural.

---

**Boa forja. 🔨**
