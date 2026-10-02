// End-to-end contract for all seven Echo-System tools, against mocked workers (never touches live services).
// Per tool: fresh profile -> complete -> result + retrieval code -> remote save -> retrieve on another "device"
// -> refresh/reopen -> e-mail through the REAL server validator -> no sideways scroll at 375/768/1280 -> named controls.
// Run: node tests/e2e-tools.mjs
import assert from 'node:assert/strict';
import { launch, CHROME } from './lib/browser.mjs';
import { TOOLS, completeTool } from './lib/drive.mjs';
import { validateMail } from '../worker/email.mjs';
if (!CHROME) { console.log('e2e tools test skipped: Chrome not found'); process.exit(0); }

const CODE_RE = /^[A-HJ-NP-Z2-9]{12}$/;
const codeSel = tool => (tool.n === 7 ? '#res-code' : '#code-box');
const failures = [];
let passed = 0;
const b = await launch();
const t = async (name, fn) => { try { await fn(); passed++; console.log('ok  ', name); } catch (e) { failures.push(name); console.log('FAIL', name, '\n    ', e.message.split('\n').slice(0, 4).join('\n     ')); } };

for (const tool of TOOLS) {
  const label = `tool ${tool.n}`;
  let c, p, code;

  await t(`${label}: completes and shows result and a 12-character code`, async () => {
    c = await b.context(); p = await c.page(tool.file);
    await completeTool(p, tool);
    await p.waitFor(`/^[A-HJ-NP-Z2-9]{12}$/.test(((document.querySelector('${codeSel(tool)}')||{}).textContent||'').trim())`, 12000);
    code = (await p.text(codeSel(tool))).trim();
    assert.match(code, CODE_RE);
    assert.deepEqual(p.errors, [], 'no uncaught script errors');
  });
  if (!code) continue;

  await t(`${label}: research contribution matches the tool's policy`, async () => {
    await p.sleep(400);
    assert.equal(c.mock.research.length, tool.research ? 1 : 0, tool.research ? 'one counter' : 'free-text tools never contribute');
    if (tool.research) assert.equal(c.mock.research[0].tool, tool.n);
    if (tool.research) assert.equal(await p.text('#tdh-research-receipt'), 'Anonymous aggregate contribution recorded.');
  });

  await t(`${label}: result is saved remotely under the code`, async () => {
    if (tool.n === 5) return; // tool 5 keeps its protocol on the device by design
    assert.ok(c.mock.profiles.has(`t${tool.n}${code}`), 'profile service has the record');
  });

  await t(`${label}: all controls have accessible names`, async () => {
    const unnamed = await p.evaluate(`[...document.querySelectorAll('button, a[href], input, select, textarea')].filter(e => e.offsetParent !== null && e.type !== 'hidden' && !(e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.getAttribute('title') || (e.textContent||'').trim() || (e.labels && e.labels.length) || e.getAttribute('placeholder'))).map(e => e.outerHTML.slice(0, 80))`);
    assert.deepEqual(unnamed, []);
  });

  await t(`${label}: refresh keeps the result (code in the address)`, async () => {
    if (tool.n === 5) return;
    await p.call('Page.reload', {});
    await p.sleep(500);
    await p.waitFor(`getComputedStyle(document.querySelector('${tool.result}')).display !== 'none'`, 10000);
    assert.equal((await p.text(codeSel(tool))).trim(), code);
    assert.equal(c.mock.research.length, tool.research ? 1 : 0, 'refresh does not contribute again');
  });

  await t(`${label}: another device retrieves the result from the code alone`, async () => {
    if (tool.n === 5) return;
    const other = await b.context({ mock: { profiles: c.mock.profiles } });
    const q = await other.page('tdh/result.html?code=' + code);
    await q.waitFor(`location.pathname.includes('tool-${tool.n}-')`, 12000);
    await q.waitFor(`getComputedStyle(document.querySelector('${tool.result}')).display !== 'none'`, 12000);
    assert.equal((await q.text(codeSel(tool))).trim(), code, 'same code, no new copy minted');
    assert.equal(other.mock.research.length, 0, 'retrieval never contributes');
    assert.equal([...other.mock.profiles.keys()].filter(k => k.startsWith(`t${tool.n}`)).length, 1, 'no duplicate record');
    assert.deepEqual(q.errors, []);
    await other.dispose();
  });

  await t(`${label}: e-mail sent from the result passes the server's validator`, async () => {
    await p.evaluate(`(() => { const i = document.querySelector('#email-input'); i.value = 'reader@example.org'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await p.click('#btn-email-send');
    await p.waitFor(`true`);
    for (let i = 0; i < 60 && !c.mock.mail.length; i++) await p.sleep(100);
    assert.equal(c.mock.mail.length, 1, 'exactly one e-mail request');
    const mail = { ...c.mock.mail[0], htmlContent: c.mock.mail[0].htmlContent.split('http://localhost:' + b.port).join('https://echoxstudios.art') }; // the test host stands in for the live origin
    assert.equal(validateMail(mail), null, 'the real worker accepts what the page sends: ' + validateMail(mail));
    assert.ok(mail.htmlContent.includes(code), 'e-mail contains the retrieval code');
  });

  await t(`${label}: no sideways scrolling and no clipped retrieval code at 320, 375, 768 and 1280`, async () => {
    for (const width of [320, 375, 768, 1280]) {
      await p.call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      await p.sleep(250);
      const over = await p.evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
      assert.ok(over <= 2, `${width}px: scrolls sideways by ${over}px`);
      // the retrieval code is read and copied by hand: every character must be visible, none clipped
      const clipped = await p.evaluate(`(() => { const e = document.querySelector('${codeSel(tool)}'); if (!e) return 0; const r = e.getBoundingClientRect(); return Math.max(0, e.scrollWidth - e.clientWidth) + Math.max(0, r.right - document.documentElement.clientWidth); })()`);
      assert.ok(clipped <= 1, `${width}px: retrieval code is clipped by ${clipped}px`);
    }
  });
  await c.dispose();
}

await b.stop();
console.log(`e2e tools: ${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
