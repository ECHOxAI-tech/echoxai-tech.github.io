// Visual regression: every page at 375, 768 and 1280 px is captured, reduced to a 32x18 luminance fingerprint and
// compared with tests/visual-baselines.json. A page fails when its picture drifts beyond the tolerance; the current
// screenshot is then saved to test-results/visual/ for inspection.  Accept a deliberate change with:
//   UPDATE_VISUAL=1 node tests/visual.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, CHROME, root } from './lib/browser.mjs';
if (!CHROME) { console.log('visual test skipped: Chrome not found'); process.exit(0); }

const BASE = path.join(root, 'tests', 'visual-baselines.json');
const update = !!process.env.UPDATE_VISUAL;
const baselines = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};
const pages = [...fs.readdirSync(root).filter(f => f.endsWith('.html')), ...fs.readdirSync(path.join(root, 'tdh')).filter(f => f.endsWith('.html')).map(f => 'tdh/' + f)]
  .filter(f => !/dramatic-work-withheld/.test(f)).sort();
const WIDTHS = [375, 768, 1280];
const MEAN_TOL = 5, CELL_DIFF = 60, CELLS_TOL = 14; // justified, hyphenated text can shift a few lines between runs; // mean luminance drift, and how many of the 576 cells may differ strongly (0-255 scale)

const FINGERPRINT = `(async (b64) => {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const W = 32, H = 18, c = new OffscreenCanvas(W, H), g = c.getContext('2d');
  g.drawImage(bmp, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data, out = [];
  for (let i = 0; i < d.length; i += 4) out.push(Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]));
  return out.map(v => v.toString(16).padStart(2, '0')).join('');
})`;
const hex2arr = h => h.match(/../g).map(x => parseInt(x, 16));

const b = await launch();
const c = await b.context();
const probe = await c.page('about:blank'.replace('about:blank', 'index.html'));
const failures = [], fresh = [], current = {};
fs.mkdirSync(path.join(root, 'test-results', 'visual'), { recursive: true });
let n = 0;
for (const width of WIDTHS) {
  for (const pg of pages) {
    const p = await c.page(null, { width, height: 800 });
    await p.goto(pg);
    await p.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await p.evaluate(`(() => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'; document.head.appendChild(s); })()`);
    try { await p.evaluate(`document.fonts.ready.then(() => true)`); } catch {}
    try { await p.evaluate(`Promise.race([Promise.all([...document.images].filter(i => i.loading !== 'lazy').map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))), new Promise(r => setTimeout(r, 2500))]).then(() => true)`); } catch {}
    await p.sleep(1100);
    const shot = await p.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const fp = await probe.evaluate(`${FINGERPRINT}(${JSON.stringify(shot.result.data)})`);
    const key = `${pg}@${width}`;
    current[key] = fp; n++;
    if (!update) {
      if (!baselines[key]) fresh.push(key);
      else {
        const a = hex2arr(fp), r = hex2arr(baselines[key]);
        const diffs = a.map((v, i) => Math.abs(v - r[i]));
        const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length, strong = diffs.filter(v => v > CELL_DIFF).length;
        if (mean > MEAN_TOL || strong >= CELLS_TOL) {
          failures.push(`${key}: mean drift ${mean.toFixed(1)}, ${strong} cells changed strongly`);
          fs.writeFileSync(path.join(root, 'test-results', 'visual', key.replace(/[\/@]/g, '_') + '.png'), Buffer.from(shot.result.data, 'base64'));
        }
      }
    }
    await p.close();
  }
}
await b.stop();
if (update) {
  fs.writeFileSync(BASE, JSON.stringify(current, null, 0).replace(/","/g, '",\n"') + '\n');
  console.log(`visual baselines written for ${n} captures (${pages.length} pages x ${WIDTHS.length} widths)`);
  process.exit(0);
}
fresh.forEach(k => console.log(`FAIL ${k}: no baseline (run UPDATE_VISUAL=1 node tests/visual.mjs and review)`));
failures.forEach(f => console.log('FAIL ' + f));
console.log(failures.length + fresh.length ? `${failures.length + fresh.length} visual differences` : `ok   visual regression: ${n} captures match their baselines (${pages.length} pages x ${WIDTHS.length} widths)`);
process.exit(failures.length + fresh.length ? 1 : 0);
