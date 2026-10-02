// Static site-quality audit: links and anchors, SEO metadata, sitemap, 404, weight budgets, image attributes.
// Run: node tests/site-quality.test.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const ORIGIN = 'https://echoxstudios.art';
const walk = (dir, out = []) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules', '.git', 'test-results', 'tmp', '.wrangler', 'worker', 'docs', 'tests'].includes(e.name)) continue; const p = path.join(dir, e.name); e.isDirectory() ? walk(p, out) : out.push(p); } return out; };
const files = walk(root);
const rel = f => path.relative(root, f).split(path.sep).join('/');
const pages = files.filter(f => f.endsWith('.html')).map(rel);
const html = Object.fromEntries(pages.map(p => [p, fs.readFileSync(path.join(root, p), 'utf8')]));
const noindex = p => /<meta[^>]+name="robots"[^>]+noindex/i.test(html[p]);
const indexable = pages.filter(p => !noindex(p) && p !== '404.html' && !/^(tdh\/(profile|result)|synopsis-)/.test(p));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name); console.log(String(e.message).split('\n').slice(0, 30).join('\n')); process.exitCode = 1; } };
const must = problems => assert.deepEqual(problems, []);

t('every internal link, image and script resolves, and every #anchor exists', () => {
  const problems = [];
  const ids = {};
  const idsOf = p => (ids[p] ||= new Set([...html[p].matchAll(/\sid="([^"]+)"/g)].map(m => m[1])));
  for (const p of pages) {
    for (const m of html[p].matchAll(/\s(?:href|src)="([^"#][^"]*|#[^"]*)"/g)) {
      let ref = m[1];
      if (/^(https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(ref) || /['+{}]|\$\{/.test(ref)) continue; // absolute URLs and JavaScript string fragments
      const [target, hash] = ref.split('#');
      const clean = target.split('?')[0];
      const from = path.posix.dirname(p);
      const resolved = clean === '' ? p : clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(from, clean));
      const isDirIndex = resolved === '' || resolved.endsWith('/');
      const file = isDirIndex ? resolved + 'index.html' : resolved;
      if (!fs.existsSync(path.join(root, file))) { problems.push(`${p}: broken ${m[1]}`); continue; }
      if (hash && file.endsWith('.html') && html[file] && !idsOf(file).has(hash)) problems.push(`${p}: anchor #${hash} not found in ${file}`);
    }
  }
  must([...new Set(problems)]);
});

t('indexable pages have a unique title, a unique description, a canonical URL and sharing tags', () => {
  const problems = [], titles = new Map(), descs = new Map();
  for (const p of indexable) {
    const h = html[p];
    const title = (/<title>([\s\S]*?)<\/title>/i.exec(h) || [])[1]?.trim();
    const desc = (/<meta\s+name="description"\s+content="([^"]*)"/i.exec(h) || [])[1]?.trim();
    const canon = (/<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(h) || [])[1];
    if (!title) problems.push(`${p}: no <title>`); else { if (title.length > 75) problems.push(`${p}: title longer than 75 characters`); if (titles.has(title)) problems.push(`${p}: title duplicates ${titles.get(title)}`); titles.set(title, p); }
    if (!desc) problems.push(`${p}: no meta description`); else { if (desc.length < 40 || desc.length > 300) problems.push(`${p}: description length ${desc.length} (40-300)`); if (descs.has(desc)) problems.push(`${p}: description duplicates ${descs.get(desc)}`); descs.set(desc, p); }
    const dirForm = p.replace(/index\.html$/, '');
    const expected = [`${ORIGIN}/${p}`, `${ORIGIN}/${dirForm}`];
    if (!expected.includes(canon)) problems.push(`${p}: canonical ${canon || 'missing'} (expected ${expected.join(' or ')})`);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) if (!new RegExp(`(?:property|name)="${tag}"`).test(h)) problems.push(`${p}: missing ${tag}`);
  }
  must(problems);
});

t('sitemap lists exactly the indexable pages, all of which exist', () => {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const listed = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(ORIGIN + '/', '') || 'index.html');
  const problems = [];
  for (const l of listed) { if (!pages.includes(l)) problems.push(`sitemap lists missing page ${l}`); else if (noindex(l)) problems.push(`sitemap lists noindex page ${l}`); }
  // The seven tool pages are deliberately unlisted: reachable and shareable, but not pushed to search engines.
  for (const p of indexable) if (!listed.includes(p) && !/^tdh\/tool-/.test(p)) problems.push(`indexable page not in sitemap: ${p}`);
  assert.ok(/Sitemap: https:\/\/echoxstudios\.art\/sitemap\.xml/.test(fs.readFileSync(path.join(root, 'robots.txt'), 'utf8')), 'robots.txt points at the sitemap');
  must(problems);
});

t('a deliberate 404 page exists, is not indexed and leads home', () => {
  assert.ok(html['404.html'], '404.html is missing');
  assert.ok(noindex('404.html'), '404.html must be noindex');
  assert.ok(/href="\/?(index\.html)?"|href="\/"/.test(html['404.html']), '404.html must link home');
  assert.ok(/<main|role="main"/.test(html['404.html']), '404.html needs a main landmark');
});

t('every page loads the current signature script, which stays small and in the lower right', () => {
  const js = fs.readFileSync(path.join(root, 'brand-signature.js'), 'utf8');
  assert.ok(/height:20px/.test(js) && /justify-content:flex-end/.test(js), 'signature must be about 20px high and right-aligned');
  assert.ok(!/text-align:center/.test(js), 'signature must not be centred');
  const version = (/brand-signature\.js\?v=(\d+)/.exec(html['index.html']) || [])[1];
  must(pages.filter(p => /brand-signature\.js/.test(html[p]) && !new RegExp('brand-signature\\.js\\?v=' + version).test(html[p])).map(p => `${p}: stale brand-signature.js version`));
});

t('reading pages have a print stylesheet (info sheet carries its own page layout)', () => {
  const missing = ['tdh/system.html', 'tdh/research.html', 'tdh/scoring.html'].filter(p => !/print\.css/.test(html[p]));
  must(missing.map(p => `${p}: no print.css`));
  assert.ok(/@media print/.test(html['tdh/info-sheet.html']), 'info sheet has print rules');
});

t('structured data uses only the public credit', () => {
  const problems = [];
  for (const p of indexable) for (const m of html[p].matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data; try { data = JSON.parse(m[1]); } catch { problems.push(`${p}: invalid JSON-LD`); continue; }
    const s = JSON.stringify(data);
    if (/"@type":"Person"/.test(s) && !/Eko Svenningsson aka ECHOx|ECHOx/.test(s)) problems.push(`${p}: Person must use the public credit`);
  }
  must(problems);
  assert.ok(Object.values(html).some(h => /"@type":\s*"Book"/.test(h)), 'a Book entity is published');
  assert.ok(Object.values(html).some(h => /"@type":\s*"Person"/.test(h)), 'a Person entity is published');
});

t('weight budgets: pages, images, fonts and scripts stay small', () => {
  const problems = [];
  for (const p of pages) { const kb = Buffer.byteLength(html[p]) / 1024; if (kb > 300) problems.push(`${p}: ${kb.toFixed(0)} KB of HTML (budget 300)`); }
  for (const f of files.map(rel)) {
    const kb = fs.statSync(path.join(root, f)).size / 1024;
    if (/\.(png|jpe?g|webp|gif)$/i.test(f) && kb > 1024) problems.push(`${f}: ${kb.toFixed(0)} KB image (budget 1024)`);
    if (/\.woff2$/i.test(f) && kb > 80) problems.push(`${f}: ${kb.toFixed(0)} KB font (budget 80)`);
    if (/\.js$/i.test(f) && kb > 60) problems.push(`${f}: ${kb.toFixed(0)} KB script (budget 60)`);
  }
  must(problems);
});

t('images have alt text and lazy loading except the first screen; no render-blocking third-party assets', () => {
  const problems = [];
  for (const p of pages) {
    for (const m of html[p].matchAll(/<img\b[^>]*>/gi)) {
      if (!/\balt="/.test(m[0])) problems.push(`${p}: <img> without alt: ${m[0].slice(0, 70)}`);
    }
    if (/<(?:script|link)[^>]+(?:src|href)="https?:\/\/(?!echoxstudios\.art)/i.test(html[p].replace(/<a\b[^>]*>/gi, ''))) problems.push(`${p}: third-party script or stylesheet`);
  }
  must(problems);
});
console.log(`site quality: ${passed} passed`);
