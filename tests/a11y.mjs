// Axe-core accessibility gate for every deployable page. Run: npm run test:a11y
// The test uses the same self-contained server/Chrome setup as smoke.mjs so CSP,
// page scripts, and the shared accessibility layer are exercised together.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import axe from 'axe-core';

const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(p => fs.existsSync(p));
if (!CHROME) { console.log('a11y test skipped: Chrome not found'); process.exit(0); }

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.json': 'application/json', '.pdf': 'application/pdf' };
const server = http.createServer((q, r) => {
  const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(r);
}).listen(0);

const port = server.address().port;
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdh-axe-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const wsUrl = await new Promise(resolve => {
  let buffer = '';
  chrome.stderr.on('data', data => { buffer += data; const found = buffer.match(/ws:\/\/\S+/); if (found) resolve(found[0]); });
});
const browser = new WebSocket(wsUrl); await new Promise(resolve => { browser.onopen = resolve; });
let id = 0; const pending = new Map();
browser.onmessage = event => { const message = JSON.parse(event.data); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } };
const send = (method, params = {}, sessionId) => new Promise(resolve => { const requestId = ++id; pending.set(requestId, resolve); browser.send(JSON.stringify({ id: requestId, method, params, sessionId })); });
const evaluate = async (expression, sessionId) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.text);
  return response.result.result.value;
};
const pages = [...fs.readdirSync(root).filter(file => file.endsWith('.html')), ...fs.readdirSync(path.join(root, 'tdh')).filter(file => file.endsWith('.html')).map(file => 'tdh/' + file)]
  .filter(file => !/dramatic-work-withheld/.test(file));
let failures = 0;

for (const page of pages) {
  const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
  for (const domain of ['Runtime', 'Page']) await send(domain + '.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  await send('Page.navigate', { url: `http://localhost:${port}/${page}` }, sessionId);
  await new Promise(resolve => setTimeout(resolve, 300));
  await evaluate(axe.source, sessionId);
  const report = JSON.parse(await evaluate(`axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }).then(r => JSON.stringify(r.violations.map(v => ({ id: v.id, help: v.help, nodes: v.nodes.map(n => n.target.join(' ')) }))))`, sessionId));
  if (report.length) {
    failures += report.length;
    for (const violation of report) console.log(`FAIL ${page}: ${violation.id} — ${violation.help} (${violation.nodes.join(', ')})`);
    const footerStyles = JSON.parse(await evaluate(`JSON.stringify([...document.querySelectorAll('footer .footer-links a, footer .footer-copy')].map(el => ({ text: el.textContent.trim(), color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor })))`, sessionId));
    if (footerStyles.length) console.log(`  footer styles: ${JSON.stringify(footerStyles)}`);
  }
  await send('Target.closeTarget', { targetId });
}

chrome.kill(); server.close();
await new Promise(resolve => setTimeout(resolve, 200));
try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 }); } catch {}
console.log(failures ? `${failures} accessibility violations` : `axe accessibility test passed (${pages.length} pages)`);
process.exit(failures ? 1 : 0);
