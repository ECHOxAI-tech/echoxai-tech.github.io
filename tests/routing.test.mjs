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
const ctx = vm.createContext({ ...win, window: win, document: { addEventListener() {}, readyState: 'loading', getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, head: el(), body: el() }, localStorage: win.localStorage, Response: win.Response, console, setTimeout, crypto: { getRandomValues: a => a }, navigator: { webdriver: false } });
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
assert.equal(calls.at(-1)[0], 'https://tdh-mail.inbox-fde.workers.dev', 'e-mail goes to the hardened service');
// research counters: sent once per tool per month, only after the terms are accepted, never by automation
const RES = 'https://tdh-research.inbox-fde.workers.dev/research';
const sent = () => calls.filter(c => c[0] === RES).length;
delete store.tdh_research_optin;
await win.TDHResearch.submit(1, { V: 31, E: 22, T: 25, I: 22 });
assert.equal(sent(), 0, 'nothing is sent before the terms are accepted');
store.tdh_research_optin = '2026-10-03';
await win.TDHResearch.submit(1, { V: 31, E: 22, T: 25, I: 22 });
assert.equal(sent(), 1, 'accepted terms: one anonymous submission');
const body = JSON.parse(calls.at(-1)[1].body);
assert.deepEqual(Object.keys(body).sort(), ['scores', 'tool', 'v'], 'only whitelisted fields leave the device');
assert.equal(calls.at(-1)[1].credentials, 'omit');
await win.TDHResearch.submit(1, { V: 40, E: 20, T: 20, I: 20 });
assert.equal(sent(), 1, 'second submission in the same month is skipped');
console.log('9 routing checks passed');
