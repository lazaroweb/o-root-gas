// Build do formulário público da Forja.
// Gera: dist/FormApp.html (React inline) + dist/Server.js + dist/appsscript.json
import * as esbuild from 'esbuild-wasm';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const isDev = process.argv.includes('--dev');

await esbuild.initialize({ worker: false });
mkdirSync('dist', { recursive: true });

const clientResult = await esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  write: false,
  format: 'iife',
  minify: !isDev,
  sourcemap: isDev ? 'inline' : false,
  jsx: 'automatic',
  legalComments: 'none',
  define: { 'process.env.NODE_ENV': isDev ? '"development"' : '"production"' },
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
});

const serverTs = readFileSync('src/server.ts', 'utf8');
const serverResult = await esbuild.transform(serverTs, { loader: 'ts', target: 'es2020' });

// Libs injetadas no topo do Server.js (GAS não tem ESM). O guard de existência
// falha o build com mensagem clara — sem ele, um caminho quebrado viraria
// 'scoreOportunidadeCore is not defined' só em runtime (o declare function do
// server.ts engana o TypeScript).
//   • ../forja/src/lib/schema.ts — COMPARTILHADA: colunas das abas Discovery/
//     Pessoas da planilha comum (fim do "mantenha em sincronia" manual).
//   • ../forja/src/lib/score.ts — COMPARTILHADA com o app principal (fonte
//     única do score). Dependência cross-project intencional: ver README.md.
//   • src/lib/guards.ts — guards do form público (throttle/token), testados.
async function libJs(caminho) {
  if (!existsSync(caminho)) {
    console.error(`ERRO: lib obrigatória não encontrada: ${caminho}\n` +
      'O Server.js depende dela em runtime (declare function no server.ts). ' +
      'Se o repo foi reorganizado, atualize os caminhos no esbuild.mjs.');
    process.exit(1);
  }
  const ts = readFileSync(caminho, 'utf8').replace(/^export\s+/gm, '');
  const r = await esbuild.transform(ts, { loader: 'ts', target: 'es2020' });
  return `// ── lib injetada: ${caminho} ──\n` + r.code.replace(/^export\s*\{\s*\};?\s*$/gm, '');
}
const serverJs = (await libJs('../forja/src/lib/schema.ts'))
  + '\n' + (await libJs('../forja/src/lib/score.ts'))
  + '\n' + (await libJs('src/lib/guards.ts'))
  + '\n' + serverResult.code.replace(/^export\s*\{\s*\};?\s*$/gm, '');
writeFileSync('dist/Server.js', serverJs);

// Fatiamento anti-corrupção do GAS (mesmo truque do app principal).
const js = clientResult.outputFiles[0].text;
const CHUNK = 180000;
const chunks = [];
for (let i = 0; i < js.length; i += CHUNK) chunks.push(js.slice(i, i + CHUNK));
const scriptBlocks = [
  '<script>window.__token=window.__token||{};window.__FORM_TOKEN__="%%FORM_TOKEN%%";window.__pubJs="";</script>',
  ...chunks.map((p) => '<script>window.__pubJs += ' + JSON.stringify(p) + ';</script>'),
  '<script>(function(){var c=window.__pubJs;window.__pubJs=void 0;try{(0,eval)(c);}catch(e){var r=document.getElementById("root");if(r)r.innerHTML="<div style=\\"padding:32px;font-family:sans-serif;color:#8a1f1f\\">Erro ao iniciar.</div>";}})();</script>',
].join('\n    ');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Discovery</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: radial-gradient(1200px 600px at 50% -10%, #FFF6EE 0%, #FAF8F5 55%);
        color: #2A2724; -webkit-font-smoothing: antialiased;
      }
      #root { min-height: 100vh; }
      input:focus, textarea:focus { border-color: #D99B73 !important; box-shadow: 0 0 0 3px rgba(217,155,115,0.15); }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes drift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(6%,4%) scale(1.15); } }
      @keyframes drift2 { 0%,100% { transform: translate(0,0) scale(1.1); } 50% { transform: translate(-7%,5%) scale(1); } }
      .aura { position: absolute; border-radius: 50%; filter: blur(90px); pointer-events: none; opacity: 0.5; }
      .aura-1 { width: 380px; height: 380px; background: #F3D9C4; top: -80px; left: -60px; animation: drift1 18s ease-in-out infinite; }
      .aura-2 { width: 340px; height: 340px; background: #DDEAE0; bottom: -90px; right: -60px; animation: drift2 22s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .aura { animation: none; } }
    </style>
  </head>
  <body>
    <div id="root"></div>
    ${scriptBlocks}
  </body>
</html>`;

writeFileSync('dist/FormApp.html', html);
if (existsSync('appsscript.json')) writeFileSync('dist/appsscript.json', readFileSync('appsscript.json', 'utf8'));

console.log(`Build OK — FormApp.html: ${Math.round(html.length / 1024)}KB (${chunks.length} fatias)`);
