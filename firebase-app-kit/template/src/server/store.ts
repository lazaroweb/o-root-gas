// ─── Store — o banco do app ──────────────────────────────────────────────────
// Cache em memória espelhado no Firestore. A lógica de negócio (logic.ts) é
// SÍNCRONA: lê e escreve na memória na hora; a persistência no Firestore
// acontece em write-through assíncrono (fire-and-forget com fila de erros).
//
// Modelo de dados no Firestore (isolado por usuário pelas security rules):
//   usuarios/{uid}/{Tabela}/{rowId}        → uma linha por documento
//   usuarios/{uid}/meta/props              → doc único com as "properties"
import {
  collection, doc, getDocs, setDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Declare aqui TODAS as tabelas do app — a carga inicial lê cada uma.
export const TABELAS = [
  'Notas',
] as const;

type Row = Record<string, unknown>;

let _uid: string | null = null;
const _mem = new Map<string, Map<string, Row>>();
let _props: Record<string, string> = {};
let _carregada = false;

// Erros de persistência ficam aqui pra UI poder alertar (não silenciamos).
const _errosPersistencia: string[] = [];
export function errosPersistencia(): string[] { return [..._errosPersistencia]; }

function _registrarErro(e: unknown, contexto: string): void {
  const msg = `${contexto}: ${e instanceof Error ? e.message : String(e)}`;
  _errosPersistencia.push(msg);
  console.error('[store] falha de persistência —', msg);
}

function _rowsCol(tabela: string) {
  if (!_uid) throw new Error('Store sem usuário — faça login primeiro.');
  return collection(db, 'usuarios', _uid, tabela);
}

function _propsDoc() {
  if (!_uid) throw new Error('Store sem usuário — faça login primeiro.');
  return doc(db, 'usuarios', _uid, 'meta', 'props');
}

/** Carrega TODA a base do usuário pro cache em memória. Uma vez por sessão. */
export async function carregarBase(uid: string): Promise<void> {
  if (_carregada && _uid === uid) return;
  _uid = uid;
  _mem.clear();
  const cargas = TABELAS.map(async (t) => {
    const snap = await getDocs(_rowsCol(t));
    const m = new Map<string, Row>();
    snap.forEach((d) => { m.set(d.id, d.data() as Row); });
    _mem.set(t, m);
  });
  const propsSnap = getDocs(collection(db, 'usuarios', uid, 'meta')).then((snap) => {
    _props = {};
    snap.forEach((d) => { if (d.id === 'props') _props = (d.data() || {}) as Record<string, string>; });
  });
  await Promise.all([...cargas, propsSnap]);
  _carregada = true;
}

export function baseCarregada(): boolean { return _carregada; }
// Obrigatório no logout — memória de outra conta é vazamento de dados.
export function resetStore(): void { _uid = null; _mem.clear(); _props = {}; _carregada = false; }

function _tabela(nome: string): Map<string, Row> {
  let m = _mem.get(nome);
  if (!m) { m = new Map(); _mem.set(nome, m); }
  return m;
}

export function generateId(): string {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Firestore rejeita `undefined` — normaliza pra string vazia. Date vira ISO
// string pra os dados fazerem round-trip idênticos.
function _sanear(data: Row): Row {
  const limpo: Row = {};
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (v === undefined) { limpo[k] = ''; continue; }
    if (v instanceof Date) { limpo[k] = v.toISOString(); continue; }
    limpo[k] = v;
  }
  return limpo;
}

// ─── API síncrona (a lógica de negócio nunca espera o Firestore) ─────────────

export function dbGetAll(tabela: string): Row[] {
  return Array.from(_tabela(tabela).values()).map((r) => ({ ...r }));
}

export function dbGetById(tabela: string, id: string): Row | null {
  const r = _tabela(tabela).get(String(id));
  return r ? { ...r } : null;
}

export function dbCreate(tabela: string, data: Row): Row {
  const id = String(data.id || generateId());
  const agora = new Date().toISOString();
  const row = _sanear({ criadoEm: agora, atualizadoEm: agora, ...data, id });
  _tabela(tabela).set(id, row);
  setDoc(doc(_rowsCol(tabela), id), row).catch((e) => _registrarErro(e, `criar em ${tabela}`));
  return { ...row };
}

// Firestore aceita no máx. 500 operações por batch — fatiamos com folga.
const BATCH_MAX = 400;

export function dbBatchCreate(tabela: string, itens: Row[]): Row[] {
  const agora = new Date().toISOString();
  const criados: Row[] = [];
  for (let i = 0; i < itens.length; i += BATCH_MAX) {
    const batch = writeBatch(db);
    for (const data of itens.slice(i, i + BATCH_MAX)) {
      const id = String(data.id || generateId());
      const row = _sanear({ criadoEm: agora, atualizadoEm: agora, ...data, id });
      _tabela(tabela).set(id, row);
      batch.set(doc(_rowsCol(tabela), id), row);
      criados.push({ ...row });
    }
    batch.commit().catch((e) => _registrarErro(e, `criar lote em ${tabela}`));
  }
  return criados;
}

/**
 * Importação em massa (migrações/restauração de backup): preserva id e
 * criadoEm originais, e SÓ retorna depois do Firestore confirmar — importação
 * não pode ser fire-and-forget. Atualiza o cache em memória junto.
 */
export async function importarLote(
  tabela: string,
  linhas: Row[],
  onProgress?: (gravadas: number) => void,
): Promise<number> {
  let gravadas = 0;
  for (let i = 0; i < linhas.length; i += BATCH_MAX) {
    const fatia = linhas.slice(i, i + BATCH_MAX);
    const batch = writeBatch(db);
    for (const data of fatia) {
      const id = String(data.id || generateId());
      const row = _sanear({ ...data, id });
      _tabela(tabela).set(id, row);
      batch.set(doc(_rowsCol(tabela), id), row);
    }
    await batch.commit();
    gravadas += fatia.length;
    if (onProgress) onProgress(gravadas);
  }
  return gravadas;
}

export function dbUpdate(tabela: string, id: string, data: Row): Row | null {
  const m = _tabela(tabela);
  const atual = m.get(String(id));
  if (!atual) return null;
  const row = _sanear({ ...atual, ...data, id: String(id), atualizadoEm: new Date().toISOString() });
  m.set(String(id), row);
  setDoc(doc(_rowsCol(tabela), String(id)), row).catch((e) => _registrarErro(e, `atualizar em ${tabela}`));
  return { ...row };
}

export function dbDelete(tabela: string, id: string): boolean {
  const m = _tabela(tabela);
  if (!m.has(String(id))) return false;
  m.delete(String(id));
  deleteDoc(doc(_rowsCol(tabela), String(id))).catch((e) => _registrarErro(e, `apagar em ${tabela}`));
  return true;
}

export function dbDeleteMany(tabela: string, ids: string[]): number {
  const m = _tabela(tabela);
  let n = 0;
  const batch = writeBatch(db);
  for (const id of ids) {
    if (!m.has(String(id))) continue;
    m.delete(String(id));
    batch.delete(doc(_rowsCol(tabela), String(id)));
    n++;
  }
  if (n > 0) batch.commit().catch((e) => _registrarErro(e, `apagar lote em ${tabela}`));
  return n;
}

// ─── Properties (pares chave→valor por usuário) ──────────────────────────────
// Doc único `meta/props`. Write-through com merge. Use pra configurações do
// usuário (ex.: a chave de IA dele) — nunca pra segredos compartilhados.

export const props = {
  getProperty(k: string): string | null {
    const v = _props[k];
    return v === undefined || v === null || v === '' ? (v === '' ? '' : null) : String(v);
  },
  setProperty(k: string, v: string): void {
    _props[k] = String(v);
    setDoc(_propsDoc(), { [k]: String(v) }, { merge: true }).catch((e) => _registrarErro(e, `salvar prop ${k}`));
  },
  deleteProperty(k: string): void {
    delete _props[k];
    setDoc(_propsDoc(), { [k]: '' }, { merge: true }).catch((e) => _registrarErro(e, `limpar prop ${k}`));
  },
};
