// Headless-Chrome smoke test: every page loads without script errors or CSP violations,
// has a main landmark, and does not scroll sideways at phone or desktop width.
// Needs Chrome; skips with a notice when it is not installed. Run: node tests/smoke.mjs
import { spawn } from 'node:child_process';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.log('smoke test skipped: Chrome not found'); process.exit(0); }
const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const server = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}).listen(0);
const port = server.address().port;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise(res => { let b = ''; chrome.stderr.on('data', d => { b += d; const m = b.match(/ws:\/\/\S+/); if (m) res(m[0]); }); });
const browser = new WebSocket(wsUrl); await new Promise(r => (browser.onopen = r));
let id = 0; const pend = new Map(); const listeners = [];
browser.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else listeners.forEach(l => l(m)); };
const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend.set(i, r); browser.send(JSON.stringify({ id: i, method, params, sessionId })); });
const pages = [...fs.readdirSync(root).filter(f => f.endsWith('.html')), ...fs.readdirSync(path.join(root, 'tdh')).filter(f => f.endsWith('.html')).map(f => 'tdh/' + f)]
  .filter(f => !/dramatic-work-withheld/.test(f));
let failures = 0;
for (const width of [375, 1280]) {
  for (const p of pages) {
    const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
    const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
    const problems = [];
    const l = m => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
      if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon|Failed to load resource.*404/.test(m.params.entry.text)) problems.push('log: ' + m.params.entry.text);
      if (m.method === 'Network.loadingFailed' && !m.params.canceled) problems.push('request failed: ' + (m.params.errorText || ''));
    };
    listeners.push(l);
    for (const d of ['Runtime', 'Log', 'Network', 'Page']) await send(d + '.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', { width, height: 800, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
    await send('Page.navigate', { url: `http://localhost:${port}/${p}` }, sessionId);
    await new Promise(r => setTimeout(r, 1200));
    const { result: { result: { value } } } = await send('Runtime.evaluate', { returnByValue: true, expression: `JSON.stringify({main: !!document.querySelector('main,[role=main]'), over: document.documentElement.scrollWidth - window.innerWidth})` }, sessionId);
    const v = JSON.parse(value);
    if (!v.main) problems.push('no main landmark');
    if (v.over > 2) problems.push(`scrolls sideways by ${v.over}px`);
    listeners.splice(listeners.indexOf(l), 1);
    await send('Target.closeTarget', { targetId });
    if (problems.length) { failures++; console.log(`FAIL ${p} @${width}: ${[...new Set(problems)].join('; ')}`); }
  }
}
chrome.kill(); server.close(); await new Promise(r => setTimeout(r, 500)); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch {}
console.log(failures ? `${failures} smoke failures` : `smoke test passed (${pages.length} pages x 2 widths)`);
process.exit(failures ? 1 : 0);
