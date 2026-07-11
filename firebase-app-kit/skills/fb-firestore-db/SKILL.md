---
name: fb-firestore-db
description: The in-memory store pattern — load the user's Firestore collections once, read synchronously in memory, persist write-through in the background, and respect the 500-op batch limit. Use whenever the app needs to persist data.
---

# Firestore as a database — the in-memory store pattern

Battle-tested pattern (production app with 14 tables): instead of sprinkling
async Firestore calls through the code, load everything once and mirror it in
memory. Business logic gets **synchronous** reads (like it had with SheetDB on
GAS) and stays trivially portable.

## The store (`src/server/store.ts`)

```typescript
type Row = Record<string, unknown>;
const _mem = new Map<string, Map<string, Row>>();   // tabela -> id -> row
let _uid = '';

const _rowsCol = (tabela: string) => collection(db, 'usuarios', _uid, tabela);

// Called once after login: hydrate every table into memory.
export async function carregarBase(uid: string): Promise<void> {
  _uid = uid;
  for (const t of TABELAS) {
    const snap = await getDocs(_rowsCol(t));
    const m = new Map<string, Row>();
    snap.forEach((d) => m.set(d.id, d.data() as Row));
    _mem.set(t, m);
  }
}

// Synchronous read — business logic never awaits.
export function dbGetAll(tabela: string): Row[] {
  return [...(_mem.get(tabela) ?? new Map()).values()].map((r) => ({ ...r }));
}

// Write-through: memory now, Firestore in background (errors logged).
export function dbCreate(tabela: string, data: Row): Row {
  const id = String(data.id || crypto.randomUUID());
  const row = { criadoEm: new Date().toISOString(), ...data, id };
  _mem.get(tabela)!.set(id, row);
  setDoc(doc(_rowsCol(tabela), id), row).catch(registrarErro);
  return { ...row };
}
// dbUpdate merges { ...atual, ...patch }; dbDelete removes both places.
```

## Hard rules learned in production

- **Batch limit is 500 operations.** Chunk bulk writes at 400 with
  `writeBatch(db)`; one oversized batch throws and nothing commits. For
  migrations/imports, `await batch.commit()` each chunk and report progress.
- **Sanitize before writing**: Firestore rejects `undefined` values — strip
  them (`_sanear`). Dates go as ISO strings, not `Date` objects, so data
  round-trips identically.
- **Reset the store on logout** or user switch — stale memory from another
  account is a data-leak bug.
- **IDs**: `crypto.randomUUID()`; never rely on Firestore auto-IDs so rows can
  carry their ID inside the document too (simplifies export/import).
- **Data model**: everything under `usuarios/{uid}/<tabela>/<id>` — this is
  what makes the per-user security rules trivial (see fb-firestore-rules).

## Costs intuition

Loading N documents on startup = N reads per session. For a personal-finance
app with ~2k rows that is ~2k reads per login — far below the 50k/day free
tier. Do NOT add realtime listeners (`onSnapshot`) unless a feature truly
needs live sync; they multiply reads.
