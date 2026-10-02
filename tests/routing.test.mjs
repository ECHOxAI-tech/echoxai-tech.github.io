// Verifies how privacy-choice.js routes profile requests (new service, legacy 6-character fallback, consent injection).
import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const src = fs.readFileSync(new URL('../tdh/privacy-choice.js', import.meta.url), 'utf8');
const calls = []; let legacyHit = false;
const store = { tdh_storage_mode: 'remote', tdh_remote_consent_at: '2026-10-02T00:00:00Z', tdh_adult_confirmed: 'yes' };
const el = () => new Proxy(function () {}, { get: (t, k) => (k === 'style' ? {} : k === 'classList' ? { add() {}, remove() {} } : el()), apply: () => el(), set: () => true });
const win = {
  fetch: async (u, o) => { calls.push([u, o]); return { ok: !(String(u).includes('tdh-profile') && /code=ABCD23/.test(u)), status: 200, json: async () => ({}) }; },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: k => delete store[k] },
  addEventListener() {}, location: { pathname: '/tdh/index.html' }, Response: class { constructor(b, i) { this.status = i?.status; this.ok = i?.status < 400; } },
};
win.window = win;
const ctx = vm.createContext({ ...win, window: win, document: { addEventListener() {}, readyState: 'loading', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, head: el(), body: el() }, localStorage: win.localStorage, Response: win.Response, console, setTimeout, crypto: { getRandomValues: a => a } });
vm.runInContext(src, ctx);
const OLD = 'https://tdh-email.inbox-fde.workers.dev', NEW = 'https://tdh-profile.inbox-fde.workers.dev';
await win.fetch(OLD + '/profile', { method: 'POST', body: JSON.stringify({ code: 'ABCDEFGHJKMN', tool: 't1', data: {} }) });
assert.ok(calls.at(-1)[0].startsWith(NEW + '/profile'), 'POST goes to the new service');
assert.ok(JSON.parse(calls.at(-1)[1].body).privacy.consentAt, 'consent metadata is attached');
await win.fetch(OLD + '/profile?code=ABCDEFGHJKMN&tool=t1');
assert.ok(calls.at(-1)[0].startsWith(NEW), '12-character read goes only to the new service');
const n = calls.length;
await win.fetch(OLD + '/profile?code=ABCD23&tool=t1');
assert.equal(calls.length, n + 2, 'legacy 6-character read falls back to the old service');
assert.ok(calls.at(-1)[0].startsWith(OLD + '/profile'));
await win.fetch(OLD, { method: 'POST', body: '{}' });
assert.equal(calls.at(-1)[0], OLD, 'e-mail endpoint is untouched');
console.log('4 routing checks passed');
