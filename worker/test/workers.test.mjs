// Run with: node worker/test/workers.test.mjs
import assert from 'node:assert/strict';
import profile from '../profile.mjs';
import research, { validate, K } from '../research.mjs';
import email, { validateMail } from '../email.mjs';

const ORIGIN = 'https://echoxstudios.art';
const req = (path, method = 'GET', body, headers = {}) =>
  new Request('https://w.example' + path, { method, headers: { Origin: ORIGIN, 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1', ...headers }, body: body ? JSON.stringify(body) : undefined });

// ---------- in-memory KV ----------
const kv = () => { const m = new Map(); const o = { puts: [] }; return { _o: o,
  put: async (k, v, opts) => { m.set(k, v); o.puts.push({ k, opts }); }, get: async (k) => m.get(k) ?? null, delete: async (k) => { m.delete(k); }, _m: m }; };

// ---------- in-memory D1 (just enough for the two upserts and two selects used) ----------
function d1() {
  const totals = new Map(), cells = new Map();
  const prepare = (sql) => ({ bind: (...a) => ({ sql, a,
    async all() {
      if (sql.includes('FROM totals')) return { results: [...totals].filter(([k]) => k.startsWith(a[0] + '|')).map(([k, n]) => ({ month: k.split('|')[1], n })) };
      const agg = new Map();
      for (const [k, n] of cells) { const [t, dim, b] = k.split('|'); if (+t === a[0]) agg.set(dim + '|' + b, (agg.get(dim + '|' + b) || 0) + n); }
      return { results: [...agg].map(([k, n]) => ({ dim: k.split('|')[0], bucket: +k.split('|')[1], n })) };
    } }) });
  return { prepare, totals, cells, async batch(stmts) { for (const s of stmts) {
      if (s.sql.includes('INTO totals')) { const k = s.a.join('|'); totals.set(k, (totals.get(k) || 0) + 1); }
      else { const k = s.a.join('|'); cells.set(k, (cells.get(k) || 0) + 1); } } } };
}

let passed = 0;
const t = async (name, fn) => { await fn(); passed++; console.log('ok  ', name); };

// ---------- profile worker ----------
const PROFILES = kv();
const penv = { PROFILES };
const consent = { consentAt: '2026-10-02T10:00:00Z', consentVersion: '2026-07-15' };
await t('profile: rejects bad code, bad tool, missing consent', async () => {
  for (const b of [{ code: 'abc', tool: 't1', data: {}, privacy: consent }, { code: 'ABCD23', tool: 'x', data: {}, privacy: consent }, { code: 'ABCD23', tool: 't1', data: {} }]) {
    const r = await profile.fetch(req('/profile', 'POST', b), penv); assert.ok([400, 403].includes(r.status));
  }
});
await t('profile: legacy 6-char and new 12-char codes round-trip', async () => {
  for (const code of ['ABCD23', 'ABCDEFGH2345']) {
    assert.equal((await profile.fetch(req('/profile', 'POST', { code, tool: 't1', data: { a: 1 }, privacy: consent }), penv)).status, 200);
    const g = await (await profile.fetch(req(`/profile?code=${code}&tool=t1`), penv)).json();
    assert.deepEqual(g.data, { a: 1 });
  }
});
await t('profile: opening a result renews the 24-month clock, at most weekly', async () => {
  const code = 'RENEW2345ABC', key = 't1' + code, TTL = 60 * 60 * 24 * 730;
  await profile.fetch(req('/profile', 'POST', { code, tool: 't1', data: { a: 1 }, privacy: consent }), penv);
  assert.equal(PROFILES._o.puts.at(-1).opts.expirationTtl, TTL, 'save sets 24 months');
  const n = () => PROFILES._o.puts.length;
  let before = n();
  await profile.fetch(req(`/profile?code=${code}&tool=t1`), penv);
  assert.equal(n(), before, 'opened the same day: no extra write');
  const rec = JSON.parse(PROFILES._m.get(key)); rec.touchedAt = Date.now() - 8 * 24 * 3600 * 1000; PROFILES._m.set(key, JSON.stringify(rec));
  await profile.fetch(req(`/profile?code=${code}&tool=t1`), penv);
  assert.equal(n(), before + 1, 'opened after a week: renewed');
  assert.equal(PROFILES._o.puts.at(-1).opts.expirationTtl, TTL);
  assert.ok(Date.now() - JSON.parse(PROFILES._m.get(key)).touchedAt < 5000, 'touchedAt refreshed');
  await profile.fetch(req(`/profile?code=${code}&tool=t1`, 'DELETE'), penv);
});
await t('profile: ambiguous characters (0 O 1 I) are invalid', async () => {
  const r = await profile.fetch(req('/profile?code=ABCD0O&tool=t1'), penv); assert.equal(r.status, 404);
});
await t('profile: DELETE removes the record', async () => {
  assert.equal((await profile.fetch(req('/profile?code=ABCD23&tool=t1', 'DELETE'), penv)).status, 200);
  assert.equal((await profile.fetch(req('/profile?code=ABCD23&tool=t1'), penv)).status, 404);
});
await t('profile: oversized payload rejected', async () => {
  const r = await profile.fetch(req('/profile', 'POST', { code: 'ABCD23', tool: 't1', data: { x: 'a'.repeat(40000) }, privacy: consent }), penv);
  assert.equal(r.status, 413);
});
await t('profile: rate limiter is honoured', async () => {
  const r = await profile.fetch(req('/profile?code=ABCD23&tool=t1'), { ...penv, PROFILE_READ_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(r.status, 429);
});
await t('profile: CORS never reflects foreign origins', async () => {
  const r = await profile.fetch(req('/profile?code=ABCD23&tool=t1', 'GET', undefined, { Origin: 'https://evil.example' }), penv);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});

// ---------- research worker ----------
await t('research: validate accepts buckets and rejects extras', () => {
  assert.deepEqual(validate({ v: 1, tool: 1, scores: { visual: 24, emotional: 51 } }), [{ dim: 'visual', bucket: 20 }, { dim: 'emotional', bucket: 50 }]);
  assert.equal(validate({ v: 1, tool: 1, scores: { visual: 24 }, code: 'ABCD23' }), null);
  assert.equal(validate({ v: 1, tool: 1, scores: { visual: 101 } }), null);
  assert.equal(validate({ v: 1, tool: 5, scores: { a: 1 } }), null);
  assert.equal(validate({ v: 1, tool: 7, scores: { a: 1 } }), null);
  assert.equal(validate({ v: 1, tool: 1, scores: { 'Bad Key': 5 } }), null);
  assert.equal(validate({ v: 1, tool: 4, label: 'nope' }), null);
  assert.deepEqual(validate({ v: 1, tool: 4, label: 'dark_night' }), [{ dim: 'label_dark_night', bucket: 0 }]);
  assert.deepEqual(validate({ v: 1, tool: 6, scores: { threshold: 3, cost: 2 } }), [{ dim: 'threshold', bucket: 3 }, { dim: 'cost', bucket: 2 }]);
  assert.equal(validate({ v: 1, tool: 6, scores: { threshold: 9 } }), null);
});
const DB = d1();
const renv = { RESEARCH_DB: DB };
await t('research: inactive until the enable flag is set (kill switch)', async () => {
  assert.equal((await research.fetch(req('/research', 'POST', { v: 1, tool: 1, scores: { visual: 20 } }), renv)).status, 503);
  assert.equal((await research.fetch(req('/research', 'POST', { v: 1, tool: 1, scores: { visual: 20 } }), { ...renv, RESEARCH_ENABLED: '0' })).status, 503);
});
const on = { ...renv, RESEARCH_ENABLED: '1', ETHICS_APPROVAL_REF: 'TEST-REF' };
await t('research: stores counters only, no per-submission row', async () => {
  for (let i = 0; i < K - 1; i++) assert.equal((await research.fetch(req('/research', 'POST', { v: 1, tool: 1, scores: { visual: 20 + (i % 3), emotional: 50 } }), on)).status, 200);
  // Every stored key is exactly tool|dim|bucket|month, and counts add up to submissions x dimensions:
  for (const k of DB.cells.keys()) assert.match(k, /^1\|(visual|emotional)\|\d+\|\d{4}-\d{2}$/);
  const total = [...DB.cells.values()].reduce((a, n) => a + n, 0);
  assert.equal(total, (K - 1) * 2);
  assert.equal([...DB.totals.values()].reduce((a, n) => a + n, 0), K - 1);
});
await t('research: summary is suppressed below K and released at K', async () => {
  let s = await (await research.fetch(req('/research/summary?tool=1'), on)).json();
  assert.equal(s.suppressed, true);
  // The public summary waits until the tool reaches K; once it does, all anonymous
  // aggregate cells remain available for research, cultural-science work and publication.
  await research.fetch(req('/research', 'POST', { v: 1, tool: 1, scores: { visual: 90, emotional: 50 } }), on);
  s = await (await research.fetch(req('/research/summary?tool=1'), on)).json();
  assert.equal(s.n, K);
  assert.deepEqual(s.histograms.visual, { 20: K - 1, 90: 1 });
  assert.deepEqual(s.histograms.emotional, { 50: K });
  assert.ok(/Anonymous aggregate counters only/.test(s.note));
});
await t('research: rejects non-allowlisted tools and oversize bodies', async () => {
  assert.equal((await research.fetch(req('/research', 'POST', { v: 1, tool: 5, scores: { a: 1 } }), on)).status, 400);
  // automated runs are acknowledged but never counted
  const before = (await (await research.fetch(req('/research/summary?tool=1'), on)).json()).n;
  for (const h of [{ 'User-Agent': 'HeadlessChrome/124' }, { 'User-Agent': 'python-requests/2.31' }, { Origin: 'https://localhost:8765' }, { Origin: 'https://evil.example' }]) {
    assert.equal((await research.fetch(req('/research', 'POST', { v: 1, tool: 1, scores: { visual: 20, emotional: 50 } }, h), on)).status, 200);
  }
  assert.equal((await (await research.fetch(req('/research/summary?tool=1'), on)).json()).n, before, 'automated runs must not change the counters');
  assert.equal((await research.fetch(req('/research', 'POST', { v: 1, tool: 1, scores: { visual: 1 }, pad: 'x'.repeat(2000) }), on)).status, 413);
});

// ---------- e-mail delivery ----------
const goodHtml = '<div><p>The Dark Hierarchy</p><p>Your result</p><a href="https://echoxstudios.art/tdh/tool-1-trigger-gradient.html?code=ABCD23">link</a></div>';
const mail = (over = {}) => ({ to: 'reader@example.org', subject: 'Trigger Gradient \u2014 The Dark Hierarchy', htmlContent: goodHtml, ...over });
await t('email: accepts our own template, rejects abuse', async () => {
  assert.equal(validateMail(mail()), null);
  assert.equal(validateMail(mail({ subject: 'Fwd: urgent invoice' })), 'Invalid subject');
  assert.equal(validateMail(mail({ to: 'a@b.co, c@d.co' })), 'Invalid recipient');
  assert.equal(validateMail(mail({ htmlContent: goodHtml + '<script>x()</script>' })), 'Invalid content');
  assert.equal(validateMail(mail({ htmlContent: goodHtml + '<img src="https://evil.example/p.png">' })), 'Invalid content');
  assert.equal(validateMail(mail({ htmlContent: goodHtml.replace('echoxstudios.art', 'echoxstudios.art.evil.example') })), 'Invalid content');
  assert.equal(validateMail(mail({ htmlContent: '<p>buy now</p>'.repeat(10) })), 'Invalid content');
  assert.equal(validateMail({ ...mail(), bcc: 'x@y.zz' }), 'Unexpected fields');
  assert.equal(validateMail(mail({ subject: 'The Dark Hierarchy \u2014 Liturgical Matrix [ABCD23]' })), null);
});
await t('email: origin, configuration, delivery and daily cap', async () => {
  const real = globalThis.fetch; let sentBody = null;
  globalThis.fetch = async (u, o) => { sentBody = JSON.parse(o.body); return new Response('{}', { status: 201 }); };
  try {
    const mreq = (body, headers) => req('/', 'POST', body, headers);
    const env = { BREVO_API_KEY: 'k', SENDER_EMAIL: 'tdh@echoxstudios.art', EMAIL_DAILY: kv() };
    assert.equal((await email.fetch(mreq(mail(), { Origin: 'https://evil.example' }), env)).status, 403);
    assert.equal((await email.fetch(mreq(mail()), {})).status, 503);
    assert.equal((await email.fetch(mreq(mail({ subject: 'x' })), env)).status, 400);
    assert.equal((await email.fetch(req('/stats'), env)).status, 404);
    assert.equal((await email.fetch(mreq(mail()), env)).status, 200);
    assert.equal(sentBody.to[0].email, 'reader@example.org');
    assert.equal(sentBody.sender.email, 'tdh@echoxstudios.art');
    const stuffed = { ...env, EMAIL_DAILY: kv() }; await stuffed.EMAIL_DAILY.put('n' + new Date().toISOString().slice(0, 10), '300');
    assert.equal((await email.fetch(mreq(mail()), stuffed)).status, 429);
  } finally { globalThis.fetch = real; }
});

console.log(`\n${passed} worker tests passed`);
