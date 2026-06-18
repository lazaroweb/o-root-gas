# Forja — Arquitetura

Documento técnico para quem quer entender ou modificar a Forja.

---

## Big picture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (Web App)                                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  React 18 + Ant Design + Lucide                                │ │
│  │  Bundle: 8 chunks ≤200KB, embedded em App.html via <script>    │ │
│  │  Web Crypto API (Cofre client-side)                            │ │
│  └─────────────────┬──────────────────────────────────────────────┘ │
└────────────────────┼────────────────────────────────────────────────┘
                     │  google.script.run.<fn>(args)
                     │  (RPC assíncrono GAS-nativo)
┌────────────────────▼────────────────────────────────────────────────┐
│  Google Apps Script (V8 runtime)                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Server.js (TypeScript compilado)                              │ │
│  │  ├─ SheetDB engine (CRUD genérico sobre Sheets)                │ │
│  │  ├─ ~80 server functions (callServer-ready)                    │ │
│  │  ├─ LLM client (UrlFetchApp → Anthropic/OpenAI/proxy)          │ │
│  │  ├─ Automações (triggers, alertas, webhooks)                   │ │
│  │  └─ Snapshot Export/Import                                     │ │
│  └────┬──────────────────────────────┬───────────────────┬────────┘ │
│       │                              │                   │          │
│       ▼ SpreadsheetApp               ▼ PropertiesService ▼ UrlFetchApp
│  ┌─────────────┐                ┌─────────────────┐  ┌──────────────┐
│  │ Google Sheets│ (DB)           │ Script Properties│ │ APIs externas│
│  │ FORJA — Base │                │ - FORJA_SHEET_ID │ │ - LLM proxy  │
│  └─────────────┘                │ - LLM_*          │ │ - GitHub     │
│                                  │ - COFRE_*        │ │ - Uptime     │
│                                  │ - GH_TOKEN       │ │ - Drive API  │
│                                  └─────────────────┘  └──────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## SheetDB Engine (`src/server.ts`)

A Forja trata o Google Sheets como banco. O engine vive em ~150 linhas no topo de `server.ts` e fornece:

### Schema declarativo

```typescript
const SCHEMA: SheetSchema[] = [
  { name: 'Sistemas', columns: ['id', 'nome', 'codinome', 'estagio', ...] },
  { name: 'Ideias',   columns: ['id', 'titulo', 'descricao', ...] },
  // ...
];
```

Cada `SheetSchema` vira uma aba na planilha `FORJA — Base de Dados` (auto-criada). A **primeira coluna é sempre `id`** (UUID).

### Operações

```typescript
dbGetAll(sheetName)           // → Record<string, unknown>[]
dbGetById(sheetName, id)      // → Record | null
dbCreate(sheetName, data)     // → Record (com id gerado)
dbUpdate(sheetName, id, data) // → boolean
dbDelete(sheetName, id)       // → boolean
```

### Migração suave

`getOrCreateSheet(name, columns)` detecta quando o `SCHEMA` ganhou colunas novas e estende a planilha sem perder dados. Sempre **adicione colunas no fim**, nunca reordene.

### Performance

- O engine lê a sheet inteira por operação (Apps Script não permite query SQL).
- Em sheets >5k linhas, considere cache via `CacheService` (não está implementado por hora — Forja é single-user).

---

## Frontend bundling

### O problema

Google Apps Script's `HtmlService` corrompe blocks `<script>` muito grandes (~500KB+) silenciosamente — caracteres viram entidades HTML mal-formadas. Resultado: tela branca, `SyntaxError: Failed to execute 'write' on 'Document'`.

### A solução

Em `esbuild.mjs`, o bundle React é fatiado em **8 chunks de ≤200KB** e embutido como múltiplos `<script>` no `App.html`:

```html
<!-- App.html -->
<script>window.__FORJA_CHUNKS__ = [];</script>
<script>window.__FORJA_CHUNKS__.push("...chunk1 base64...");</script>
<script>window.__FORJA_CHUNKS__.push("...chunk2 base64...");</script>
...
<script>
  // Concatena e executa
  const code = window.__FORJA_CHUNKS__.map(atob).join('');
  (new Function(code))();
</script>
```

Tamanho atual: **~1.6MB total / 8 chunks ≤195KB**.

### Bibliotecas escolhidas

| Lib | Por que | Custo |
|---|---|---|
| **Ant Design 5** | Componentes maduros, design tokens, ótimo a11y | ~600KB |
| **Lucide React** | Ícones outline minimalistas (substituiu `@ant-design/icons` que pesava 800KB+) | ~80KB |
| **React 18** | Padrão | ~150KB |
| **Mermaid** | Diagramas. Carregado via CDN (sob demanda) | externo |
| **CountUp** | Animações numéricas. Custom impl em `ui.tsx` | ~2KB |

Não usamos `react-router`. Routing é state simples em `App.tsx` (`view: ViewName`).

---

## Comunicação Frontend ↔ Backend

Usamos o helper `callServer` (em `src/gas-client.ts`) que envolve `google.script.run`:

```typescript
const r = await callServer<ServerResult>('snapshotExport', { incluirHistorico: true });
if (r.ok) { /* r.data tipado */ }
```

**Padrão de resposta** (todos os endpoints):

```typescript
type ServerResult<T = unknown> = 
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Em modo `dev` (vite-style preview), `callServer` retorna mocks ou erros silenciosos — permite trabalhar a UI sem subir no GAS toda hora.

---

## Sistema de tipos

Tipos compartilhados ficam em `src/types.ts`. Cada entidade do DB tem uma interface (`Sistema`, `Ideia`, `Pessoa`, ...). Mudou o schema? Atualize tanto `SCHEMA` no server quanto a interface aqui.

Em vez de gerar tipos do schema (não tem código pra isso), manualmente garantimos correspondência. Tradeoff aceito.

---

## Tema (`src/theme.ts` + `src/themeContext.tsx`)

- Tokens de cor (light + dark) com paleta pastel (`peach`, `sage`, `lavender`, `clay`, `rose`, `blue`, `coffee`).
- `useTokens()` hook retorna tokens do modo atual.
- Persistido em `localStorage` com chave `forja_theme`.
- Fontes: `Crimson Pro` (display), `Inter` (UI), `JetBrains Mono` (código). Carregadas via Google Fonts.

---

## Forja IA — fluxo de tool-calling

A IA não chama tools diretamente. Ela emite um **bloco textual** que o servidor parseia:

```
…resposta normal da IA…

<TOOL_CALLS>
[
  { "name": "criar_ideia", "args": { "titulo": "...", "descricao": "..." } },
  { "name": "registrar_risco", "args": { "sistemaId": "...", "area": "...", "descricao": "..." } }
]
</TOOL_CALLS>
```

O servidor (em `chatLLMComTools`) extrai esse bloco, valida o JSON, e retorna ao frontend separado em `texto` + `propostasTool[]`. O frontend mostra cards (`ToolProposalCard`) e o usuário aprova/recusa cada uma.

Tools disponíveis (extensíveis em `server.ts`):
- `criar_ideia` — adiciona ao banco de ideias
- `registrar_risco` — adiciona risco a um sistema
- `gerar_arquivo_md` — gera markdown que o user baixa

---

## Cofre (zero-knowledge)

Ver [SECURITY.md](SECURITY.md) pra detalhe completo. Em resumo:

1. Usuário cria senha-mestra → PBKDF2 (100k iter) → `wrappingKey`
2. Gera-se uma `vaultKey` aleatória (AES-256)
3. `vaultKey` é cifrada com `wrappingKey` → guardada em `Script Properties` como `wrappedKey`
4. Cada segredo é cifrado com `vaultKey` (AES-GCM, IV único por segredo) → guardado na sheet `Cofre`
5. Servidor nunca vê plaintext. **Toda a crypto é client-side** (`src/cofreCrypto.ts`)

---

## Automações & Triggers

`src/server.ts` define funções que rodam via time-driven triggers do GAS:

```typescript
ScriptApp.newTrigger('automacaoCronJob').timeBased().everyHours(1).create();
```

Regras configuráveis em `Configurações > Automações`. Cada execução:
1. Lê regras ativas
2. Para cada regra, busca dados (custos, pulsos, sistemas...)
3. Aplica condição (threshold)
4. Se disparou: cria `Alerta`, dispara webhook/email (com dedupe via `dedupeKey`)

---

## Snapshot / Backup

`snapshotExport()` agrega todas as sheets em um JSON único:

```typescript
interface SnapshotPayload {
  version: '1.0';
  geradoEm: string;
  forjaSheetId: string;
  cofreConfig: { /* salt, wrappedKey, wrapIv, verificador (cifrados!) */ };
  dados: Record<sheetName, Row[]>;
  estatisticas: Record<sheetName, number>;
}
```

`snapshotImport()` opera em 2 modos:
- **merge** (default): adiciona registros novos, pula IDs duplicados
- **substituir**: apaga tudo, reimporta (exige confirmação)

`snapshotPreview()` faz dry-run pra UI mostrar o impacto antes.

---

## Diretrizes pra mexer no código

1. **Server function nova?** Adicione no fim de `server.ts`, retornando `ServerResult`. Documente o "porquê" em comentário acima, não o "que".
2. **Componente UI novo?** Use `useTokens()` e `FONTS` do `theme.ts`. Não hardcode cores nem fontes.
3. **Sheet nova?** Adicione no `SCHEMA`, regenere o tipo em `types.ts`, e bote no `SNAPSHOT_SHEETS_CORE` se for stateful.
4. **Mudança de comportamento?** Atualize o `Onboarding.tsx` se for descobrível.
5. **Quebrou o bundle limit (>1.5MB)?** Analise dependências. Lazy-load com `React.lazy()` ou mover pra CDN.

---

## Estrutura de pastas

```
forja/
├── appsscript.json           # OAuth scopes + Drive Advanced Service
├── esbuild.mjs               # Build script (chunking inclusive)
├── package.json
├── src/
│   ├── App.tsx               # Root + routing
│   ├── server.ts             # GAS server (compila pra Server.js)
│   ├── types.ts              # Tipos compartilhados
│   ├── theme.ts              # Design tokens
│   ├── themeContext.tsx      # Theme provider
│   ├── useResponsive.ts      # Hook mobile
│   ├── gas-client.ts         # callServer wrapper
│   ├── cofreCrypto.ts        # Web Crypto API (Cofre)
│   ├── views/                # Pages (Dashboard, Bancada, IAChat, etc.)
│   └── components/           # UI shared (Sidebar, Modal, Drawer, etc.)
└── dist/                     # Build output → enviado pro GAS
    ├── App.html              # React app + chunks embedded
    ├── Server.js             # Server functions compiladas
    └── appsscript.json
```
