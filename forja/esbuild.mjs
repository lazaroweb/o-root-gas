// Build script for FORJA.
// Produces: dist/App.html (React app, all JS inlined) + dist/Server.js (GAS functions) + dist/appsscript.json
// Uses esbuild-wasm (WebAssembly) instead of the native esbuild binary, because some
// managed/secured macOS machines SIGKILL freshly downloaded native binaries.
import * as esbuild from 'esbuild-wasm';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'fs';

const isDev = process.argv.includes('--dev');

// Lê a versão do package.json e exporta como define pro build —
// disponível em qualquer arquivo TS via __FORJA_VERSION__.
const PACKAGE = JSON.parse(readFileSync('package.json', 'utf8'));
const FORJA_VERSION = PACKAGE.version;

// Embarca as skills do gas-app-kit (../gas-app-kit/skills/<nome>/SKILL.md) no
// bundle, expostas via __GAS_APP_KIT_SKILLS__. Permite o botão "Importar GAS
// App Kit" do Skills Hub semear a biblioteca sem depender de upload manual.
// `fonte` é estável (gas-app-kit/<nome>) pra o import ser idempotente (upsert).
function lerGasAppKitSkills() {
  const base = '../gas-app-kit/skills';
  try {
    return readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => ({ dir: d.name, path: `${base}/${d.name}/SKILL.md` }))
      .filter((s) => existsSync(s.path))
      .map((s) => ({ fonte: `gas-app-kit/${s.dir}`, conteudo: readFileSync(s.path, 'utf8') }));
  } catch {
    return [];
  }
}
const GAS_APP_KIT_SKILLS = lerGasAppKitSkills();

await esbuild.initialize({ worker: false });

mkdirSync('dist', { recursive: true });

// Build React client — all JS goes inline into App.html
const clientResult = await esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  write: false,
  format: 'iife',
  minify: !isDev,
  sourcemap: isDev ? 'inline' : false,
  jsx: 'automatic',
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
    // Versão do app injetada em build-time. Frontend acessa via __FORJA_VERSION__.
    __FORJA_VERSION__: JSON.stringify(FORJA_VERSION),
    // Skills do gas-app-kit embarcadas pra o botão "Importar GAS App Kit".
    __GAS_APP_KIT_SKILLS__: JSON.stringify(GAS_APP_KIT_SKILLS),
  },
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
});

// Build GAS server functions — transpile only (no bundling, no wrapping)
// GAS V8 needs functions at global scope, so we strip TS types and output plain JS
const serverTs = readFileSync('src/server.ts', 'utf8');
const serverResult = await esbuild.transform(serverTs, {
  loader: 'ts',
  target: 'es2020',
});
// Strip any export {} that esbuild might add (GAS doesn't support ESM)
const serverJs = serverResult.code.replace(/^export\s*\{\s*\};?\s*$/gm, '');
writeFileSync('dist/Server.js', serverJs);

// Estratégia anti-corrupção do GAS:
// O Google Apps Script corrompe um <script> inline grande ao servir o HTML (parte o
// conteúdo via document.write em pedaços e corta tokens). A v15 funcionava porque o
// bundle era menor; acima de ~1.28 MB num único <script> a tela fica branca.
// Solução: fatiar o JS em N <script> pequenos (~200 KB cada). Cada script adiciona
// sua fatia (como string JSON segura) a uma variável global e o último faz eval().
// Cada bloco fica MUITO abaixo do limite que dispara a corrupção, então a entrega
// chega íntegra, e o eval() executa o bundle reconstituído.
const js = clientResult.outputFiles[0].text;
const CHUNK_SIZE = 200000;
const jsChunks = [];
for (let i = 0; i < js.length; i += CHUNK_SIZE) {
  jsChunks.push(js.slice(i, i + CHUNK_SIZE));
}
const scriptBlocks = [
  '<script>window.__forjaJs = "";</script>',
  ...jsChunks.map((p) => '<script>window.__forjaJs += ' + JSON.stringify(p) + ';</script>'),
  '<script>(function(){var c=window.__forjaJs;window.__forjaJs=void 0;try{(0,eval)(c);}catch(e){var r=document.getElementById("root");if(r)r.innerHTML="<div style=\\"padding:32px;font-family:Inter,sans-serif;color:#8a1f1f\\"><h3>Erro ao iniciar o app</h3><pre style=\\"white-space:pre-wrap;font-size:12px\\">"+(e&&(e.stack||e.message)||e)+"</pre></div>";}})();</script>',
].join('\n    ');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FORJA</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        background: #FAF8F5;
        color: #2A2724;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      #root { min-height: 100vh; }
      ::-webkit-scrollbar { width: 10px; height: 10px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(140,130,120,0.28); border-radius: 8px; border: 2px solid transparent; background-clip: padding-box; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(140,130,120,0.45); background-clip: padding-box; }
      /* Scroll horizontal sem barra visível (navegação em pílulas que não cabe na largura) */
      .forja-scroll-x { overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; }
      .forja-scroll-x::-webkit-scrollbar { height: 0; width: 0; display: none; }
      .forja-scroll-y { scrollbar-width: thin; scrollbar-color: rgba(140,130,120,0.32) transparent; }
      .forja-scroll-y::-webkit-scrollbar { width: 6px; }
      .forja-scroll-y::-webkit-scrollbar-thumb { background: rgba(140,130,120,0.3); border-radius: 8px; border: none; }
      .forja-scroll-y::-webkit-scrollbar-thumb:hover { background: rgba(140,130,120,0.5); }
      @keyframes brasaPulse {
        0%, 100% { transform: scale(1); opacity: 0.45; }
        50% { transform: scale(1.7); opacity: 0.12; }
      }
      @keyframes brasaBreath {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.14); }
      }
      @keyframes forjaFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes forjaPop {
        0% { opacity: 0; transform: scale(0.96); }
        100% { opacity: 1; transform: scale(1); }
      }
      /* Lume — painel flutuante surge da fagulha (canto inferior direito). */
      @keyframes forjaLumeIn {
        0% { opacity: 0; transform: translateY(16px) scale(0.94); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes forjaLumeGlow {
        0%, 100% { opacity: 0.5; }
        50% { opacity: 0.9; }
      }
      .forja-lume-panel { animation: forjaLumeIn 0.26s cubic-bezier(0.16, 1, 0.3, 1); transform-origin: bottom right; }
      .forja-lume-fab { animation: forjaPop 0.3s ease; }
      @media (max-width: 768px) {
        .forja-lume-panel {
          right: 10px !important; left: 10px !important; bottom: 10px !important;
          width: auto !important; height: 78vh !important; max-height: 78vh !important;
        }
      }
      @keyframes forjaShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      @keyframes forjaReveal {
        from { clip-path: inset(0 100% 0 0); }
        to { clip-path: inset(0 0 0 0); }
      }
      @keyframes forjaPulseRing {
        0% { transform: scale(0.6); opacity: 0.65; }
        100% { transform: scale(2.4); opacity: 0; }
      }
      @keyframes forjaRise {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes forjaSpin { to { transform: rotate(360deg); } }
      /* ─── Landing: a forja ──────────────────────────────────────────────
         Fagulhas que sobem da brasa (faíscas do metal sendo malhado) +
         a brasa que respira (calor pulsante). */
      @keyframes forjaSpark {
        0%   { transform: translate(0, 0) scale(1); opacity: 0; }
        12%  { opacity: 1; }
        70%  { opacity: 0.9; }
        100% { transform: translate(var(--drift, 0), -220px) scale(0.2); opacity: 0; }
      }
      @keyframes forjaEmberBreath {
        0%, 100% { transform: scale(1);    opacity: 0.92; }
        50%      { transform: scale(1.12); opacity: 1; }
      }
      /* Fagulha em escala compacta — pra brasa viva dentro do app (sidebar). */
      @keyframes forjaSparkMini {
        0%   { transform: translate(0, 0) scale(1); opacity: 0; }
        18%  { opacity: 1; }
        100% { transform: translate(var(--drift, 0), -28px) scale(0.2); opacity: 0; }
      }
      @keyframes forjaEmberGlow {
        0%, 100% { opacity: 0.55; transform: scale(1); }
        50%      { opacity: 0.9;  transform: scale(1.18); }
      }
      @keyframes forjaWordIn {
        from { opacity: 0; transform: translateY(14px); letter-spacing: 0.5em; filter: blur(4px); }
        to   { opacity: 1; transform: translateY(0);    letter-spacing: 0.26em; filter: blur(0); }
      }
      @keyframes forjaSloganIn {
        0%   { opacity: 0; transform: translateY(10px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      /* Pulso sutil pro farol verde do ModeloBadge — sinaliza "vivo" sem ser intrusivo */
      @keyframes forjaFaroleVerde {
        0%, 100% { box-shadow: 0 0 0 0 rgba(60, 179, 113, 0.45); }
        50%      { box-shadow: 0 0 0 4px rgba(60, 179, 113, 0); }
      }
      .forja-spin { animation: forjaSpin 0.9s linear infinite; transform-origin: center; }
      /* Pulse sutil pra chamar atencao em pilulas de backlog com prio alta */
      @keyframes forjaPulseGlow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(232, 85, 85, 0.0); }
        50%      { box-shadow: 0 0 0 4px rgba(232, 85, 85, 0.18); }
      }
      .forja-pulse { animation: forjaPulseGlow 1.8s ease-in-out infinite; }
      /* Pulse "brasa" pra chamar atencao no botao de auditar mudancas detectadas */
      @keyframes forjaPulseAuditar {
        0%, 100% { box-shadow: 0 0 0 0 rgba(217, 155, 115, 0.0); }
        50%      { box-shadow: 0 0 0 6px rgba(217, 155, 115, 0.30); }
      }
      .forja-pulse-audit { animation: forjaPulseAuditar 1.6s ease-in-out infinite; }
      /* Pulso neutro pra bolinha de status "verificando" do monitoramento */
      @keyframes forjaPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.45; transform: scale(0.85); }
      }
      /* ─── Premium ambient (Dashboard) ──────────────────────────────────────
         Aurora: manchas de cor da paleta, muito borradas, derivando devagar —
         dá profundidade e "vida" sem poluir. Lift: cards sobem de leve no hover. */
      @keyframes forjaAurora {
        0%   { transform: translate3d(0,0,0) scale(1); }
        33%  { transform: translate3d(7%, -6%, 0) scale(1.18); }
        66%  { transform: translate3d(-5%, 5%, 0) scale(1.06); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      @keyframes forjaAurora2 {
        0%   { transform: translate3d(0,0,0) scale(1.1); }
        50%  { transform: translate3d(-9%, 7%, 0) scale(1); }
        100% { transform: translate3d(0,0,0) scale(1.1); }
      }
      @keyframes forjaAurora3 {
        0%   { transform: translate3d(0,0,0) scale(1); }
        50%  { transform: translate3d(6%, 8%, 0) scale(1.16); }
        100% { transform: translate3d(0,0,0) scale(1); }
      }
      .forja-aurora { position: absolute; border-radius: 50%; filter: blur(100px); pointer-events: none; will-change: transform; }
      /* Dither: ruído finíssimo que quebra o banding do degradê (os "degraus"
         de cor em fundo escuro) e deixa a transição imperceptível. Mesmo truque
         de Stripe/Apple. Quase invisível — só "amacia" o gradiente. */
      .forja-grain {
        position: absolute; inset: 0; pointer-events: none;
        opacity: 0.08;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        background-size: 140px 140px;
      }
      .forja-lift { transition: transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease, border-color 0.3s ease; will-change: transform; }
      .forja-lift:hover { transform: translateY(-4px); }
      @media (prefers-reduced-motion: reduce) {
        .forja-aurora { animation: none !important; }
        .forja-lift { transition: none; }
        .forja-lift:hover { transform: none; }
      }
      /* Acoes do card Kanban so aparecem on hover (limpa visualmente o backlog) */
      .forja-kanban-card .forja-card-actions { opacity: 0; transition: opacity 0.18s ease; pointer-events: none; }
      .forja-kanban-card:hover .forja-card-actions { opacity: 1; pointer-events: auto; }
      /* microinteracoes */
      .ant-btn { transition: transform 0.12s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease !important; }
      .ant-btn:not(.ant-btn-text):not(:disabled):hover { transform: translateY(-1px); }
      .ant-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
      .ant-card, .ant-table-row { transition: box-shadow 0.2s ease, transform 0.2s ease, background 0.18s ease; }
      .ant-tabs-tab { transition: color 0.18s ease; }
      .ant-modal-content { animation: forjaPop 0.18s ease; }
      a, button, .ant-btn, [role="button"] { -webkit-tap-highlight-color: transparent; }
      /* mobile (<=768px): paddings, modais e drawers ocupam a tela */
      @media (max-width: 768px) {
        .forja-view { padding: 18px 14px !important; }
        .forja-view-narrow { padding: 14px 12px !important; }
        .ant-modal { max-width: calc(100vw - 16px) !important; margin: 8px auto !important; }
        .ant-modal-content { padding: 18px 16px !important; }
        .ant-drawer-content-wrapper { max-width: 100vw !important; }
        .ant-tabs-tab { padding: 8px 10px !important; }
        .ant-page-header-heading-title { font-size: 20px !important; }
        .ant-table { font-size: 12.5px !important; }
        .ant-table-cell { padding: 8px !important; }
        .ant-segmented-item-label { padding: 0 10px !important; }

        /* ─── Responsividade dos grids internos ────────────────────────────
           Quase todas as telas usam CSS grid com colunas fracionárias fixas
           (1fr 1fr, 2fr 1fr, etc.) ou colunas-pixel (master-detail). No
           celular isso espreme tudo. Aqui colapsamos pra uma coluna só.
           Grids com repeat(auto-fit/auto-fill, minmax(...)) já requebram
           sozinhos e NÃO casam com estes seletores (o valor tem vírgula). */
        [style*="1fr 1fr"],
        [style*="2fr 1fr"],
        [style*="1fr 2fr"],
        [style*="1.3fr 1fr"],
        [style*="1.4fr 1fr"],
        [style*="1.6fr 1fr"],
        [style*="1fr 1.4fr"],
        [style*="260px 1fr"] {
          grid-template-columns: 1fr !important;
        }

        /* SubNav / Atelier: a coluna lateral sticky vira uma faixa horizontal
           rolável no topo (pílulas), e o conteúdo ocupa a largura toda. */
        .forja-subnav-grid {
          grid-template-columns: 1fr !important;
          gap: 14px !important;
        }
        .forja-subnav-grid > nav,
        .forja-subnav-grid > div > nav {
          flex-direction: row !important;
          position: static !important;
          overflow-x: auto;
          gap: 6px !important;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }
        /* moldura do Atelier (wrapper do nav) vira faixa simples no mobile */
        .forja-subnav-grid > div:has(> nav) { align-self: start !important; }
        .forja-atelier-mark { display: none !important; }
        .forja-subnav-grid > nav::-webkit-scrollbar,
        .forja-subnav-grid > div > nav::-webkit-scrollbar { height: 0; width: 0; display: none; }
        .forja-subnav-grid > nav > button,
        .forja-subnav-grid > div > nav > button { flex: 0 0 auto !important; white-space: nowrap; }

        /* Tabelas largas rolam na horizontal em vez de espremer colunas. */
        .ant-table-wrapper .ant-table-content { overflow-x: auto; }

        /* PageHeader: ações descem pra baixo do título e quebram se preciso. */
        .forja-pageheader-extra { flex-wrap: wrap !important; }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <!-- svg-pan-zoom: ~30KB. Habilita zoom/pan no diagrama (vibe Miro). -->
    <script src="https://cdn.jsdelivr.net/npm/svg-pan-zoom@3.6.1/dist/svg-pan-zoom.min.js"></script>
    ${scriptBlocks}
  </body>
</html>`;

writeFileSync('dist/App.html', html);
if (existsSync('dist/ClientJs.html')) rmSync('dist/ClientJs.html');

if (existsSync('appsscript.json')) {
  writeFileSync('dist/appsscript.json', readFileSync('appsscript.json', 'utf8'));
}

console.log(`Build complete — App.html: ${Math.round(html.length / 1024)}KB (JS em ${jsChunks.length} fatias de <=${Math.round(CHUNK_SIZE/1024)}KB)`);
