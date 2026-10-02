// Tool 1, the optional "matters for what it means" box, in a real browser against mocked workers.
// Run: node tests/e2e-meaning.mjs
import assert from 'node:assert/strict';
import { launch, CHROME } from './lib/browser.mjs';
import { validateMail } from '../worker/email.mjs';
if (!CHROME) { console.log('e2e meaning test skipped: Chrome not found'); process.exit(0); }

const T1 = 'tdh/tool-1-trigger-gradient.html';
const b = await launch();
let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n    ', e.message.split('\n').slice(0, 4).join('\n     ')); await b.stop(); process.exit(1); } };

// Answer every statement; where the box is offered answer 7, and tick it when asked to.
async function run(p, { tick }) {
  await p.waitFor(`!!document.querySelector('#btn-start')`);
  await p.click('#btn-start');
  let offered = 0;
  for (let i = 0; i < 40; i++) {
    if (await p.visible('#view-gate')) break;
    const boxShown = await p.evaluate(`!document.querySelector('#meaning-row').hidden`);
    if (boxShown) {
      offered++;
      await p.evaluate(`document.querySelectorAll('#likert-row .lbtn')[6].click()`);
      if (tick) await p.evaluate(`(() => { const c = document.querySelector('#meaning-check'); if (!c.checked) c.click(); })()`);
    } else await p.evaluate(`document.querySelectorAll('#likert-row .lbtn')[3].click()`);
    await p.click('#btn-next');
  }
  await p.waitFor(`getComputedStyle(document.querySelector('#view-gate')).display !== 'none'`);
  await p.click('#btn-reveal');
  await p.waitFor(`document.querySelector('#code-box').classList.contains('show')`, 12000);
  await p.sleep(900);
  const pct = JSON.parse(await p.evaluate(`JSON.stringify(Object.fromEntries(['V','E','T','I'].map(k => [k, parseInt(document.getElementById('pct-' + k).textContent)])))`));
  return { offered, pct, code: (await p.text('#code-box')).trim() };
}

let plain, ticked, tickedCtx, tickedPage;
await t('the box is offered on exactly 13 statements and nothing changes when it stays unticked', async () => {
  const c = await b.context(); const p = await c.page(T1);
  plain = await run(p, { tick: false });
  assert.equal(plain.offered, 13);
  assert.equal(await p.evaluate(`!!document.querySelector('.meaning-note')`), false, 'no note when nothing is ticked');
  assert.equal(plain.pct.V + plain.pct.E + plain.pct.T + plain.pct.I, 100);
  await c.dispose();
});
await t('ticking moves points to Intellectual and the result says so', async () => {
  tickedCtx = await b.context(); tickedPage = await tickedCtx.page(T1);
  ticked = await run(tickedPage, { tick: true });
  assert.ok(ticked.pct.I > plain.pct.I, `Intellectual ${ticked.pct.I}% should exceed ${plain.pct.I}%`);
  assert.ok(ticked.pct.T < plain.pct.T && ticked.pct.V < plain.pct.V, 'Tactile and Visual fall');
  assert.match(await tickedPage.text('.meaning-note'), /You marked 13 statements/);
  assert.deepEqual(tickedPage.errors, []);
});
await t('the choice is saved with the result and shown again when it is reopened by code', async () => {
  const saved = tickedCtx.mock.profiles.get('t1' + ticked.code);
  assert.ok(saved && Array.isArray(saved.meaning) && saved.meaning.length === 13, 'meaning list saved');
  const other = await b.context({ mock: { profiles: tickedCtx.mock.profiles } });
  const q = await other.page('tdh/result.html?code=' + ticked.code);
  await q.waitFor(`location.pathname.includes('tool-1-')`, 12000);
  await q.waitFor(`!!document.querySelector('.meaning-note')`, 12000);
  assert.match(await q.text('.meaning-note'), /13 statements/);
  assert.equal(other.mock.research.length, 0);
  await other.dispose();
});
await t('the result e-mail mentions it and still passes the server validator', async () => {
  await tickedPage.evaluate(`(() => { const i = document.querySelector('#email-input'); i.value = 'reader@example.org'; })()`);
  await tickedPage.click('#btn-email-send');
  for (let i = 0; i < 60 && !tickedCtx.mock.mail.length; i++) await tickedPage.sleep(100);
  const mail = { ...tickedCtx.mock.mail[0], htmlContent: tickedCtx.mock.mail[0].htmlContent.split('http://localhost:' + b.port).join('https://echoxstudios.art') };
  assert.equal(validateMail(mail), null);
  assert.match(mail.htmlContent, /13 of your answers were marked/);
  await tickedCtx.dispose();
});
await t('Back keeps the tick, and the box works by keyboard', async () => {
  const c = await b.context(); const p = await c.page(T1);
  await p.waitFor(`!!document.querySelector('#btn-start')`); await p.click('#btn-start');
  for (let i = 0; i < 40; i++) {
    if (await p.evaluate(`!document.querySelector('#meaning-row').hidden`)) break;
    await p.evaluate(`document.querySelectorAll('#likert-row .lbtn')[3].click()`); await p.click('#btn-next');
  }
  await p.evaluate(`document.querySelectorAll('#likert-row .lbtn')[5].click(); document.querySelector('#meaning-check').focus()`);
  await p.call('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
  await p.call('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  assert.equal(await p.evaluate(`document.querySelector('#meaning-check').checked`), true, 'space ticks the box');
  await p.click('#btn-next'); await p.click('#btn-back');
  assert.equal(await p.evaluate(`document.querySelector('#meaning-check').checked`), true, 'tick survives Back');
  assert.ok((await p.evaluate(`document.querySelector('#meaning-row label').textContent.trim().length`)) > 20, 'the box has a readable label');
  await c.dispose();
});
await b.stop();
console.log(`e2e meaning: ${passed} passed`);
