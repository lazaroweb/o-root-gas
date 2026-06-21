#!/usr/bin/env node
// Build + push do formulário público. O PRIMEIRO deploy (com acesso "Qualquer
// pessoa") deve ser feito pelo painel do Apps Script (veja README.md) — o clasp
// não configura acesso anônimo. Depois disso, este script só atualiza o código.
const { execSync, spawnSync } = require('child_process');
const path = require('path');
const raiz = path.join(__dirname, '..');

function rodar(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: raiz, shell: false });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} → exit ${r.status}`);
}

try {
  console.log('• Build (esbuild)...');
  execSync('node esbuild.mjs', { stdio: 'inherit', cwd: raiz });
  console.log('• Push (clasp)...');
  rodar('npx', ['clasp', 'push', '--force']);
  console.log('');
  console.log('Push concluído. Se for o 1º deploy, crie a implantação como');
  console.log('"Qualquer pessoa" no painel do Apps Script (veja README.md).');
  console.log('Senão, gerencie a implantação existente (Nova versão).');
} catch (e) {
  console.error('Falhou:', e.message || e);
  process.exit(1);
}
