// Keyboard contract for the TDH privacy dialog and the music disclosure controls.
// Run: node tests/keyboard.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(file => fs.existsSync(file));
if (!CHROME) { console.log('keyboard test skipped: Chrome not found'); process.exit(0); }
const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((request, response) => {
  const file = path.join(root, decodeURIComponent(request.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); return response.end(); }
  response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(response);
}).listen(0);
const port = server.address().port;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdh-keyboard-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise(resolve => { let buffer = ''; chrome.stderr.on('data', data => { buffer += data; const found = buffer.match(/ws:\/\/\S+/); if (found) resolve(found[0]); }); });
const browser = new WebSocket(wsUrl); await new Promise(resolve => { browser.onopen = resolve; });
let id = 0; const pending = new Map();
browser.onmessage = event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
const send = (method, params = {}, sessionId) => new Promise(resolve => { const requestId = ++id; pending.set(requestId, resolve); browser.send(JSON.stringify({ id: requestId, method, params, sessionId })); });
const evaluate = async (expression, sessionId) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result.result.value;
};
const key = async (keyName, sessionId, modifiers = 0) => {
  const keyCode = keyName === 'Tab' ? 9 : keyName === 'Escape' ? 27 : 13;
  const base = { key: keyName, code: keyName, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode, modifiers };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...base, ...(keyName === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) }, sessionId);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base }, sessionId);
};
const open = async page => {
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  for (const domain of ['Runtime', 'Page']) await send(domain + '.enable', {}, sessionId);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('tdh_storage_mode','local');localStorage.setItem('tdh_adult_confirmed','yes');localStorage.setItem('tdh_research_optin','2026-10-03');" }, sessionId);
  await send('Page.navigate', { url: `http://localhost:${port}/${page}` }, sessionId);
  await new Promise(resolve => setTimeout(resolve, 300));
  return { targetId, sessionId };
};

const privacyPages = [...Array(7)].map((_, index) => `tdh/tool-${index + 1}-${['trigger-gradient', 'aspirational-self', 'attachment-confirmation', 'dark-night', 'protocol-designer', 'threshold', 'liturgy-matrix'][index]}.html`);
privacyPages.push('tdh/profile.html');
for (const page of privacyPages) {
  const { targetId, sessionId } = await open(page);
  await evaluate("var settings = document.querySelector('.tdh-privacy-settings'); settings.focus(); settings.click()", sessionId);
  assert.equal(await evaluate("!!document.querySelector('.tdh-privacy-backdrop')", sessionId), true, `${page}: privacy panel opens`);
  await evaluate("document.querySelector('.tdh-privacy-backdrop').querySelector('a[href], button:not([disabled]), input:not([disabled])').focus()", sessionId);
  await key('Tab', sessionId, 8); // Shift
  assert.equal(await evaluate("document.activeElement === document.querySelector('.tdh-privacy-backdrop').querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')[document.querySelector('.tdh-privacy-backdrop').querySelectorAll('a[href], button:not([disabled]), input:not([disabled])').length - 1]", sessionId), true, `${page}: Shift+Tab wraps to the last control`);
  await key('Tab', sessionId);
  assert.equal(await evaluate("document.activeElement === document.querySelector('.tdh-privacy-backdrop').querySelector('a[href], button:not([disabled]), input:not([disabled])')", sessionId), true, `${page}: Tab wraps to the first control`);
  await key('Escape', sessionId);
  const closeState = await evaluate("JSON.stringify({ panel: !!document.querySelector('.tdh-privacy-backdrop'), focus: document.activeElement.className || document.activeElement.tagName })", sessionId);
  assert.equal(closeState, JSON.stringify({ panel: false, focus: 'tdh-privacy-settings' }), `${page}: Escape closes and restores focus`);
  await send('Target.closeTarget', { targetId });
}

{
  const { targetId, sessionId } = await open('lyrics.html');
  const controls = JSON.parse(await evaluate("JSON.stringify([...document.querySelectorAll('.track-toggle')].map(button => button.id))", sessionId));
  assert.equal(controls.length, 6, 'lyrics has six disclosure buttons');
  for (const control of controls) {
    await evaluate(`document.getElementById(${JSON.stringify(control)}).focus()`, sessionId);
    await key('Enter', sessionId);
    assert.equal(await evaluate(`document.getElementById(${JSON.stringify(control)}).getAttribute('aria-expanded') === 'true' && document.getElementById(document.getElementById(${JSON.stringify(control)}).getAttribute('aria-controls')).classList.contains('open')`, sessionId), true, `${control}: Enter opens its lyrics`);
  }
  await send('Target.closeTarget', { targetId });
}

chrome.kill(); server.close();
await new Promise(resolve => setTimeout(resolve, 200));
try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 }); } catch {}
console.log('keyboard test passed (8 privacy panels, 6 lyric disclosures)');
