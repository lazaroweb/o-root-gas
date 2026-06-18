#!/usr/bin/env node
// ─── npm run rollback -- <numeroDaVersao> ───────────────────────────────────
// Aponta o deploy estável (URL fixa do app) pra uma versão Apps Script anterior.
// Útil quando um deploy quebrou algo e queremos voltar SEM mudar a URL.
//
// Uso:
//   npm run rollback -- 73          # volta pra @73
//   npm run rollback -- 73 "msg"    # mesmo, com descrição customizada
//
// O Apps Script preserva todas as versões criadas com `clasp deploy`. Pra ver
// quais existem: `npm run versions`.

const { execSync } = require('child_process');

const STABLE_ID = 'AKfycbzlZFNAYt9r_k1nZExgQkhu8jmWnF769zr_ctKMUhldT-ZtPWMixGLcI3Icq6EgFN0k';

const version = process.argv[2];
const descricao = process.argv[3] || `Rollback pra versão @${version}`;

if (!version || !/^\d+$/.test(version)) {
  console.error('\nUso: npm run rollback -- <numero_da_versao>');
  console.error('Ex:  npm run rollback -- 73');
  console.error('\nPra listar versões disponíveis: npm run versions\n');
  process.exit(1);
}

console.log(`\nApontando o deploy estável pra versão @${version}...`);
console.log(`Descrição: "${descricao}"\n`);

try {
  execSync(
    `npx clasp deploy -i ${STABLE_ID} -V ${version} -d "${descricao}"`,
    { stdio: 'inherit' },
  );
  console.log(`\nRollback concluído. A URL do app agora serve a versão @${version}.`);
  console.log('Se algo desinflar — basta rodar deploy normal pra voltar pra última.\n');
} catch (e) {
  console.error('\nFalha no rollback. Cheque se a versão existe (npm run versions).\n');
  process.exit(1);
}
