// Typed wrapper around google.script.run for calling GAS server functions.
// Usage: const result = await callServer<MyType>('myServerFunction', arg1, arg2);

declare const google: {
  script: {
    run: {
      withSuccessHandler: <T>(fn: (result: T) => void) => GoogleScriptRun;
      withFailureHandler: (fn: (err: Error) => void) => GoogleScriptRun;
    } & Record<string, (...args: unknown[]) => void>;
  };
};

interface GoogleScriptRun {
  withSuccessHandler: <T>(fn: (result: T) => void) => GoogleScriptRun;
  withFailureHandler: (fn: (err: Error) => void) => GoogleScriptRun;
  [key: string]: unknown;
}

// ── Indicador global de carregamento ────────────────────────────────────────
// Conta quantas chamadas RPC estão em andamento e avisa os assinantes. Assim
// qualquer componente (ex.: a barra de progresso no topo) sabe quando há
// atividade — sem precisar instrumentar cada tela.
let _inFlight = 0;
const _loadingListeners = new Set<(carregando: boolean) => void>();

function _emitLoading(): void {
  const carregando = _inFlight > 0;
  _loadingListeners.forEach((fn) => { try { fn(carregando); } catch { /* ignora listener quebrado */ } });
}

export function subscribeLoading(fn: (carregando: boolean) => void): () => void {
  _loadingListeners.add(fn);
  fn(_inFlight > 0); // estado atual na hora de assinar
  return () => { _loadingListeners.delete(fn); };
}

export function isLoading(): boolean { return _inFlight > 0; }

function _beginCall(): void { _inFlight++; if (_inFlight === 1) _emitLoading(); }
function _endCall(): void { _inFlight = Math.max(0, _inFlight - 1); if (_inFlight === 0) _emitLoading(); }

function callServer<T>(fnName: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let finalizado = false;
    const fim = () => { if (!finalizado) { finalizado = true; _endCall(); } };
    _beginCall();
    try {
      (google.script.run
        .withSuccessHandler((result: T) => {
          fim();
          // GAS às vezes serializa `undefined` ou função sem retorno como null
          // — quem chama costuma fazer `res.ok` e estoura TypeError. Em vez de
          // resolver com null e quebrar a árvore, devolvemos um ServerResponse
          // de erro genérico (forçado pelo cast). Funções que esperam tipos
          // primitivos (boolean, string) recebem o valor real normalmente.
          if (result === null || result === undefined) {
            console.warn(`[callServer] '${fnName}' devolveu null/undefined`);
            resolve({ ok: false, error: `Sem resposta do servidor para '${fnName}'.` } as unknown as T);
            return;
          }
          resolve(result);
        })
        .withFailureHandler((err: Error) => {
          fim();
          console.warn(`[callServer] '${fnName}' falhou:`, err);
          reject(err);
        }) as Record<string, (...a: unknown[]) => void>)
        [fnName](...args);
    } catch {
      // google.script.run is undefined when running locally
      fim();
      reject(new Error('google.script.run not available in local preview'));
    }
  });
}

export default callServer;
