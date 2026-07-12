// ─── callServer — a ponte UI → lógica ────────────────────────────────────────
// Mesma ergonomia do google.script.run do GAS, mas resolvendo no registry
// local (src/server/logic.ts), que opera sobre o Firestore. Mantém um
// indicador global de carregamento pra UI mostrar atividade.
import { RPCS } from './server/logic';

let _inFlight = 0;
const _loadingListeners = new Set<(carregando: boolean) => void>();

function _emitLoading(): void {
  const carregando = _inFlight > 0;
  _loadingListeners.forEach((fn) => { try { fn(carregando); } catch { /* listener quebrado */ } });
}

/** A UI assina pra mostrar a barrinha de "processando" global. */
export function subscribeLoading(fn: (carregando: boolean) => void): () => void {
  _loadingListeners.add(fn);
  fn(_inFlight > 0);
  return () => { _loadingListeners.delete(fn); };
}

export function isLoading(): boolean { return _inFlight > 0; }

async function callServer<T>(fnName: string, ...args: unknown[]): Promise<T> {
  const fn = RPCS[fnName] as ((...a: unknown[]) => unknown) | undefined;
  if (!fn) {
    console.warn(`[callServer] RPC desconhecida: '${fnName}'`);
    return { ok: false, error: `Função '${fnName}' não existe.` } as unknown as T;
  }
  _inFlight++; if (_inFlight === 1) _emitLoading();
  try {
    const result = await Promise.resolve(fn(...args));
    if (result === null || result === undefined) {
      return { ok: false, error: `Sem resposta para '${fnName}'.` } as unknown as T;
    }
    return result as T;
  } finally {
    _inFlight = Math.max(0, _inFlight - 1);
    if (_inFlight === 0) _emitLoading();
  }
}

export default callServer;
