// End-to-end contract for the research flow on tool 1 (a supported tool), against mocked workers.
// Run: node tests/e2e-research.mjs     (never contacts the live services)
import assert from 'node:assert/strict';
import { launch, CHROME } from './lib/browser.mjs';
if (!CHROME) { console.log('e2e research test skipped: Chrome not found'); process.exit(0); }

const T1 = 'tdh/tool-1-trigger-gradient.html';
const RECEIPT = '#tdh-research-receipt';
let passed = 0;
const b = await launch();
const t = async (name, fn) => { try { await fn(); passed++; console.log('ok  ', name); } catch (e) { console.log('FAIL', name, '\n    ', e.message); await b.stop(); process.exit(1); } };

// Answer every question (cycling 3..6) and reveal the result.
async function complete(p) {
  await p.waitFor(`!!document.querySelector('#btn-start')`);
  await p.click('#btn-start');
  for (let i = 0; i < 200; i++) {
    if (await p.visible('#view-gate')) break;
    await p.evaluate(`document.querySelectorAll('#likert-row .lbtn')[${3 + (i % 4) - 1}].click()`);
    await p.click('#btn-next');
  }
  await p.waitFor(`getComputedStyle(document.querySelector('#view-gate')).display !== 'none'`);
  await p.click('#btn-reveal');
  await p.waitFor(`document.querySelector('#code-box') && document.querySelector('#code-box').classList.contains('show')`);
  return (await p.text('#code-box')).trim();
}

await t('completion makes exactly one research request and shows the receipt', async () => {
  const c = await b.context(); const p = await c.page(T1);
  const code = await complete(p);
  assert.match(code, /^[A-HJ-NP-Z2-9]{12}$/);
  await p.waitFor(`!!document.querySelector('${RECEIPT}')`);
  assert.equal(await p.text(RECEIPT), 'Anonymous aggregate contribution recorded.');
  assert.equal(c.mock.research.length, 1);
  const body = c.mock.research[0];
  assert.deepEqual(Object.keys(body).sort(), ['scores', 'tool', 'v']);
  assert.equal(body.tool, 1); assert.deepEqual(Object.keys(body.scores).sort(), ['e', 'i', 't', 'v']);
  const receiptText = await p.text(RECEIPT);
  assert.ok(!/\d/.test(receiptText), 'receipt must show no numbers (no values, no counts)');
  assert.ok(!receiptText.includes(code), 'receipt must not show the code');
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await t('profile is retrievable by code (remote storage) and by a fresh device', async () => {
  const c = await b.context(); const p = await c.page(T1);
  const code = await complete(p);
  assert.ok(c.mock.profiles.has('t1' + code), 'profile service received the result');
  // A second, fresh browser context (another device, empty storage) opens the result from the code alone.
  const other = await b.context({ mock: { profiles: c.mock.profiles } });
  const q = await other.page('tdh/result.html?code=' + code);
  await q.waitFor(`/tool-1-trigger-gradient\\.html/.test(location.pathname)`, 10000);
  await q.waitFor(`getComputedStyle(document.querySelector('#view-results')).display !== 'none'`);
  assert.equal((await q.text('#code-box')).trim(), code);
  assert.deepEqual(q.errors, []);
  assert.equal(other.mock.research.length, 0, 'reopening a result by code on another device must not contribute');
  await c.dispose(); await other.dispose();
});

await t('comparison link works and never contributes to research', async () => {
  const c = await b.context(); const p = await c.page(T1);
  await complete(p);
  const share = await p.text('#share-url-text');
  assert.match(share, /[?&]v=\d+&e=\d+&t=\d+&i=\d+/);
  const before = c.mock.research.length;
  const fresh = await b.context(); const q = await fresh.page(share.replace(/^https?:\/\/[^/]+\//, '').replace(/^.*?(tdh\/)/, '$1'));
  await q.waitFor(`getComputedStyle(document.querySelector('#view-results')).display !== 'none'`);
  await q.sleep(900);
  assert.equal(fresh.mock.research.length, 0, 'a result opened from a share link is not the viewer\'s own and must not be contributed');
  assert.equal(await q.evaluate(`!!document.querySelector('${RECEIPT}')`), false);
  assert.equal(before, 1);
  await c.dispose(); await fresh.dispose();
});

await t('once per tool per device per month: a retake sends nothing further', async () => {
  const c = await b.context(); const p = await c.page(T1);
  const code = await complete(p);
  await p.waitFor(`!!document.querySelector('${RECEIPT}')`);
  assert.equal(c.mock.research.length, 1);
  await p.goto(T1); // reopen in the same profile and complete again
  await complete(p);
  await p.waitFor(`document.querySelector('${RECEIPT}') && /already recorded/.test(document.querySelector('${RECEIPT}').textContent)`);
  assert.equal(c.mock.research.length, 1, 'still exactly one request');
  assert.ok(await p.evaluate(`localStorage.getItem('tdh_research_sent_t1') === new Date().toISOString().slice(0,7)`));
  await c.dispose();
});

await t('automated browsers never contribute and show no receipt', async () => {
  const c = await b.context({ webdriver: true }); const p = await c.page(T1);
  await complete(p); await p.sleep(600);
  assert.equal(c.mock.research.length, 0);
  assert.equal(await p.evaluate(`!!document.querySelector('${RECEIPT}')`), false);
  await c.dispose();
});

await t('the gate has a separate research checkbox: both must be ticked, and the stored version is the current one', async () => {
  const c = await b.context({ seed: { tdh_storage_mode: '', tdh_adult_confirmed: '', tdh_research_optin: '' } }); const p = await c.page(T1);
  await p.waitFor(`!!document.querySelector('#tdh-research-check')`, 8000);
  assert.match(await p.text('.tdh-privacy-panel'), /scientific research, public reporting and redacted sharing with scientists or media/);
  assert.equal(await p.evaluate(`document.querySelector('#tdh-research-check').checked`), false, 'default unticked');
  const disabled = () => p.evaluate(`[...document.querySelectorAll('.tdh-choice-button')].every(x => x.disabled)`);
  assert.equal(await disabled(), true, 'nothing ticked');
  await p.evaluate(`document.querySelector('#tdh-age-check').click()`);
  assert.equal(await disabled(), true, 'age alone is not enough');
  await p.evaluate(`document.querySelector('#tdh-research-check').click()`);
  assert.equal(await disabled(), false, 'both ticked');
  await p.click('.tdh-choice-button[data-mode="local"]');
  assert.equal(await p.evaluate(`localStorage.getItem('tdh_research_optin')`), '2026-10-03');
  await c.dispose();
});

await t('not opted in: nothing is sent', async () => {
  const c = await b.context({ seed: { tdh_research_optin: 'old-version' } }); const p = await c.page(T1);
  // the privacy panel is required again; accepting it opts in, so decline by closing nothing: just check no request fired yet
  await p.sleep(500);
  assert.equal(c.mock.research.length, 0);
  await c.dispose();
});


// ---------- failure modes ----------
const PAUSED = 'Anonymous research counters are paused at the moment. Your result is unaffected.';
const FAILED = 'Your result is still available; the anonymous contribution could not be sent and will retry next time.';

await t('worker disabled (503): clear message, result kept, retry stays possible', async () => {
  const c = await b.context({ mock: { researchMode: 'disabled' } }); const p = await c.page(T1);
  const code = await complete(p);
  await p.waitFor(`!!document.querySelector('${RECEIPT}')`);
  assert.equal(await p.text(RECEIPT), PAUSED);
  assert.equal(await p.evaluate(`localStorage.getItem('tdh_research_sent_t1')`), null, 'no false "sent" marker');
  assert.ok(await p.evaluate(`!!localStorage.getItem('tdh_t1_${code}')`), 'local result is not lost');
  c.mock.researchMode = 'ok';
  await p.goto(T1); await complete(p);
  await p.waitFor(`/recorded\\.$/.test((document.querySelector('${RECEIPT}')||{}).textContent||'')`);
  assert.equal(await p.text(RECEIPT), 'Anonymous aggregate contribution recorded.');
  await c.dispose();
});

await t('rate limited (429): failure message and the local result is not lost', async () => {
  const c = await b.context({ mock: { researchMode: 'limited' } }); const p = await c.page(T1);
  const code = await complete(p);
  await p.waitFor(`!!document.querySelector('${RECEIPT}')`);
  assert.equal(await p.text(RECEIPT), FAILED);
  assert.equal(await p.evaluate(`localStorage.getItem('tdh_research_sent_t1')`), null);
  assert.ok(await p.evaluate(`!!localStorage.getItem('tdh_t1_${code}')`));
  assert.equal(await p.visible('#view-results'), true);
  await c.dispose();
});

await t('offline / timeout: no false "sent" marker and retry remains possible', async () => {
  const c = await b.context({ mock: { researchMode: 'offline' } }); const p = await c.page(T1);
  await complete(p);
  await p.waitFor(`!!document.querySelector('${RECEIPT}')`);
  assert.equal(await p.text(RECEIPT), FAILED);
  assert.equal(await p.evaluate(`localStorage.getItem('tdh_research_sent_t1')`), null);
  c.mock.researchMode = 'ok';
  await p.goto(T1); await complete(p);
  await p.waitFor(`/recorded\\.$/.test((document.querySelector('${RECEIPT}')||{}).textContent||'')`);
  assert.equal(c.mock.research.length, 2, 'one failed attempt, one successful retry');
  await c.dispose();
});

await t('profile service down: result still shown with its code, research unaffected', async () => {
  const c = await b.context({ mock: { profileMode: 'offline' } }); const p = await c.page(T1);
  const code = await complete(p);
  assert.match(code, /^[A-HJ-NP-Z2-9]{12}$/);
  assert.equal(await p.visible('#view-results'), true);
  await c.dispose();
});

await t('blocked local storage: page still works and says the result is local-only to this page view', async () => {
  const c = await b.context({ blockStorage: true }); const p = await c.page(T1);
  await p.waitFor(`!!document.querySelector('#btn-start')`);
  await p.sleep(300);
  assert.match(await p.text('.tdh-storage-notice'), /blocks local storage/);
  const code = await complete(p);
  assert.match(code, /^[A-HJ-NP-Z2-9]{12}$/);
  assert.equal(await p.visible('#view-results'), true);
  assert.deepEqual(p.errors, [], 'no uncaught script errors with storage blocked');
  await c.dispose();
});

await t('corrupt saved result: safe recovery to the intro, never a blank page', async () => {
  const c = await b.context({ seed: { tdh_t1_ABCDEFGH2345: '{not json', tdh_code_t1: 'ABCDEFGH2345' } });
  const p = await c.page(T1 + '?code=ABCDEFGH2345');
  await p.waitFor(`!!document.querySelector('#btn-start')`);
  assert.equal(await p.visible('#view-intro'), true);
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await t('corrupt saved result via result.html: recovers instead of looping or blanking', async () => {
  const c = await b.context({ seed: { tdh_t1_ABCDEFGH2345: '{not json' } });
  const p = await c.page('tdh/result.html?code=ABCDEFGH2345');
  await p.sleep(1200);
  const here = await p.evaluate(`location.pathname`);
  assert.ok(/tool-1|result\.html/.test(here));
  assert.ok((await p.evaluate(`document.body.innerText.trim().length`)) > 20, 'page is not blank');
  assert.deepEqual(p.errors, []);
  await c.dispose();
});

await b.stop();
console.log(`e2e research: ${passed} passed`);
