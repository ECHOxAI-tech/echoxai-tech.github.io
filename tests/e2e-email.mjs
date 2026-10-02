// E-mail delivery from the result screens, against a mocked mail worker (no real mail is ever sent).
// Success and every failure path, on a tool of each markup family. Run: node tests/e2e-email.mjs
import assert from 'node:assert/strict';
import { launch, CHROME } from './lib/browser.mjs';
import { TOOLS, completeTool } from './lib/drive.mjs';
import { validateMail } from '../worker/email.mjs';
if (!CHROME) { console.log('e2e email test skipped: Chrome not found'); process.exit(0); }

const b = await launch();
let passed = 0, failed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('ok  ', name); } catch (e) { failed++; console.log('FAIL', name, '\n    ', e.message.split('\n').slice(0, 3).join('\n     ')); } };

async function sendFrom(tool, mailMode, address = 'reader@example.org') {
  const c = await b.context({ mock: { mailMode } });
  const p = await c.page(tool.file);
  await completeTool(p, tool);
  await p.sleep(400);
  await p.evaluate(`(() => { const i = document.querySelector('#email-input'); i.value = ${JSON.stringify(address)}; })()`);
  await p.click('#btn-email-send');
  for (let i = 0; i < 40 && !(await p.evaluate(`/Sent|Send|\\u2713/.test(document.querySelector('#btn-email-send').textContent) && !/Sending/.test(document.querySelector('#btn-email-send').textContent)`)); i++) await p.sleep(100);
  await p.sleep(300);
  return { c, p, feedback: (await p.text('#send-feedback')).trim(), button: (await p.text('#btn-email-send')).trim(), disabled: await p.evaluate(`document.querySelector('#btn-email-send').disabled`) };
}

for (const n of [1, 4, 7]) {
  const tool = TOOLS[n - 1];
  await t(`tool ${n}: successful delivery is confirmed and the request is valid`, async () => {
    const r = await sendFrom(tool, 'ok');
    assert.equal(r.c.mock.mail.length, 1);
    const mail = { ...r.c.mock.mail[0], htmlContent: r.c.mock.mail[0].htmlContent.split('http://localhost:' + b.port).join('https://echoxstudios.art') };
    assert.equal(validateMail(mail), null);
    assert.equal(mail.to, 'reader@example.org');
    assert.match(r.feedback, /sent|inbox/i);
    await r.c.dispose();
  });
  for (const [mode, expect] of [['error', /fail|error|try again|could not send/i], ['limited', /fail|error|slow|try again|could not send/i], ['capped', /fail|error|try again|limit|could not send/i], ['offline', /network|try again/i]]) {
    await t(`tool ${n}: ${mode} shows a clear message and the Send button works again`, async () => {
      const r = await sendFrom(tool, mode);
      assert.match(r.feedback, expect, 'feedback: ' + r.feedback);
      assert.equal(r.disabled, false, 'Send is enabled again so the visitor can retry');
      assert.ok(await r.p.visible(tool.result), 'the result stays on screen');
      assert.deepEqual(r.p.errors, []);
      await r.c.dispose();
    });
  }
  await t(`tool ${n}: an invalid address is rejected in the page, nothing is sent`, async () => {
    const r = await sendFrom(tool, 'ok', 'not-an-address');
    assert.equal(r.c.mock.mail.length, 0);
    assert.match(r.feedback, /valid email/i);
    await r.c.dispose();
  });
}
await b.stop();
console.log(`e2e email: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
