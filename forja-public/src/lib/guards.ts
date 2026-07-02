// Guards do formulário público — funções PURAS/injetáveis extraídas do
// server.ts pra serem testáveis com vitest (o server.ts depende de globals do
// GAS — CacheService, Logger — e não roda em Node). O esbuild.mjs injeta este
// arquivo no topo do dist/Server.js, então as funções viram globais no GAS.

export interface ThrottleCache {
  get(key: string): string | null;
  put(key: string, value: string, expirationInSeconds: number): void;
}

// Token de formulário: só [a-zA-Z0-9_-], máx 64 chars — neutraliza injection
// (A05) antes do token tocar planilha, cache ou HTML.
export function sanitizeTokenCore(t: unknown): string {
  return String(t || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

// Rate-limit por token. FAIL-CLOSED (OWASP A10): qualquer erro do cache
// BLOQUEIA a submissão — se falha liberasse, degradar o cache (quota,
// permissão) desligaria o anti-spam exatamente no pior momento.
export function throttleOkCore(
  getCache: () => ThrottleCache,
  token: string,
  janelaSeg: number,
  log?: (msg: string) => void,
): boolean {
  try {
    const cache = getCache();
    const key = 'thr_' + token;
    if (cache.get(key)) return false;
    cache.put(key, '1', janelaSeg);
    return true;
  } catch (e) {
    if (log) log('throttle degraded: ' + String(e));
    return false;
  }
}
