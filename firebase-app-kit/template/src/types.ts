// ─── Contratos compartilhados UI ↔ lógica ────────────────────────────────────

/** Retorno padrão de TODA função de negócio (RPC). A UI lê `ok` — nunca try/catch. */
export interface ServerResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Exemplo de entidade do app de demonstração. Troque pelas suas. */
export interface Nota {
  id: string;
  texto: string;
  criadoEm: string;
  atualizadoEm: string;
}
