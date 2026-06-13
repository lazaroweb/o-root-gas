// Build script for FORJA.
// Produces: dist/App.html (React app, all JS inlined) + dist/Server.js (GAS functions) + dist/appsscript.json
import { build, transformSync } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const isDev = process.argv.includes('--dev');

mkdirSync('dist', { recursive: true });

// Build React client — all JS goes inline into App.html
const clientResult = await build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  write: false,
  format: 'iife',
  minify: !isDev,
  sourcemap: isDev ? 'inline' : false,
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
});

// Build GAS server functions — transpile only (no bundling, no wrapping)
// GAS V8 needs functions at global scope, so we strip TS types and output plain JS
const serverTs = readFileSync('src/server.ts', 'utf8');
const serverResult = transformSync(serverTs, {
  loader: 'ts',
  target: 'es2020',
});
// Strip any export {} that esbuild might add (GAS doesn't support ESM)
const serverJs = serverResult.code.replace(/^export\s*\{\s*\};?\s*$/gm, '');
writeFileSync('dist/Server.js', serverJs);

// Embed JS into a single HTML file (GAS requires this)
const js = clientResult.outputFiles[0].text;
const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FORJA</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0F1114; color: #E8E8ED; }
      #root { min-height: 100vh; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>${js}</script>
  </body>
</html>`;

writeFileSync('dist/App.html', html);

// Copy appsscript.json to dist
if (existsSync('appsscript.json')) {
  writeFileSync('dist/appsscript.json', readFileSync('appsscript.json', 'utf8'));
}

const sizeKb = Math.round(html.length / 1024);
console.log(`Build complete — App.html: ${sizeKb}KB${sizeKb > 1331 ? ' ⚠️  WARNING: near 1.5MB GAS limit' : ''}`);
