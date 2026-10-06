// Builds portable/english-review.html: the whole app in a single file that opens with a double click,
// with no server and nothing to install. Usage: npm run build:portable
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const read = (href) => readFileSync(join(dist, href.replace(/^\.?\//, '')), 'utf8');

// Replacement functions stop any "$" in the code from being read as a replacement pattern
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/, (_, href) => `<style>${read(href)}</style>`);
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/, (_, src) =>
  `<script type="module">${read(src).replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(/\s*<link rel="manifest"[^>]*>/, () => '');
const icon = Buffer.from(read('icon.svg')).toString('base64');
html = html.replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" href="data:image/svg+xml;base64,${icon}" />`);

if (/(src|href)="\.\/assets\//.test(html)) throw new Error('Some resources were not inlined into the HTML.');

mkdirSync(join(root, 'portable'), { recursive: true });
const out = join(root, 'portable', 'english-review.html');
writeFileSync(out, html);
console.log(`✓ ${out} (${Math.round(html.length / 1024)} kB)`);
