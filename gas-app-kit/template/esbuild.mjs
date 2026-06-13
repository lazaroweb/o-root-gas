// Build script for GAS App Kit.
// Produces: dist/App.html (React app, all JS inlined) + dist/Server.js (GAS functions) + dist/appsscript.json
import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const isDev = process.argv.includes('--dev');

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
  define: {
    'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
  },
  loader: { '.tsx': 'tsx', '.ts': 'ts' },
});

// Build GAS server functions
await esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  outfile: 'dist/Server.js',
  format: 'cjs',
  platform: 'node',
  minify: !isDev,
});

// Embed JS into a single HTML file (GAS requires this)
const js = clientResult.outputFiles[0].text;
const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
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
console.log(`Build complete — App.html: ${sizeKb}KB${sizeKb > 1331 ? ' (WARNING: near 1.5MB GAS limit)' : ''}`);
