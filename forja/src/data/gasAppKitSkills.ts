// ─── Skills dos pacotes locais embarcadas no build ───────────────────────────
// __GAS_APP_KIT_SKILLS__ e __FIREBASE_APP_KIT_SKILLS__ são injetados em
// build-time pelo esbuild, lendo ../<pacote>/skills/<nome>/SKILL.md.
// Sem build (dev/teste), ficam [].
//
// `fonte` é estável ("<pacote>/<nome>") pra que a importação no Skills Hub
// seja idempotente: reimportar atualiza a skill existente em vez de duplicar.

declare const __GAS_APP_KIT_SKILLS__: Array<{ fonte: string; conteudo: string }>;
declare const __FIREBASE_APP_KIT_SKILLS__: Array<{ fonte: string; conteudo: string }>;

export interface KitSkill {
  fonte: string;
  conteudo: string;
}

export const GAS_APP_KIT_SKILLS: KitSkill[] =
  typeof __GAS_APP_KIT_SKILLS__ !== 'undefined' ? __GAS_APP_KIT_SKILLS__ : [];

export const FIREBASE_APP_KIT_SKILLS: KitSkill[] =
  typeof __FIREBASE_APP_KIT_SKILLS__ !== 'undefined' ? __FIREBASE_APP_KIT_SKILLS__ : [];
