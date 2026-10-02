// Takes the example screenshots on tdh/examples.html from the real result screens, with invented answers.
// Reproducible in kind (tool 1 and tool 4 follow fixed answer rules; the others answer "agree" throughout).
// Run: node tools/make-example-shots.mjs   (needs Chrome; nothing leaves the machine: all workers are mocked)
import fs from 'node:fs';
import path from 'node:path';
import { launch, root } from '../tests/lib/browser.mjs';
import { TOOLS, completeTool } from '../tests/lib/drive.mjs';

const out = path.join(root, 'assets', 'examples'); fs.mkdirSync(out, { recursive: true });
const b = await launch();

// Tool 1: an intellectual-leaning profile. Tool 4: erosion present, framework still real (a "dark night" reading).
async function answerBy(p, startSel, decide) {
  await p.waitFor(`!!document.querySelector('${startSel}')`); await p.click(startSel);
  for (let i = 0; i < 80; i++) {
    if (await p.visible('#view-gate')) return;
    await p.evaluate(`(() => { const q = shuffled[current]; const v = (${decide})(q); document.querySelectorAll('#likert-row .lbtn')[v].click(); })()`);
    await p.click('#btn-next');
  }
}
const t1 = q => (q.ch === 'I' ? (q.rev ? 1 : 6) : q.ch === 'E' ? (q.rev ? 3 : 4) : q.ch === 'T' ? (q.rev ? 4 : 2) : (q.rev ? 4 : 3));
const t4 = q => (q.phase === 'P' ? 5 : q.phase === 'F' ? 1 : 5);

for (const tool of TOOLS) {
  const c = await b.context(); const p = await c.page(tool.file, { width: 760, height: 1000, mobile: false });
  if (tool.n === 1) {
    await answerBy(p, '#btn-start', t1.toString());
    await p.click('#btn-reveal');
    await p.waitFor(`getComputedStyle(document.querySelector('#view-results')).display !== 'none'`);
  } else if (tool.n === 4) {
    await p.waitFor(`!!document.querySelector('#btn-ready')`); await p.click('#btn-ready');
    for (let i = 0; i < 60; i++) {
      if (await p.visible('#view-gate')) break;
      if (await p.visible('#btn-phase-continue')) { await p.click('#btn-phase-continue'); continue; }
      await p.evaluate(`(() => { const q = ORDERED[current]; const v = (${t4.toString()})(q); const l = document.querySelectorAll('#likert-row .lbtn'); if (l.length) l[v].click(); })()`);
      await p.click('#btn-next');
    }
    await p.click('#btn-reveal');
    await p.waitFor(`getComputedStyle(document.querySelector('#view-results')).display !== 'none'`);
  } else await completeTool(p, tool);
  await p.sleep(1800);
  await p.evaluate(`(() => { const st = document.createElement('style'); st.textContent = '.tdh-privacy-settings{display:none!important}'; document.head.appendChild(st); window.scrollTo(0, 0); })()`);
  const s = await p.call('Page.captureScreenshot', { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 760, height: 1000, scale: 1 } });
  fs.writeFileSync(path.join(out, `tool-${tool.n}.jpg`), Buffer.from(s.result.data, 'base64'));
  await c.dispose();
}
await b.stop();
console.log('wrote example screenshots');
