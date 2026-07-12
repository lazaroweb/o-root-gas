// ─── Lógica de negócio ───────────────────────────────────────────────────────
// TODA a regra de negócio do app vive aqui e roda NO NAVEGADOR, lendo e
// escrevendo no store em memória (persistência write-through no Firestore).
// A UI nunca importa estas funções direto — chama via callServer('nome', args),
// que resolve no registry RPCS lá embaixo.
//
// Convenções:
// - Toda função retorna ServerResult ({ ok, data?, error? }).
// - Funções são síncronas quando dá (memória); só HTTP/LLM são async.
// - Nunca use segredo compartilhado aqui: este código é visível no bundle.
import { dbGetAll, dbCreate, dbUpdate, dbDelete } from './store';
import { getBetaConfig, salvarConvidados } from './acesso';
import type { ServerResult, Nota } from '../types';

// ─── Demo: Notas (troque pelo domínio do seu app) ────────────────────────────

function getNotas(): ServerResult<Nota[]> {
  try {
    const notas = (dbGetAll('Notas') as unknown as Nota[])
      .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));
    return { ok: true, data: notas };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao listar notas' };
  }
}

function salvarNota(payload: { id?: string; texto: string }): ServerResult<Nota> {
  try {
    const texto = String(payload.texto || '').trim();
    if (!texto) return { ok: false, error: 'Escreva alguma coisa primeiro.' };
    const row = payload.id
      ? dbUpdate('Notas', payload.id, { texto })
      : dbCreate('Notas', { texto });
    if (!row) return { ok: false, error: 'Nota não encontrada' };
    return { ok: true, data: row as unknown as Nota };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar nota' };
  }
}

function deletarNota(id: string): ServerResult {
  try {
    return dbDelete('Notas', String(id))
      ? { ok: true }
      : { ok: false, error: 'Nota não encontrada' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao apagar nota' };
  }
}

// ─── Registry de RPCs ────────────────────────────────────────────────────────
// Toda função que a UI pode chamar, por nome. Adicionou uma função? Registra
// aqui — é o equivalente do namespace global do google.script.run no GAS.
export const RPCS: Record<string, (...args: never[]) => unknown> = {
  getNotas,
  salvarNota,
  deletarNota,
  getBetaConfig,
  salvarConvidados,
};
