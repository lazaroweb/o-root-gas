#!/usr/bin/env node
// ─── npm run deploy ─────────────────────────────────────────────────────────
// Build + push + deploy do Forja com descrição automática padronizada.
//
// A descrição vai pro painel "Gerenciar implantações" do Apps Script, então
// quando precisar ver/rollback dá pra identificar cada versão. Antes o
// script chamava `clasp deploy` sem `-d` e tudo ficava como "Sem título".
//
// Formato da descrição:
//   v1.6.7 — Mindmap interativo (física tipo Obsidian)
//
// Pega:
//   • Versão: do package.json
//   • Título: do primeiro item "**...**" da seção mais recente do CHANGELOG.md
//
// Se CHANGELOG não tiver entry pra essa versão, usa fallback "Forja vX.Y.Z".

const { execSync, spawnSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

const STABLE_ID = 'AKfycbzlZFNAYt9r_k1nZExgQkhu8jmWnF769zr_ctKMUhldT-ZtPWMixGLcI3Icq6EgFN0k';

const raiz = path.join(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const version = pkg.version;

function extrairTitulo(versao) {
  try {
    const cl = readFileSync(path.join(raiz, 'CHANGELOG.md'), 'utf8');
    // Pega o bloco da versão. Sem flag 'm' pra `$` casar com fim-da-string,
    // não fim-de-linha. Lookahead `(?=\n## \[)` casa com próxima versão.
    const re = new RegExp(`## \\[${versao.replace(/\./g, '\\.')}\\][\\s\\S]*?(?=\\n## \\[|$)`);
    const bloco = cl.match(re)?.[0] || '';
    // Procura o primeiro item de bullet com **negrito**
    const linhas = bloco.split('\n');
    for (const linha of linhas) {
      const m = linha.match(/^\s*[-*]\s+\*\*([^*]+)\*\*/);
      if (m) {
        return m[1].trim().replace(/\s+/g, ' ');
      }
    }
  } catch { /* ignora */ }
  return null;
}

const titulo = extrairTitulo(version);
// Limpa caracteres ruins: backticks (substitution shell), aspas (precisam escape),
// quebras de linha. Trunca em 120 chars (limite razoável pra painel).
function limpar(s) {
  return s.replace(/`/g, "'").replace(/\s+/g, ' ').trim().slice(0, 120);
}
const descricao = titulo
  ? limpar(`v${version} — ${titulo}`)
  : `Forja v${version}`;

console.log('');
console.log(`Build + Deploy — Forja v${version}`);
console.log(`Descrição: "${descricao}"`);
console.log('');

function rodar(cmd, args) {
  // spawnSync com array de args NÃO passa pelo shell — então backticks,
  // aspas e $ não são interpretados. É a forma correta de passar strings
  // que contém caracteres ambíguos pra processos filhos.
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: raiz, shell: false });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} → exit ${r.status}`);
}

try {
  console.log('• Build (esbuild)...');
  execSync('node esbuild.mjs', { stdio: 'inherit', cwd: raiz });

  console.log('• Push (clasp)...');
  // clasp resolve via npx — no Windows precisa de `npx.cmd`, mas como tamos
  // só rodando em macOS/Linux dá pra usar 'npx' direto.
  rodar('npx', ['clasp', 'push', '--force']);

  console.log('• Deploy (clasp)...');
  rodar('npx', ['clasp', 'deploy', '-i', STABLE_ID, '-d', descricao]);

  console.log('');
  console.log(`Deploy concluído. A URL do app continua a mesma; conteúdo agora é v${version}.`);
  console.log('Pra ver todas as versões: npm run versions');
  console.log('Pra rollback: npm run rollback -- <numero>');
  console.log('');
} catch (e) {
  console.error('');
  console.error('Falhou o deploy. Cheque os erros acima.');
  console.error(e.message || '');
  console.error('');
  process.exit(1);
}
