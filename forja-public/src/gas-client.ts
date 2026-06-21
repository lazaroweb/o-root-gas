// Wrapper tipado sobre google.script.run para o formulário público.

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

export default function callServer<T>(fnName: string, ...args: unknown[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    try {
      (google.script.run
        .withSuccessHandler((result: T) => {
          if (result === null || result === undefined) {
            resolve({ ok: false, error: 'Sem resposta do servidor.' } as unknown as T);
            return;
          }
          resolve(result);
        })
        .withFailureHandler((err: Error) => reject(err)) as Record<string, (...a: unknown[]) => void>)
        [fnName](...args);
    } catch {
      reject(new Error('google.script.run indisponível (preview local)'));
    }
  });
}
