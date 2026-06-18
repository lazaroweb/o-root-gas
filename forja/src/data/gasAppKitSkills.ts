// ─── Skills do GAS App Kit embarcadas no build ───────────────────────────────
// __GAS_APP_KIT_SKILLS__ é injetado em build-time pelo esbuild, lendo os
// arquivos ../gas-app-kit/skills/<nome>/SKILL.md. Sem build (dev/teste), fica [].
//
// `fonte` é estável ("gas-app-kit/<nome>") pra que a importação no Skills Hub
// seja idempotente: reimportar atualiza a skill existente em vez de duplicar.

declare const __GAS_APP_KIT_SKILLS__: Array<{ fonte: string; conteudo: string }>;

export interface KitSkill {
  fonte: string;
  conteudo: string;
}

export const GAS_APP_KIT_SKILLS: KitSkill[] =
  typeof __GAS_APP_KIT_SKILLS__ !== 'undefined' ? __GAS_APP_KIT_SKILLS__ : [];
