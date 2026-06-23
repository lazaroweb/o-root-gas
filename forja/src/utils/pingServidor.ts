// pingServidor — verificação leve de "tá no ar?" client-side (v1.146.1).
//
// Por que client-side: o Forja roda como Google Apps Script (servidor na
// nuvem do Google). UrlFetchApp.fetch NÃO chega em localhost/192.168/IP
// privado da rede do user. A única forma de pingar a infra LOCAL do dono
// do app é do navegador dele.
//
// Por que `no-cors`: a maioria dos servidores locais (Ollama, LiteLLM,
// Postgres exposed, ComfyUI…) NÃO retorna headers CORS. Com `mode: 'no-cors'`
// o browser ainda envia a request — a Promise resolve se houver QUALQUER
// resposta HTTP (mesmo opaca), e rejeita se não houver (DNS, recusa,
// timeout). É um sinal binário "respondeu / não respondeu" — perfeito
// pra status de saúde.
//
// Limitações conscientes:
// - Não diferencia 200 de 500 (no-cors esconde isso). Pra cá serve, porque
//   "respondeu algo" geralmente significa "processo de pé".
// - Mixed content: se Forja roda em HTTPS e o servidor é HTTP, o browser
//   pode bloquear. Detectamos e marcamos como 'bloqueado_mixed'.
// - Servidores sem URL ficam 'sem_url' (você nem pingou).

export type PingStatus = 'online' | 'offline' | 'sem_url' | 'bloqueado_mixed' | 'verificando';

export interface PingResult {
  status: PingStatus;
  latenciaMs?: number;
  erro?: string;
  verificadoEm: number; // epoch ms
}

interface ServidorPingavel {
  url?: string;
  host?: string;
  porta?: string;
}

// Monta a URL pra pingar: prefere `url` explícita; senão tenta `http://host:porta`.
// Retorna null se não tem nada pra pingar.
export function urlPingavel(s: ServidorPingavel): string | null {
  const u = String(s.url || '').trim();
  if (u) {
    if (/^https?:\/\//i.test(u)) return u;
    return `http://${u}`;
  }
  const host = String(s.host || '').trim();
  const porta = String(s.porta || '').trim();
  if (!host && !porta) return null;
  const h = host || 'localhost';
  return porta ? `http://${h}:${porta}` : `http://${h}`;
}

// Detecta mixed-content: HTTPS no Forja tentando bater em HTTP local.
// Browser bloqueia silenciosamente — vale avisar o user.
function ehMixedContent(targetUrl: string): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.protocol !== 'https:') return false;
  return /^http:\/\//i.test(targetUrl);
}

/**
 * Pinga um servidor. Considera "online" se o browser conseguir bater na URL
 * e receber qualquer resposta HTTP (mesmo opaca). Timeout configurável.
 *
 * @param target objeto com url/host/porta
 * @param timeoutMs default 5000
 */
export async function pingServidor(
  target: ServidorPingavel,
  timeoutMs = 5000,
): Promise<PingResult> {
  const url = urlPingavel(target);
  const agora = Date.now();
  if (!url) {
    return { status: 'sem_url', verificadoEm: agora };
  }
  if (ehMixedContent(url)) {
    return {
      status: 'bloqueado_mixed',
      verificadoEm: agora,
      erro: 'Forja roda em HTTPS e este servidor é HTTP — o navegador bloqueia o ping. Acesse o servidor manualmente pra confirmar.',
    };
  }

  const inicio = performance.now();
  try {
    // AbortSignal.timeout disponível em todos browsers modernos (2023+).
    // Fallback manual com setTimeout caso o usuário esteja em browser antigo.
    const signal = typeof AbortSignal !== 'undefined' && (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout
      ? (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout(timeoutMs)
      : (() => {
          const c = new AbortController();
          setTimeout(() => c.abort(), timeoutMs);
          return c.signal;
        })();

    // `cache: 'no-store'` evita resposta cacheada antiga marcar como "online".
    // `redirect: 'follow'` aceita redirects (login pages, etc).
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      redirect: 'follow',
      signal,
    });
    return {
      status: 'online',
      latenciaMs: Math.round(performance.now() - inicio),
      verificadoEm: agora,
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: 'offline',
      verificadoEm: agora,
      erro: msg.includes('abort') ? 'Timeout — sem resposta em ' + timeoutMs + 'ms' : msg,
    };
  }
}

/**
 * Pinga vários servidores em paralelo (com cap de concorrência pra não
 * estourar a rede do user em listas grandes). Retorna Map de id → resultado.
 */
export async function pingMuitos<T extends { id: string } & ServidorPingavel>(
  servidores: T[],
  timeoutMs = 5000,
  concorrencia = 6,
): Promise<Map<string, PingResult>> {
  const out = new Map<string, PingResult>();
  const fila = [...servidores];
  const workers = Array(Math.min(concorrencia, fila.length)).fill(0).map(async () => {
    while (fila.length) {
      const s = fila.shift();
      if (!s) break;
      const r = await pingServidor(s, timeoutMs);
      out.set(s.id, r);
    }
  });
  await Promise.all(workers);
  return out;
}
