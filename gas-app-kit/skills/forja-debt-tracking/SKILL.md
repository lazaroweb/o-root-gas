---
name: forja-debt-tracking
description: Mark technical debt and TODOs in source code so they appear in Forja's "Dívida técnica" tab of the matching System. Use whenever you spot a shortcut, missing test, deprecated dependency, hard-coded value, security concern, or any deliberate "we'll fix this later" while implementing or reviewing code.
---

# Forja — Débito Técnico & TODOs

Forja escaneia o repositório GitHub deste projeto procurando 4 padrões em comentários e os apresenta na aba **Dívida técnica** do Sistema correspondente. Ao apagar o comentário do código (com commit), o item fecha automaticamente na próxima sincronização.

## Quando usar cada marcador

| Marcador | Quando usar | Exemplo |
|----------|-------------|---------|
| `// TODO:` | Tarefa pequena, sem risco, que você ou alguém vai fazer "qualquer hora" | `// TODO: extrair esse mapping pra util compartilhado` |
| `// FIXME:` | Bug conhecido ou comportamento errado que ainda não foi consertado | `// FIXME: scroll perde posição quando data muda` |
| `// HACK:` | Solução feia que funciona, mas você sabe que vai voltar a morder | `// HACK: hardcoded por ora — backend não expõe esse campo ainda` |
| `// DEBT(area,severidade): desc` | Dívida técnica formal, com categoria e prioridade — **prefira esse formato sempre que possível** | `// DEBT(seguranca,alta): credenciais hardcoded — mover pro Cofre` |

## Formato estruturado: `DEBT(area,severidade): descrição`

Use sempre que conseguir classificar a dívida. Esse formato vira **card estruturado** na Forja (com filtro por área, severidade etc.) — diferente dos TODO/FIXME/HACK genéricos que viram só uma lista.

### Áreas válidas

- `governanca` — falta de documentação, processos não definidos, ownership unclear
- `arquitetura` — acoplamento, módulos mal divididos, abstrações vazando
- `seguranca` — credenciais expostas, auth fraca, validação faltando, XSS/SQLi risk
- `dependencias` — libs desatualizadas, versões pinadas a ranges perigosos, deps abandonadas
- `testes` — cobertura faltando, testes flakey, mocks ruins, integration tests ausentes
- `operacional` — falta de logs, métricas, alertas; deploy manual; rollback complexo
- `performance` — N+1, leak, allocação excessiva, query sem índice
- `ux` — fricção conhecida, acessibilidade quebrada, mensagem ruim, fluxo confuso
- `codigo` — nome ruim, função gigante, dup, comentário desatualizado (default quando dúvida)

### Severidades válidas

- `alta` — afeta produção, segurança, dados, custo significativo; precisa atacar nas próximas semanas
- `media` — fricção real mas contornável; atacar quando tiver folga ou tocar a área
- `baixa` — cosmético/conveniente; resolver oportunisticamente quando passar por perto

### Exemplos práticos

```js
// DEBT(seguranca,alta): API key em texto plano — mover pro PropertiesService
const OPENAI_KEY = "sk-proj-...";

// DEBT(performance,media): full table scan a cada request — adicionar índice em (sistemaId, criadoEm)
const rows = sheet.getDataRange().getValues();

// DEBT(testes,baixa): sem teste de boundary pra mês 13/mês 0
function mesAnterior(m) { return m - 1; }

// DEBT(arquitetura,media): essa fn faz fetch + parse + escrita — quebrar em 3
async function syncTudo() { /* ... */ }
```

## Sintaxe aceita

Forja parseia em qualquer linha de código (`.ts`, `.tsx`, `.js`, `.py`, `.go`, `.rs`, `.rb`, `.java`, `.kt`, `.swift`, `.cs`, `.php`, `.sh`, `.sql`, `.md`, etc.). Os prefixos aceitos pra começar o comentário:

- `// ...` (C-like)
- `# ...` (Python, Ruby, shell)
- `-- ...` (SQL, Haskell, Lua)
- `<!-- ... -->` (HTML, XML, Markdown)

Forja é **case-insensitive** pros marcadores (`// TODO:`, `// todo:`, `// Todo:` — todos valem). A descrição é truncada em 280 caracteres.

## Regras de comportamento pro agente IA

1. **Antes de refatorar dívida silenciosamente, marque-a primeiro.** Se você identificou um problema mas não vai resolver agora (ou se o user não pediu), insira um `// DEBT(...)` e siga a tarefa atual. Não tente "consertar de bônus" — o user perde controle do escopo.

2. **Não use `DEBT(...)` pra coisas triviais que dá pra resolver na hora.** Renomear uma variável ruim? Conserte. Função de 5 linhas mal nomeada? Arrume. `DEBT` é pra coisa que **fica** porque vai dar trabalho ou pede decisão de produto.

3. **Não duplique TODOs.** Antes de marcar, leia o arquivo procurando se já existe `// TODO`, `// FIXME` ou `// DEBT` no mesmo contexto. Se sim, atualize a descrição em vez de criar segundo.

4. **Não marque em arquivos de teste, gerado, ou vendor/lib.** Forja já filtra `node_modules`, `dist`, `build`, `.min.`, mas seja explícito: marque dívida em código de produção, não em fixtures.

5. **Descrição curta, acionável, no infinitivo.** Ruim: `// TODO: melhorar isso`. Bom: `// TODO: extrair validação pra schema Zod compartilhado`. Bom: `// DEBT(testes,media): adicionar teste de boundary pra mês=12 → mês=1`.

6. **Quando user diz "registra essa dívida" ou "vou pagar depois", use `DEBT(area,sev)` formal**, não `TODO:`.

## O que NÃO fazer

- Não invente áreas ou severidades fora da lista — Forja silenciosamente normaliza pra `codigo`/`media` se não reconhecer, mas perde a categorização.
- Não use `DEBT` pra documentar feature em backlog — pra isso existe o **Backlog do Sistema** na Forja (não é o mesmo lugar). Dívida é "atalho tomado", não "feature planejada".
- Não use linha em branco entre o `// DEBT(...)` e o código que ele descreve — Forja só registra a linha do comentário, então quanto mais perto da causa, melhor.

## Como o item desaparece da Forja

- **Apague o comentário do código e faça commit.** Na próxima sincronização (ao abrir a aba "Dívida" do Sistema, ou ao apertar "Sincronizar"), Forja marca como **pago auto**.
- **Promova pra Backlog na Forja.** O item migra pra "promovido" e cria um card em "A fazer". A partir daí ele tem vida própria — fechar o card no Kanban não apaga do código (e vice-versa). Pra fechar de vez: apague o comentário + faça commit.

## Resumo rápido

> Encontrou problema **agora** que vai resolver **agora**? → Resolva.
> Encontrou problema **agora** que vai resolver **depois**? → `// DEBT(area,sev): ...`
> Encontrou tarefinha **trivial** sem categoria clara? → `// TODO: ...`
> Encontrou **bug** comprovado que ninguém arrumou? → `// FIXME: ...`
> Fez **gambiarra consciente** porque era a única saída? → `// HACK: ...`
