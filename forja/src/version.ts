// ─── Versão do app ───────────────────────────────────────────────────────────
// __FORJA_VERSION__ é injetado em build-time pelo esbuild a partir do
// package.json. Em ambiente de dev/teste sem build, retorna 'dev'.
//
// Uso:
//   import { FORJA_VERSION } from './version';
//   <span>v{FORJA_VERSION}</span>

declare const __FORJA_VERSION__: string;

export const FORJA_VERSION: string =
  typeof __FORJA_VERSION__ !== 'undefined' ? __FORJA_VERSION__ : 'dev';
