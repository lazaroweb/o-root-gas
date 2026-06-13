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
        .withSuccessHandler((result: T) => resolve(result))
        .withFailureHandler((err: Error) => reject(err)) as Record<string, (...a: unknown[]) => void>)
        [fnName](...args);
    } catch {
      // google.script.run is undefined when running locally
      reject(new Error('google.script.run not available in local preview'));
    }
  });
}

export default callServer;
