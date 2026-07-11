---
name: fb-client-logic
description: Business logic in the browser with an RPC registry — the callServer shim that mimics google.script.run, making GAS apps portable to Firebase almost mechanically. Use when structuring app logic or porting a GAS app.
---

# Client-side logic — the RPC registry pattern

There is no server. All business logic lives in `src/server/logic.ts` and runs
in the browser, reading/writing through the in-memory store (fb-firestore-db).
The UI never imports logic functions directly — it calls them through a tiny
RPC shim. This indirection is what made porting a 6,400-line GAS server file
possible with minimal changes.

## The registry (`src/server/logic.ts`, bottom of file)

```typescript
// Every function the UI can call, by name — the equivalent of GAS's
// global function namespace for google.script.run.
export const RPCS: Record<string, (...args: unknown[]) => unknown> = {
  salvarLancamento, deletarLancamento, getResumoMes, gerarRecorrencias,
  interpretarFaturaIA, /* … */
};
```

## The shim (`src/gas-client.ts`)

```typescript
export default async function callServer<T>(fn: string, ...args: unknown[]): Promise<T> {
  const f = RPCS[fn];
  if (!f) throw new Error(`RPC desconhecida: ${fn}`);
  mostrarLoadingGlobal();                    // same UX as GAS round-trips
  try { return (await f(...args)) as T; }
  finally { esconderLoadingGlobal(); }
}
```

UI code is identical to a GAS app: `await callServer('salvarLancamento', payload)`.

## Conventions that keep this sane

- **`ServerResult` everywhere**: every RPC returns
  `{ ok: boolean, data?: T, error?: string }`. The UI never try/catches
  business errors — it reads `res.ok`.
- Logic functions are **synchronous** when possible (memory reads). Only
  LLM/HTTP calls are async — the registry accepts both, `await` handles it.
- **Porting from GAS**: replace `UrlFetchApp.fetch` with `fetch` + `await`,
  `PropertiesService` with a `props` document in Firestore, `Utilities.sleep`
  with `await sleep()`. Keep function names — the UI won't notice.
- **Secrets caveat**: code runs client-side, so an API key used here is
  visible to the logged-in user. Fine for BYO-key models (each user enters
  their own Gemini key, stored in their Firestore subtree). NOT fine for a
  shared master key — that needs Cloud Functions or a proxy.

## PDF/print without a server

GAS had `HtmlService` → PDF. In the browser, generate the HTML and open a
print window (`window.open` + `document.write` + `print()`) — the user saves
as PDF natively. No library, no server, same visual result.
