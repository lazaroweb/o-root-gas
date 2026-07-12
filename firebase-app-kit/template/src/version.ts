// __APP_VERSION__ é injetado em build-time pelo Vite (vite.config.ts) a partir
// do package.json. Em ambiente sem build, retorna 'dev'.
declare const __APP_VERSION__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
