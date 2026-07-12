// ─── Beta fechado — posse e convites ─────────────────────────────────────────
// A porteira REAL fica nas security rules (firestore.rules): só entra quem é
// dono ou tem doc em convites/{email}. O dono é quem reivindicou config/dono
// (o primeiro a abrir o app); as rules comparam o UID, então nenhum e-mail
// fica hardcoded no código.
import { collection, getDocs, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import type { ServerResult } from '../types';

interface Dono { uid: string; email: string }

let _donoCache: Dono | null = null;

async function _lerDono(): Promise<Dono | null> {
  if (_donoCache) return _donoCache;
  try {
    const snap = await getDoc(doc(db, 'config', 'dono'));
    if (!snap.exists()) return null;
    const d = snap.data() as Dono;
    _donoCache = { uid: String(d.uid || ''), email: String(d.email || '') };
    return _donoCache;
  } catch {
    return null;
  }
}

/**
 * Reivindica a posse do app se ainda não tiver dono — as rules só aceitam o
 * create enquanto config/dono não existe, então não há corrida: o primeiro
 * grava, os demais falham silenciosamente. Chamar no login, ANTES da base.
 */
export async function garantirDono(): Promise<void> {
  const u = auth.currentUser;
  if (!u) return;
  try {
    const atual = await _lerDono();
    if (atual) return;
    await setDoc(doc(db, 'config', 'dono'), {
      uid: u.uid,
      email: (u.email || '').trim().toLowerCase(),
      criadoEm: new Date().toISOString(),
    });
    _donoCache = null; // relê na próxima consulta
  } catch { /* dono já existe (create negado pelas rules) — segue */ }
}

export async function ehDono(): Promise<boolean> {
  const dono = await _lerDono();
  return !!dono && !!auth.currentUser && dono.uid === auth.currentUser.uid;
}

export async function getBetaConfig(): Promise<ServerResult> {
  if (!(await ehDono())) return { ok: false, error: 'Só o dono gerencia convites.' };
  try {
    const dono = await _lerDono();
    const snap = await getDocs(collection(db, 'convites'));
    const convidados = snap.docs.map((d) => d.id).sort();
    return { ok: true, data: { dono: dono?.email || '', convidados } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao ler convites' };
  }
}

// Recebe o textarea inteiro (um e-mail por linha) e sincroniza a coleção:
// cria os novos, remove os que saíram da lista. O doc id É o e-mail — é o que
// as rules consultam via exists().
export async function salvarConvidados(texto: string): Promise<ServerResult> {
  if (!(await ehDono())) return { ok: false, error: 'Só o dono gerencia convites.' };
  try {
    const donoEmail = (await _lerDono())?.email || '';
    const desejados = String(texto || '')
      .split(/[\n,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e !== donoEmail);
    const unicos = [...new Set(desejados)];

    const snap = await getDocs(collection(db, 'convites'));
    const atuais = new Set(snap.docs.map((d) => d.id));

    const batch = writeBatch(db);
    for (const email of unicos) {
      if (!atuais.has(email)) batch.set(doc(db, 'convites', email), { criadoEm: new Date().toISOString() });
    }
    for (const email of atuais) {
      if (!unicos.includes(email)) batch.delete(doc(db, 'convites', email));
    }
    await batch.commit();
    return { ok: true, data: { convidados: unicos } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar convites' };
  }
}
