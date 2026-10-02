// The three storage choices at the privacy gate (recommended / limited / nothing saved), in a real browser against mocked workers.
// Run: node tests/e2e-storage.mjs
import assert from 'node:assert/strict';
import { launch, CHROME } from './lib/browser.mjs';
import { TOOLS, completeTool } from './lib/drive.mjs';
if (!CHROME) { console.log('e2e storage test skipped: Chrome not found'); process.exit(0); }

const tool = TOOLS[0];
const b = await launch();
const t = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n    ', e.message.split('\n').slice(0, 4).join('\n     ')); await b.stop(); process.exit(1); } };
const blank = { tdh_storage_mode: '', tdh_adult_confirmed: '', tdh_research_optin: '' };
// The page's own localStorage may be redirected in Nothing mode, so read the permanent storage through a same-origin frame.
const REAL = `(() => { let f = document.getElementById('__real'); if (!f) { f = document.createElement('iframe'); f.id = '__real'; f.style.display = 'none'; document.body.appendChild(f); } return f.contentWindow.localStorage; })()`;

async function choose(mode, mock) {
  const c = await b.context({ seed: blank, mock }); const p = await c.page(tool.file);
  await p.waitFor(`!!document.querySelector('#tdh-research-check')`, 8000);
  await p.evaluate(`document.querySelector('#tdh-age-check').click(); document.querySelector('#tdh-research-check').click()`);
  await p.click(`.tdh-choice-button[data-mode="${mode}"]`);
  await p.waitFor(`!document.querySelector('.tdh-privacy-backdrop')`, 5000);
  await completeTool(p, tool);
  await p.waitFor(`/[A-Z0-9]{12}/.test((document.querySelector('#code-box')||{}).textContent||'')`, 12000);
  await p.sleep(600);
  return { c, p };
}

await t('the gate offers Recommended, Limited and Nothing, each with the read-here explainer where it matters', async () => {
  const c = await b.context({ seed: blank }); const p = await c.page(tool.file);
  await p.waitFor(`!!document.querySelector('.tdh-choice-grid')`, 8000);
  const labels = await p.evaluate(`[...document.querySelectorAll('.tdh-choice-button')].map(x => x.getAttribute('data-mode') + '|' + x.textContent)`);
  assert.deepEqual(labels.map(x => x.split('|')[0]), ['remote', 'local', 'none']);
  assert.match(labels[0], /Recommended/); assert.match(labels[1], /Limited access/); assert.match(labels[2], /Nothing saved/);
  assert.match(await p.text('.tdh-privacy-panel'), /any device and browser/);
  assert.match(await p.text('.tdh-privacy-panel'), /no way to come back to this result after the window is closed/);
  assert.equal(await p.evaluate(`document.querySelectorAll('.tdh-choice-note a[href*="tdh-storage-difference"]').length`), 2);
  assert.equal(await p.evaluate(`[...document.querySelectorAll('.tdh-choice-button')].every(x => x.disabled)`), true);
  await c.dispose();
});

await t('Recommended: saved under the code, works anywhere, and the note says so', async () => {
  const { c, p } = await choose('remote');
  assert.equal(c.mock.profiles.size, 1);
  assert.match(await p.text('#tdh-code-where'), /works on any device and browser/);
  assert.ok(await p.evaluate(`Object.keys(${REAL}).some(k => k.startsWith('tdh_t1_'))`), 'also kept locally');
  await c.dispose();
});

await t('Limited: kept in this browser only, nothing sent to the profile service, and the note says so', async () => {
  const { c, p } = await choose('local');
  assert.equal(c.mock.profiles.size, 0);
  assert.match(await p.text('#tdh-code-where'), /only in this browser on this device/);
  assert.ok(await p.evaluate(`Object.keys(${REAL}).some(k => k.startsWith('tdh_t1_'))`));
  await c.dispose();
});

await t('Nothing: no result, code, choice or marker reaches permanent storage; still one anonymous counter', async () => {
  const { c, p } = await choose('none');
  assert.equal(c.mock.profiles.size, 0, 'nothing sent to the profile service');
  const keys = JSON.parse(await p.evaluate(`JSON.stringify(Object.keys(${REAL}))`)).filter(k => !k.startsWith('tdh_seeded'));
  console.log('     permanent keys:', JSON.stringify(keys));
  assert.deepEqual(keys.filter(k => /^tdh_t\d_|^tdh_research_sent/.test(k)), [], 'no results or sent-markers');
  assert.ok(!(await p.evaluate(`${REAL}.getItem('tdh_storage_mode')`)), 'the choice is not remembered permanently');
  assert.ok(!(await p.evaluate(`${REAL}.getItem('tdh_adult_confirmed')`)) , 'agreements are not remembered permanently');
  assert.ok(await p.evaluate(`Object.keys(sessionStorage).some(k => k.startsWith('tdh_t1_'))`), 'the result lives for this window only');
  assert.match(await p.text('#tdh-code-where'), /gone when you close this window/);
  assert.equal(c.mock.research.length, 1, 'one anonymous counter');
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await t('Nothing: a new window asks again', async () => {
  const { c } = await choose('none');
  const c2 = await b.context({ seed: blank }); const p2 = await c2.page(tool.file);
  await p2.waitFor(`!!document.querySelector('.tdh-choice-grid')`, 8000);
  await c.dispose(); await c2.dispose();
});

await b.stop();
console.log('storage choices: all checks passed');
