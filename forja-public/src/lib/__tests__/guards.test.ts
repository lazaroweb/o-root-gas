import { describe, it, expect, vi } from 'vitest';
import { sanitizeTokenCore, throttleOkCore, type ThrottleCache } from '../guards';

// Trava de regressão dos guards do formulário público — o caminho mais
// exposto da Forja (endpoint anônimo). Cobre o fail-closed do throttle
// (achado ALTA/seguranca da auditoria) e a sanitização de token (A05).

function cacheFake(inicial: Record<string, string> = {}): ThrottleCache & { dados: Record<string, string> } {
  const dados = { ...inicial };
  return {
    dados,
    get: (k) => (k in dados ? dados[k] : null),
    put: (k, v) => { dados[k] = v; },
  };
}

describe('throttleOkCore', () => {
  it('permite a primeira submissão e grava a chave na janela', () => {
    const cache = cacheFake();
    expect(throttleOkCore(() => cache, 'tok123', 4)).toBe(true);
    expect(cache.dados['thr_tok123']).toBe('1');
  });

  it('bloqueia submissão repetida dentro da janela', () => {
    const cache = cacheFake({ thr_tok123: '1' });
    expect(throttleOkCore(() => cache, 'tok123', 4)).toBe(false);
  });

  it('FAIL-CLOSED: erro ao obter o cache BLOQUEIA (não libera spam)', () => {
    const log = vi.fn();
    const resultado = throttleOkCore(() => { throw new Error('quota exceeded'); }, 'tok123', 4, log);
    expect(resultado).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('throttle degraded'));
  });

  it('FAIL-CLOSED: erro no get/put do cache também bloqueia', () => {
    const cacheQuebrado: ThrottleCache = {
      get: () => { throw new Error('cache indisponível'); },
      put: () => { throw new Error('cache indisponível'); },
    };
    expect(throttleOkCore(() => cacheQuebrado, 'tok123', 4)).toBe(false);
  });

  it('tokens diferentes não colidem na janela', () => {
    const cache = cacheFake();
    expect(throttleOkCore(() => cache, 'tokA', 4)).toBe(true);
    expect(throttleOkCore(() => cache, 'tokB', 4)).toBe(true);
    expect(throttleOkCore(() => cache, 'tokA', 4)).toBe(false);
  });
});

describe('sanitizeTokenCore', () => {
  it('mantém token válido intacto', () => {
    expect(sanitizeTokenCore('aBc-123_XYZ')).toBe('aBc-123_XYZ');
  });

  it('remove tentativas de injection (HTML, aspas, path traversal, espaços)', () => {
    expect(sanitizeTokenCore('<script>alert(1)</script>')).toBe('scriptalert1script');
    expect(sanitizeTokenCore("tok' OR '1'='1")).toBe('tokOR11');
    expect(sanitizeTokenCore('../../etc/passwd')).toBe('etcpasswd');
    expect(sanitizeTokenCore('tok en\ncom espaço')).toBe('tokencomespao');
  });

  it('trunca em 64 caracteres (anti-DoS de chave de cache)', () => {
    expect(sanitizeTokenCore('a'.repeat(200))).toHaveLength(64);
  });

  it('entrada não-string vira string vazia segura', () => {
    expect(sanitizeTokenCore(null)).toBe('');
    expect(sanitizeTokenCore(undefined)).toBe('');
    expect(sanitizeTokenCore({})).toBe('objectObject');
    expect(sanitizeTokenCore(12345)).toBe('12345');
  });
});
