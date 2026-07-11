---
name: fb-migrar-do-gas
description: Migrate an existing Google Apps Script app to Firebase — port the server logic, move Sheets data to Firestore with a JSON export/import bridge, and keep both versions running during transition. Use when replatforming a GAS app.
---

# Migrating a GAS app to Firebase — the proven route

This exact route moved a 6,400-line production GAS app in days, reusing ~95%
of the React UI unchanged.

## Phase 1 — Port the code (UI stays intact)

1. Copy `views/`, `components/`, `types.ts` as-is.
2. Copy `server.ts` → `src/server/logic.ts` and adapt:
   - `SpreadsheetApp`/SheetDB helpers → the in-memory store (fb-firestore-db).
     Keep the same function names (`dbGetAll`, `dbCreate`…) so logic code
     doesn't change.
   - `UrlFetchApp.fetch(url, opts)` → `await fetch(url, opts)` — functions
     that call it become `async`.
   - `PropertiesService` → a `props` document in the user's Firestore subtree.
   - Remove `declare` statements for injected globals — turn them into real
     imports.
3. Replace `google.script.run` with the RPC shim (fb-client-logic). The UI
   keeps calling `callServer('fn', args)` — zero view changes.

**Pitfall that cost real hours**: automated text surgery on a 6k-line file
(regex removing `declare` blocks) silently deleted ~1,000 unrelated lines.
Port in sections and **type-check after each section** (`tsc --noEmit`), never
in one giant regex pass.

## Phase 2 — Move the data (JSON bridge)

On the **GAS side**, add an export function + button: read all tables, strip
secrets (API keys NEVER travel), download as one JSON:

```typescript
{ formato: 'app-export-v1', exportadoEm: '…',
  tabelas: { Tabela1: [...], Tabela2: [...] }, props: { chave: valor } }
```

On the **Firebase side**, show an import banner **only when the database is
empty** (first login): user uploads the JSON, validate the `formato` marker,
then batch-import with progress (400 ops per batch, `await` each commit —
see fb-firestore-db).

This design needs no shared credentials between the two apps — the file IS
the bridge, and the user owns it.

## Phase 3 — Transition period

- Keep the GAS app running read-only as fallback until the user confirms the
  new app for a full cycle (e.g. one month of finance data).
- Version both apps visibly (topbar) to avoid "which one am I in?" confusion.
- Expect data bugs to surface only with REAL data (a recurrence bug appeared
  only after migration, with real recurring incomes) — plan a bugfix window
  right after the migration, not weeks later.
