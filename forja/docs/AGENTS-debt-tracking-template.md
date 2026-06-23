# AGENTS.md template — Protocolo Forja de dívida técnica

> **Nota pra quem cria skills do Atelier**: toda nova skill deve incluir `category:` e `tags: [...]` no frontmatter YAML. Sem isso, ela cai sem classificação no Skills Hub da Forja e o usuário precisa rodar "Classificar por tema" manualmente. Exemplo de frontmatter completo:
>
> ```yaml
> ---
> name: minha-skill
> description: O que a skill faz e quando usar.
> category: code-quality
> tags: [debt, review, ai-instructions]
> ---
> ```


> **Cole isso na raiz de qualquer repositório** que você queira que a Forja escaneie. Se já existe um `AGENTS.md` no repo, cola a seção dentro dele. Se não, renomeia este arquivo pra `AGENTS.md` (e remove esse aviso do topo).
>
> Por que `AGENTS.md` e não `.cursor/rules/`? Convenção universal: **Cursor, Claude Code, Codex, e Continue** todos respeitam `AGENTS.md` na raiz. `.cursor/rules/*.mdc` só funciona no Cursor.

---

## Protocolo de dívida técnica & TODOs

Este repositório usa o protocolo da **Forja** pra marcar dívida técnica e TODOs no código. A Forja escaneia o repo procurando 4 marcadores em comentários e os apresenta na aba **Dívida técnica** do Sistema correspondente. Itens fecham automaticamente quando você apaga o comentário do código + faz commit.

### Marcadores reconhecidos

| Marcador | Quando usar | Vira na Forja |
|----------|-------------|---------------|
| `// DEBT(area,severidade): desc` | Dívida formal — atalho consciente que vai ficar meses | Card estruturado (categoria + severidade) |
| `// TODO: desc` | Tarefa pequena sem categoria clara | Item TODO |
| `// FIXME: desc` | Bug conhecido ainda não consertado | Item FIXME |
| `// HACK: desc` | Gambiarra consciente que funciona mas vai voltar | Item HACK |

**Prefira `DEBT(...)` sempre que conseguir classificar** — os outros 3 são pra rascunho rápido.

### `DEBT(area, severidade)` — valores válidos

- **Áreas**: `governanca` · `arquitetura` · `seguranca` · `dependencias` · `testes` · `operacional` · `performance` · `ux` · `codigo`
- **Severidades**: `alta` · `media` · `baixa`

### Sintaxe aceita

- **Prefixos**: `//`, `/* */`, `/*! */`, `#`, `--`, `<!-- -->`
- **Case-insensitive** (`// TODO:`, `// todo:`, `// Todo:` — todos valem)
- **Descrição** máx: 280 caracteres
- **Em código que passa por bundler agressivo** (esbuild, terser, webpack com remove-comments), use `/*! DEBT(...) */` — o `!` faz o comentário sobreviver como "legal comment".

### Exemplos práticos

```ts
// DEBT(seguranca,alta): API key em texto plano — mover pro secret manager
const KEY = "sk-proj-...";

// DEBT(testes,media): sem teste de boundary pra mês 13 → mês 1
function mesAnterior(m: number) { return m - 1; }

// DEBT(performance,baixa): N+1 — buscar em batch quando lista > 50
for (const u of users) await getProfile(u.id);

// TODO: extrair esse mapping pra util compartilhado
const map = { ... };

// FIXME: scroll perde posição quando data muda
// HACK: hardcoded ENV por ora — backend não expõe esse campo

/*! DEBT(arquitetura,media): essa função é chamada por 3 lugares com contratos diferentes — quebrar em 3. */
function doTudo() { /* ... */ }
```

### Regras pro agente IA (Cursor, Claude, Codex, etc.)

1. **Antes de refatorar dívida silenciosamente, marque-a primeiro.** Identificou problema fora do escopo da tarefa atual? Insere `// DEBT(...)` e segue. **Não** tente "consertar de bônus" — o usuário perde controle do PR.

2. **Não use `DEBT(...)` pra trivialidades resolvíveis na hora.** Renomear variável ruim? Conserte. Função de 5 linhas mal nomeada? Arrume. `DEBT` é pra coisa que **fica** porque dá trabalho ou pede decisão de produto.

3. **Não duplique.** Antes de marcar, leia o arquivo procurando se já existe `TODO`/`FIXME`/`DEBT` no mesmo contexto. Se sim, atualize a descrição em vez de criar segundo.

4. **Não marque em testes, arquivos gerados, ou vendor/lib.** Forja já filtra `node_modules`, `dist`, `build`, `.min.`, mas seja consciente.

5. **Descrição curta, acionável, no infinitivo.**
   - Ruim: `// TODO: melhorar isso`
   - Bom: `// TODO: extrair validação pra schema Zod compartilhado`
   - Ruim: `// DEBT(codigo,baixa): tá feio`
   - Bom: `// DEBT(arquitetura,media): essa fn faz fetch + parse + escrita — quebrar em 3`

6. **Quando user fala "registra essa dívida" ou "vou pagar depois", use `DEBT(area,sev)` formal**, não `TODO:`.

### O que NÃO fazer

- Inventar áreas/severidades fora da lista (Forja normaliza pra `codigo`/`media` mas perde categorização).
- Usar `DEBT` pra feature em backlog — feature vai pro **Backlog do Sistema** na Forja, não é dívida.
- Deixar linha em branco entre `// DEBT(...)` e o código que descreve.
- Deixar `// TODO` sem descrição (Forja ignora abaixo de 3 caracteres).

### Como o item desaparece da Forja

- **Apague o comentário do código + commit.** Próxima sincronização marca como **pago auto**.
- **Promova pra Backlog na Forja.** Migra pra "promovido" e cria card no Kanban. A partir daí tem vida própria — fechar card no Kanban não apaga do código (e vice-versa). Pra fechar de vez: apague o comentário + commit.

### Resumo de bolso

> Resolver **agora**? → Resolva.
> Resolver **depois**? → `// DEBT(area,sev): ...`
> Tarefinha **trivial**? → `// TODO: ...`
> **Bug** conhecido? → `// FIXME: ...`
> **Gambiarra** consciente? → `// HACK: ...`

---

## Como instalar este protocolo em outros repositórios

### Opção 1: AGENTS.md (recomendado — universal)

1. Se o repo **não tem** `AGENTS.md`: copie este arquivo pra raiz e renomeie pra `AGENTS.md`. Remova o aviso do topo.
2. Se o repo **já tem** `AGENTS.md`: cole a seção `## Protocolo de dívida técnica & TODOs` (a do meio deste documento) dentro do AGENTS.md existente.
3. Commit + push. Pronto — Cursor/Claude/Codex já respeitam ao abrir o repo.

### Opção 2: `.cursor/rules/` (só Cursor)

```bash
mkdir -p .cursor/rules
# baixe o template Cursor rule:
curl -o .cursor/rules/forja-debt-tracking.mdc \
  https://raw.githubusercontent.com/lazaroweb/o-root-gas/master/.cursor/rules/forja-debt-tracking.mdc
```

Vantagem: específico do Cursor (versionado junto com o repo, time inteiro adota).
Desvantagem: não vale pra outros clientes de IA (Claude Code, Codex, Continue).

### Opção 3: User Rule global no Cursor (vale em TODOS seus repos)

Cursor → **Settings → Rules → User Rules** → cole o conteúdo da seção "Protocolo de dívida técnica & TODOs" deste arquivo.

Vantagem: zero esforço por repo — vale em tudo automaticamente.
Desvantagem: aplica em projetos onde você talvez não queira (ex: repos do trabalho).

### Comparação

| | AGENTS.md | .cursor/rules/ | User Rule |
|---|---|---|---|
| Funciona em Cursor | ✅ | ✅ | ✅ |
| Funciona em Claude Code | ✅ | ❌ | ❌ |
| Funciona em Codex | ✅ | ❌ | ❌ |
| Versionado no Git | ✅ | ✅ | ❌ |
| Vale em todos os repos automaticamente | ❌ | ❌ | ✅ |
| Time inteiro adota | ✅ | ✅ | ❌ |

**Recomendação**: Opção 1 (AGENTS.md) — universal, versionado, sem necessidade de cada pessoa configurar a IDE.
