# Forja — Deploy

Guia completo pra subir a Forja na sua conta Google.

---

## Pré-requisitos

- Node.js 22+ (`node -v`)
- Conta Google (qualquer Gmail)
- `npm install -g @google/clasp` ou usar `npx clasp` (recomendado)

---

## Passo 1 — Clone e instale

```bash
git clone <seu-fork-ou-repo> o-root-gas
cd o-root-gas/forja
npm install
```

---

## Passo 2 — Crie o projeto Apps Script

### Opção A: usar a Forja existente (você é dono do repo original)

`.clasp.json` já aponta pro `scriptId` correto. Vá pro Passo 3.

### Opção B: criar do zero

1. Vá em [script.google.com](https://script.google.com) → **Novo projeto**
2. Em **Configurações do projeto**, copie o **ID do script**
3. Atualize `.clasp.json` na raiz de `forja/`:

```json
{
  "scriptId": "SEU_SCRIPT_ID_AQUI",
  "rootDir": "dist",
  "scriptExtensions": [".js", ".gs"],
  "htmlExtensions": [".html"],
  "jsonExtensions": [".json"]
}
```

---

## Passo 3 — Autentique o clasp

```bash
npx clasp login
```

Abre o browser, faz OAuth. Token vai em `~/.clasprc.json`.

⚠️ **Se rotacionar scopes** (alterar `appsscript.json`), você vai precisar re-autenticar:

```bash
npx clasp logout
npx clasp login
```

---

## Passo 4 — Build + push + deploy

```bash
npm run build
# → dist/App.html, dist/Server.js, dist/appsscript.json

npx clasp push --force
# → Sobe os 3 arquivos pro Apps Script

npx clasp deployments
# → Lista deployments existentes. Anote o ID do "estável" (não @HEAD).

npx clasp deploy -i <DEPLOYMENT_ID> -d "v1.0 release"
# → Reusa o mesmo deployment, incrementa versão.
```

A **URL pública** segue o padrão:
```
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
```

Essa URL é **estável** entre versões — só muda o número (`@1`, `@2`, ...).

### Por que reusar deployment?

Cada `clasp deploy` (sem `-i`) cria um deployment NOVO com URL nova. Se você compartilha o link da Forja com alguém, ou bookmarkou, você quer que o link seja **o mesmo sempre**. Por isso reutilizamos um único deployment, só incrementando versões.

---

## Passo 5 — Primeira execução + autorização

1. Abra o link `/exec` da Forja
2. Google vai pedir autorização (escopo Sheets, Drive, External Request, etc.)
3. Aceite (o aviso "App não verificado" aparece porque é seu próprio app — clique em "Avançado > Acessar")
4. **Done.** Forja cria a planilha `FORJA — Base de Dados` no seu Drive automaticamente.

---

## Passo 6 — Configurar IA e GitHub

### IA

Vá em `Configurações > Conexão de IA`:

| Campo | Exemplo |
|---|---|
| Provedor | `proxy` (compatível OpenAI/Anthropic) |
| Base URL | `https://seu-proxy.exemplo.com/v1` |
| Modelo padrão | `claude-3-5-sonnet-latest` ou `gpt-4o` |
| Chave da API | sua chave |

Teste a conexão com o botão `⚡ Testar`. Latência ideal: <3s.

### GitHub

Vá em `Configurações > GitHub`:

| Campo | Exemplo |
|---|---|
| Usuário/Org | `seu-usuario` |
| Token | `ghp_...` com escopo `repo` (somente leitura basta) |

---

## Script Properties (configuração avançada)

A Forja guarda configs sensíveis em **Script Properties** (`Configurações do projeto > Script properties` no editor GAS):

| Propriedade | Função |
|---|---|
| `FORJA_SHEET_ID` | ID da planilha (auto-criada na primeira execução) |
| `LLM_API_KEY` | Chave da API LLM |
| `LLM_BASE_URL` | URL do proxy/endpoint LLM |
| `LLM_MODEL` | Modelo padrão pra chat |
| `LLM_MODEL_AUDITORIA` | Modelo específico pra auditorias (opcional, fallback pro `LLM_MODEL`) |
| `GH_TOKEN` | Token GitHub |
| `GH_USER` | Usuário GitHub |
| `COFRE_SALT` | Salt do Cofre (PBKDF2) |
| `COFRE_WRAPPED_KEY` | Vault key cifrada |
| `COFRE_WRAP_IV` | IV do wrapping |
| `COFRE_VERIFICADOR` | Texto-conhecido cifrado pra verificar senha |

Você pode editar essas propriedades diretamente no GAS e a Forja reflete (botão **Sincronizar** em Configurações).

---

## Triggers (automações)

A Forja registra time-driven triggers via UI (`Configurações > Automações`). Para ver/gerenciar manualmente:

1. Editor GAS → ⏱️ **Triggers** (sidebar esquerda)
2. Verá `automacaoCronJob` rodando a cada X horas (configurável)

---

## Scopes OAuth (`appsscript.json`)

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/script.container.ui",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.send_mail",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/script.projects.readonly",
    "https://www.googleapis.com/auth/script.deployments.readonly"
  ]
}
```

**Justificativa:**
- `spreadsheets` — SheetDB
- `script.external_request` — UrlFetchApp pra LLM, GitHub, uptime
- `script.send_mail` — Alertas por email
- `drive.readonly` — Importar projetos GAS (lista do Drive)
- `script.projects.readonly` + `deployments.readonly` — Pegar webAppUrl dos GAS importados

---

## Troubleshooting

### "Tela branca" após deploy

Provavelmente um chunk corrompeu. Soluções:
1. Verifique tamanho dos chunks: `npm run build` mostra `JS em N fatias de ≤195KB`
2. Se algum chunk passou de 195KB, ajuste o `CHUNK_TARGET_KB` em `esbuild.mjs`
3. Force re-push: `npx clasp push --force`

### "Authorization required" / "Permissão negada pelo Google"

Você adicionou um scope novo. Resoluções:
1. Abra o link `/exec` em **aba anônima** e re-autorize
2. Se não funciona, vá em [myaccount.google.com/permissions](https://myaccount.google.com/permissions) → encontre "Forja" → Remover → reabrir Forja → autorizar de novo

### `clasp deploy` falha com `invalid_grant`

Token RAPT expirado. Re-login:
```bash
npx clasp logout
npx clasp login
```

### IA retornando 404

Verifique em `Configurações > Conexão de IA`:
- Base URL deve incluir `/v1` no fim (ex.: `https://proxy.com/v1`)
- Pra Anthropic nativo, use `https://api.anthropic.com` (a Forja adiciona `/v1/messages`)
- Teste com `Testar conexão` — se falha aqui, é problema de credenciais/URL

### Bundle muito grande (>1.5MB)

GAS tem limite. Estratégias:
- Audite imports não-usados: `npx ts-prune`
- Carregue libs grandes via CDN (ex.: Mermaid já é assim)
- Use `React.lazy()` pra views pesadas (ex.: IADiagramas)

### Cofre "trancado pra sempre"

Esqueceu a senha-mestra? Não tem recovery (é zero-knowledge). Opções:
1. `Atelier > Cofre > Reset` (apaga TUDO do cofre — irreversível)
2. Importar snapshot anterior se você tiver backup

---

## Atualizando a Forja

```bash
git pull
npm install        # se package.json mudou
npm run build
npx clasp push --force
npx clasp deploy -i <DEPLOYMENT_ID> -d "descrição da versão"
```

Refresh no browser e versão nova carregada.

---

## Backup recomendado

Mesmo com Sheets sendo persistente, configure:

1. **Snapshot semanal manual**: `Configurações > Backup & Restore > Baixar snapshot.json`
2. **Cofre separadamente**: o snapshot inclui o cofre cifrado, mas guarde a senha-mestra num gerenciador de senhas dedicado (1Password, Bitwarden) — sem ela, o cofre é ruído
3. **Planilha**: Drive já versiona, mas você pode duplicar manualmente periodicamente

---

## Limites do Google Apps Script (conta gratuita)

| Recurso | Limite | Como Forja lida |
|---|---|---|
| UrlFetchApp/dia | 20k chamadas | Cache + dedupe em automações |
| Email/dia | 100 | Alertas usam dedupeKey pra não spammar |
| Tempo de execução | 6 min/função | Funções pesadas (export) particionadas |
| Triggers simultâneos | 20 | Forja usa 1-3 |
| Tamanho do projeto | 50MB | Atualmente ~2MB |
| Tamanho de planilha | 10M células | Suficiente pra centenas de sistemas |

Se vai usar comercialmente em escala, considere upgrade pra Workspace.
