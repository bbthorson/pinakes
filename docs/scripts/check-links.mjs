// Fails the build when a page links to a route or anchor that dist/ lacks.
// Links copied from VitePress as `record-types.md` built fine and 404'd once
// deployed, because Starlight does not rewrite .md links; nothing noticed.
import fs from 'node:fs';
import path from 'node:path';

const BASE = '/pinakes/';
const dist = path.resolve(import.meta.dirname, '../dist');
const pages = fs.readdirSync(dist, { recursive: true }).filter((f) => f.endsWith('.html'));

const ids = new Map();
function idsOf(file) {
  if (!ids.has(file)) {
    const html = fs.readFileSync(file, 'utf8');
    ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  return ids.get(file);
}

const broken = [];
for (const page of pages) {
  const file = path.join(dist, page);
  const html = fs.readFileSync(file, 'utf8');
  const pageUrl = new URL(BASE + page.replace(/(^|\/)index\.html$/, '$1'), 'https://site');
  for (const [, href] of html.matchAll(/\shref="([^"]*)"/g)) {
    const url = new URL(href.replaceAll('&amp;', '&'), pageUrl);
    if (url.origin !== 'https://site') continue;
    if (!url.pathname.startsWith(BASE)) { broken.push(`${page}: ${href} (outside ${BASE})`); continue; }
    const rel = decodeURIComponent(url.pathname.slice(BASE.length));
    const target = [rel, path.join(rel, 'index.html')]
      .map((p) => path.join(dist, p))
      .find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!target) { broken.push(`${page}: ${href} (no such file)`); continue; }
    const hash = decodeURIComponent(url.hash.slice(1));
    if (hash && target.endsWith('.html') && !idsOf(target).has(hash)) {
      broken.push(`${page}: ${href} (no #${hash})`);
    }
  }
}

if (broken.length) {
  console.error(`check-links: ${broken.length} broken internal link(s):\n  ${broken.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-links: ${pages.length} pages, no broken internal links`);
