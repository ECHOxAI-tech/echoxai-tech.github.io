// Combined profile and comparison page, in a real browser against mocked workers.
// Run: node tests/e2e-profile.mjs
import assert from 'node:assert/strict';
import { launch, CHROME } from './lib/browser.mjs';
import { TOOLS, completeTool } from './lib/drive.mjs';
if (!CHROME) { console.log('e2e profile test skipped: Chrome not found'); process.exit(0); }

const b = await launch();
const profiles = new Map();
const t = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n    ', e.message.split('\n').slice(0, 4).join('\n     ')); await b.stop(); process.exit(1); } };

// Complete one tool in its own browser context and return the retrieval code.
async function codeFor(n, mock) {
  const tool = TOOLS.find(x => x.n === n);
  const c = await b.context({ mock });
  const p = await c.page(tool.file);
  await completeTool(p, tool);
  const sel = n === 7 ? '#res-code' : '#code-box';
  await p.waitFor(`/[A-Z0-9]{12}/.test((document.querySelector('${sel}')||{}).textContent||'')`, 12000);
  const code = (await p.text(sel)).trim().match(/[A-Z0-9]{12}/)[0];
  await c.dispose();
  return code;
}

const codes = {};
await t('two people each complete tools 1 and 3 and get twelve-character codes', async () => {
  for (const who of ['A', 'B']) for (const n of [1, 3]) codes[who + n] = await codeFor(n, { profiles });
  assert.equal(new Set(Object.values(codes)).size, 4);
  assert.ok([...profiles.keys()].length >= 4);
});

async function open(mock) {
  const c = await b.context({ mock });
  const p = await c.page('tdh/profile.html');
  await p.waitFor(`!!document.querySelector('#cell-0-0')`, 12000);
  return { c, p };
}
const fill = (p, id, v) => p.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);

await t('rows are ordered by tool, so cells 0 and 2 are tools 1 and 3', async () => {
  const { c, p } = await open({ profiles });
  const rows = await p.evaluate(`[...document.querySelectorAll('.rowlbl')].map(e => e.textContent)`);
  assert.match(rows[0], /Trigger Gradient/); assert.match(rows[2], /Attachment/);
  await c.dispose();
});

await t('two people compared from codes only: cells turn ok, names shown, nothing contributed', async () => {
  const { c, p } = await open({ profiles });
  await fill(p, 'cell-0-0', codes.A1); await fill(p, 'cell-0-1', codes.B1);
  await fill(p, 'cell-2-0', codes.A3); await fill(p, 'cell-2-1', codes.B3);
  await fill(p, 'pname-0', 'Alma'); await fill(p, 'pname-1', 'Bo');
  await p.click('#btn-analyse');
  await p.waitFor(`document.querySelector('#content').textContent.includes('Comparison')`, 15000);
  for (const id of ['cell-0-0', 'cell-0-1', 'cell-2-0', 'cell-2-1']) assert.ok(await p.evaluate(`document.getElementById('${id}').classList.contains('ok')`), id + ' ok');
  const txt = await p.text('#content');
  assert.ok(txt.includes('Alma') && txt.includes('Bo'), 'both names shown');
  assert.equal(c.mock.research.length, 0);
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await t('one person, several tests: combined view', async () => {
  const { c, p } = await open({ profiles });
  await fill(p, 'cell-0-0', codes.A1); await fill(p, 'cell-2-0', codes.A3); await fill(p, 'pname-0', 'Alma');
  await p.click('#btn-analyse');
  await p.waitFor(`document.querySelector('#content').textContent.includes('Alma')`, 15000);
  assert.ok((await p.text('#content')).includes('Trigger Gradient'));
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await t('an unknown code of the right format is marked bad and nothing crashes', async () => {
  const { c, p } = await open({ profiles });
  await fill(p, 'cell-0-0', 'ZZZZZZZZZZZZ');
  await p.click('#btn-analyse');
  await p.waitFor(`document.getElementById('cell-0-0').classList.contains('bad')`, 15000);
  await p.waitFor(`document.querySelector('#content').textContent.length > 0`, 5000);
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await t('a malformed code is marked bad and the note asks for a code when none is valid', async () => {
  const { c, p } = await open({ profiles });
  await fill(p, 'cell-0-0', 'abc');
  await p.click('#btn-analyse');
  await p.waitFor(`document.getElementById('cell-0-0').classList.contains('bad')`, 5000);
  assert.match(await p.evaluate(`document.body.innerText`), /at least one retrieval code/i);
  await c.dispose();
});

await b.stop();
console.log('profile page: all checks passed');
