// Display and preference modes: 320 px reflow, 200% zoom, forced colours, reduced motion, light colour-scheme request.
// Every page, in each mode: no script errors, a main landmark, no sideways scrolling, readable text, nothing animating forever
// when reduced motion is requested.  Run: node tests/modes.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, CHROME, root } from './lib/browser.mjs';
if (!CHROME) { console.log('modes test skipped: Chrome not found'); process.exit(0); }

const pages = [...fs.readdirSync(root).filter(f => f.endsWith('.html')), ...fs.readdirSync(path.join(root, 'tdh')).filter(f => f.endsWith('.html')).map(f => 'tdh/' + f)]
  .filter(f => !/dramatic-work-withheld/.test(f)).sort();

const MODES = [
  { name: '320px reflow (400% zoom)', width: 320, media: [] },
  { name: '200% zoom', width: 640, dpr: 1, media: [], zoomText: true },
  { name: 'forced colours', width: 1024, media: [{ name: 'forced-colors', value: 'active' }] },
  { name: 'reduced motion', width: 1024, media: [{ name: 'prefers-reduced-motion', value: 'reduce' }], motion: true },
  { name: 'light colour scheme requested', width: 1024, media: [{ name: 'prefers-color-scheme', value: 'light' }] },
];
const CHECK = `(() => {
  const over = document.documentElement.scrollWidth - window.innerWidth;
  const main = !!document.querySelector('main,[role=main]');
  const bodyText = (document.body.innerText || '').trim().length;
  const invisible = [...document.querySelectorAll('h1,h2,p,a,button')].filter(e => e.offsetParent !== null && e.textContent.trim()).filter(e => { const s = getComputedStyle(e); return s.visibility === 'hidden' || parseFloat(s.opacity) === 0 || s.fontSize === '0px'; }).length;
  const infinite = document.getAnimations ? document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).length : 0;
  const sig = document.querySelector('.echox-signature img, .footer-logo img');
  let signature = null;
  if (sig) { const r = sig.getBoundingClientRect(), inFooter = !!sig.closest('.footer-logo'); signature = { h: Math.round(r.height), right: Math.round(r.right), left: Math.round(r.left), w: window.innerWidth, inFooter }; }
  return JSON.stringify({ over, main, bodyText, invisible, infinite, signature });
})()`;

const b = await launch();
const failures = []; let checks = 0;
for (const mode of MODES) {
  const c = await b.context({ width: mode.width });
  for (const pg of pages) {
    const p = await c.page(null, { width: mode.width, height: 800, mobile: false }); // desktop emulation: a mobile viewport would widen itself to fit overflowing content and hide it
    await p.call('Emulation.setEmulatedMedia', { features: mode.media });
    await p.goto(pg);
    await p.sleep(700);
    const r = JSON.parse(await p.evaluate(CHECK)); checks++;
    const problems = [];
    if (p.errors.length) problems.push('script error: ' + p.errors[0]);
    if (!r.main) problems.push('no main landmark');
    if (r.over > 2) problems.push(`scrolls sideways by ${r.over}px`);
    if (r.bodyText < 40) problems.push('page is blank');
    if (r.invisible) problems.push(`${r.invisible} text elements invisible`);
    if (r.signature) { const g = r.signature; if (g.h > 26) problems.push(`signature is ${g.h}px high (quiet signature: about 20px)`); if (g.inFooter ? g.left > g.w * 0.45 : g.right < g.w * 0.85) problems.push(`signature is not in the ${g.inFooter ? 'lower left' : 'lower right'} corner`); }
    if (mode.motion && r.infinite) problems.push(`${r.infinite} animations still loop forever`);
    if (problems.length) failures.push(`${pg} [${mode.name}]: ${problems.join('; ')}`);
    await p.close();
  }
  await c.dispose();
}
await b.stop();
failures.forEach(f => console.log('FAIL ' + f));
console.log(failures.length ? `${failures.length} mode failures` : `ok   modes: ${checks} page checks (${pages.length} pages x ${MODES.length} modes)`);
process.exit(failures.length ? 1 : 0);
