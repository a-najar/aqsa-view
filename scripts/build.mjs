// Bundles src/*.js into one inline module so the viewer is a single,
// self-contained HTML file: dist/index.html.
// Usage: node scripts/build.mjs [--fragment out.html]
//   --fragment also writes a copy without <!doctype>/<html>/<head>/<body>.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const order = ['site', 'textures', 'geom', 'timeline', 'buildings', 'main'];
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

let code = `import * as THREE from '${THREE_URL}';\n`;
for (const name of order) {
  const src = readFileSync(join(root, 'src', `${name}.js`), 'utf8')
    .split('\n')
    .filter((l) => !/^import .* from '.*';$/.test(l))
    .map((l) => l.replace(/^export (?=(const|let|function|class|async) )/, ''))
    .join('\n');
  code += `\n// ---- ${name}.js ----\n${src}`;
}
if (/^export /m.test(code)) throw new Error('unhandled export statement');

const html = readFileSync(join(root, 'index.html'), 'utf8')
  .replace('<script type="module" src="./src/main.js"></script>', () => `<script type="module">\n${code}\n</script>`);
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'index.html'), html);
console.log('wrote dist/index.html', (html.length / 1024).toFixed(0) + ' KB');

const i = process.argv.indexOf('--fragment');
if (i > 0) {
  const frag = html
    .replace(/<!doctype html>\s*/i, '')
    .replace(/<html[^>]*>\s*/i, '')
    .replace(/<head>\s*/i, '')
    .replace(/<meta charset="utf-8">\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '')
    .replace(/<\/head>\s*<body>\s*/i, '')
    .replace(/<\/body>\s*<\/html>\s*$/i, '');
  writeFileSync(process.argv[i + 1], frag);
  console.log('wrote', process.argv[i + 1]);
}
