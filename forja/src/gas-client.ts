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

function callServer<T>(fnName: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      (google.script.run
        .withSuccessHandler((result: T) => {
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
          console.warn(`[callServer] '${fnName}' falhou:`, err);
          reject(err);
        }) as Record<string, (...a: unknown[]) => void>)
        [fnName](...args);
    } catch {
      // google.script.run is undefined when running locally
      reject(new Error('google.script.run not available in local preview'));
    }
  });
}

export default callServer;
