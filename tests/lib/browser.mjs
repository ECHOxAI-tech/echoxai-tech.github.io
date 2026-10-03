// Shared headless-Chrome harness (hand-written CDP driver; no Playwright or Puppeteer needed).
// Serves the repository over localhost, gives every test a fresh browser context (empty storage) and mocks the
// three Cloudflare workers in-process, so no test can ever touch the live services or the real research counters.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/opt/pw-browsers/chromium']
  .concat(fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers').filter(d => /^chromium-/.test(d)).map(d => `/opt/pw-browsers/${d}/chrome-linux/chrome`) : [])
  .find(p => fs.existsSync(p) && fs.statSync(p).isFile());
export const root = path.resolve(decodeURIComponent(new URL('../..', import.meta.url).pathname));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

export async function launch() {
  const server = http.createServer((q, r) => {
    const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }).listen(0);
  const port = server.address().port;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdh-e2e-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise(res => { let b = ''; chrome.stderr.on('data', d => { b += d; const m = b.match(/ws:\/\/\S+/); if (m) res(m[0]); }); });
  const ws = new WebSocket(wsUrl); await new Promise(r => (ws.onopen = r));
  let id = 0; const pend = new Map(); const listeners = new Set();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } else listeners.forEach(l => l(m)); };
  const send = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Fresh, isolated browser context = fresh profile. opts: width, mobile, webdriver, blockStorage, mock (worker behaviour), seed (storage defaults)
  async function context(opts = {}) {
    const { result: { browserContextId } } = await send('Target.createBrowserContext');
    const mock = { profiles: new Map(), research: [], mail: [], researchMode: 'ok', profileMode: 'ok', mailMode: 'ok', calls: [], ...(opts.mock || {}) };
    const pages = [];
    async function page(url, popts = {}) {
      const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
      const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
      const errors = [], dialogs = [];
      const l = m => {
        if (m.sessionId !== sessionId) return;
        if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n')[0]);
        if (m.method === 'Fetch.requestPaused') handle(m.params);
        if (m.method === 'Page.javascriptDialogOpening') { dialogs.push(m.params.message); call('Page.handleJavaScriptDialog', { accept: true }); }
      };
      listeners.add(l);
      const call = (method, params) => send(method, params, sessionId);
      function respond(p, status, body, extra = {}) {
        return call('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: status, responseHeaders: Object.entries({ 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Content-Type': 'application/json', ...extra }).map(([name, value]) => ({ name, value })), body: Buffer.from(JSON.stringify(body)).toString('base64') });
      }
      function handle(p) {
        const u = new URL(p.request.url), method = p.request.method;
        if (method === 'OPTIONS') return respond(p, 204, '');
        mock.calls.push({ host: u.hostname.split('.')[0], path: u.pathname, method });
        const host = u.hostname;
        if (host.startsWith('tdh-research')) {
          if (u.pathname === '/research' && method === 'POST') {
            mock.research.push(JSON.parse(p.request.postData || '{}'));
            if (mock.researchMode === 'ok') return respond(p, 200, { accepted: true });
            if (mock.researchMode === 'disabled') return respond(p, 503, { error: 'research contribution is not active' });
            if (mock.researchMode === 'limited') return respond(p, 429, { error: 'slow down' });
            if (mock.researchMode === 'offline') return call('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' });
          }
          return respond(p, 404, { error: 'not found' });
        }
        if (host.startsWith('tdh-profile')) {
          if (mock.profileMode === 'offline') return call('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' });
          if (mock.profileMode === 'limited') return respond(p, 429, { error: 'slow down' });
          const key = (t, c) => t + c;
          if (method === 'POST') { const b = JSON.parse(p.request.postData || '{}'); if (!b.privacy) return respond(p, 403, { error: 'consent required' }); mock.profiles.set(key(b.tool, b.code), b.data); return respond(p, 200, { saved: true }); }
          if (method === 'GET') { const d = mock.profiles.get(key(u.searchParams.get('tool'), u.searchParams.get('code'))); return d ? respond(p, 200, { found: true, data: d }) : respond(p, 404, { found: false }); }
        }
        if (host.startsWith('tdh-mail')) {
          mock.mail.push(JSON.parse(p.request.postData || '{}'));
          if (mock.mailMode === 'error') return respond(p, 502, { error: 'delivery failed' });
          if (mock.mailMode === 'limited') return respond(p, 429, { error: 'slow down' });
          if (mock.mailMode === 'capped') return respond(p, 503, { error: 'daily limit reached' });
          if (mock.mailMode === 'offline') return call('Fetch.failRequest', { requestId: p.requestId, errorReason: 'InternetDisconnected' });
          return respond(p, 200, { sent: true });
        }
        return respond(p, 404, {});
      }
      for (const d of ['Runtime', 'Page']) await call(d + '.enable');
      await call('Fetch.enable', { patterns: [{ urlPattern: 'https://*.workers.dev/*' }] });
      await call('Emulation.setDeviceMetricsOverride', { width: popts.width || opts.width || 1280, height: popts.height || 900, deviceScaleFactor: 1, mobile: popts.mobile !== undefined ? popts.mobile : (popts.width || opts.width || 1280) < 500 });
      const seed = { tdh_storage_mode: 'remote', tdh_remote_consent_at: '2026-10-02T10:00:00.000Z', tdh_adult_confirmed: 'yes', tdh_research_optin: '2026-10-03', ...(opts.seed || {}) };
      await call('Page.addScriptToEvaluateOnNewDocument', { source: `
        Object.defineProperty(navigator, 'webdriver', { get: () => ${opts.webdriver ? 'true' : 'false'} });
        ${opts.blockStorage ? `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });` : `try { if (window !== window.top) throw 0; var s = ${JSON.stringify(seed)}; for (var k in s) if (localStorage.getItem(k) === null && !sessionStorage.getItem('tdh_seeded_off')) localStorage.setItem(k, s[k]); } catch (e) {}`}
      ` });
      const evaluate = async expr => {
        const r = await call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result.exceptionDetails) throw new Error('evaluate failed: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
        return r.result.result.value;
      };
      const waitFor = async (expr, ms = 8000) => {
        const end = Date.now() + ms;
        while (Date.now() < end) { try { if (await evaluate(expr)) return true; } catch {} await sleep(60); }
        throw new Error('timeout waiting for: ' + expr);
      };
      const handle2 = { call, evaluate, waitFor, errors, dialogs, sleep, sessionId, targetId,
        goto: async u => { await call('Page.navigate', { url: `http://localhost:${port}/${u}` }); await sleep(250); },
        click: sel => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('missing ${sel.replace(/'/g, '')}'); e.click(); return true; })()`),
        visible: sel => evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== 'none' && e.offsetParent !== null || (!!e && getComputedStyle(e).position === 'fixed'); })()`),
        text: sel => evaluate(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`),
        close: async () => { listeners.delete(l); await send('Target.closeTarget', { targetId }); } };
      pages.push(handle2);
      if (url) await handle2.goto(url);
      return handle2;
    }
    return { page, mock, dispose: async () => { await send('Target.disposeBrowserContext', { browserContextId }); } };
  }
  const stop = async () => { try { ws.close(); } catch {} chrome.kill(); server.close(); await sleep(400); try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 }); } catch {} };
  return { context, stop, port, send, sleep };
}
