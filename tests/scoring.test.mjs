// Unit tests for the scoring logic of the Echo-System tools. The functions live inside each tool page,
// so this file lifts them out of the HTML and runs them in an isolated VM context with fixed inputs.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read = f => fs.readFileSync(new URL('../tdh/' + f, import.meta.url), 'utf8');

// Return the source text from `start` to the matching closing bracket of the first opening bracket after it.
function grab(src, start) {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `marker not found: ${start}`);
  const open = src.slice(i).search(/[\[{]/) + i;
  const pairs = { '[': ']', '{': '}' };
  const stack = [];
  for (let k = open; k < src.length; k++) {
    const c = src[k];
    if (c === '[' || c === '{') stack.push(pairs[c]);
    else if (c === ']' || c === '}') { stack.pop(); if (!stack.length) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced: ' + start);
}
const load = (file, markers, pre = '') => {
  const src = read(file);
  const ctx = vm.createContext({ Math, Object, Array });
  vm.runInContext(pre + markers.map(m => grab(src, m)).join(';\n') + ';\n' +
    'globalThis.__api = {' + markers.map(m => m.replace(/^(const|function|let) /, '').replace(/[ ({=].*/, '')).join(',') + '};', ctx);
  return { ctx, api: ctx.__api };
};
const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

// ---------- Tool 1: trigger gradient ----------
{
  const { ctx, api } = load('tool-1-trigger-gradient.html', ['const QUESTIONS = [', 'const MEANING_IDS = {', 'function computeGradient(']);
  const Q = api.QUESTIONS, chans = ['V', 'E', 'T', 'I'];
  test('tool 1: every channel has items and ids are unique', () => {
    chans.forEach(c => assert.ok(Q.filter(q => q.ch === c).length >= 3, c));
    assert.equal(new Set(Q.map(q => q.id)).size, Q.length);
  });
  test('tool 1: neutral answers give an even split summing to 100', () => {
    const all4 = Object.fromEntries(Q.map(q => [q.id, 4]));
    const p = api.computeGradient(all4);
    assert.equal(chans.reduce((s, c) => s + p[c], 0), 100);
    const spread = Math.max(...chans.map(c => p[c])) - Math.min(...chans.map(c => p[c]));
    assert.ok(spread <= 3, 'near-even split expected, got ' + JSON.stringify(p));
  });
  test('tool 1: percentages always sum to exactly 100 (500 random answer sets)', () => {
    const r = rng(7);
    for (let n = 0; n < 500; n++) {
      const resp = Object.fromEntries(Q.map(q => [q.id, 1 + Math.floor(r() * 7)]));
      const p = api.computeGradient(resp);
      assert.equal(chans.reduce((s, c) => s + p[c], 0), 100);
      chans.forEach(c => assert.ok(p[c] >= 0 && p[c] <= 100));
    }
  });
  test('tool 1: maxing one channel makes it dominant; reversed items invert', () => {
    chans.forEach(target => {
      const resp = Object.fromEntries(Q.map(q => [q.id, q.ch === target ? (q.rev ? 1 : 7) : (q.rev ? 7 : 1)]));
      const p = api.computeGradient(resp);
      chans.filter(c => c !== target).forEach(c => assert.ok(p[target] > p[c], `${target} should beat ${c}`));
    });
  });
}

// ---------- Tool 3: attachment as confirmation history ----------
{
  const { api } = load('tool-3-attachment-confirmation.html', ['const QUESTIONS = [', 'function computeScores(']);
  const Q = api.QUESTIONS;
  test('tool 3: neutral answers sit at the midpoint on all four axes', () => {
    const s = api.computeScores(Object.fromEntries(Q.map(q => [q.id, 4])));
    ['A', 'B', 'C', 'D'].forEach(k => assert.equal(s[k], 50, k));
  });
  test('tool 3: scores stay within 0–100 (500 random answer sets)', () => {
    const r = rng(11);
    for (let n = 0; n < 500; n++) {
      const s = api.computeScores(Object.fromEntries(Q.map(q => [q.id, 1 + Math.floor(r() * 7)])));
      ['A', 'B', 'C', 'D'].forEach(k => assert.ok(Number.isInteger(s[k]) && s[k] >= 0 && s[k] <= 100, k + '=' + s[k]));
    }
  });
  test('tool 3: extremes reach the ends; a missing answer counts as neutral', () => {
    const hi = api.computeScores(Object.fromEntries(Q.map(q => [q.id, q.dim === 'B' ? (q.toward ? 7 : 1) : (q.rev ? 1 : 7)])));
    const lo = api.computeScores(Object.fromEntries(Q.map(q => [q.id, q.dim === 'B' ? (q.toward ? 1 : 7) : (q.rev ? 7 : 1)])));
    ['A', 'B', 'C', 'D'].forEach(k => { assert.equal(hi[k], 100, 'hi ' + k); assert.equal(lo[k], 0, 'lo ' + k); });
    assert.equal(JSON.stringify(api.computeScores({})), JSON.stringify({ A: 50, B: 50, C: 50, D: 50 }));
  });
}

// ---------- Tool 4: dark night vs system failure ----------
{
  const { api } = load('tool-4-dark-night.html', ['const QUESTIONS = [', 'function computeDiagnosis(']);
  const Q = api.QUESTIONS;
  const phase = p => Q.filter(q => q.phase === p);
  const answer = (e, f, d) => {
    const resp = {};
    Q.forEach(q => (resp[q.id] = 1));
    phase('P').slice(0, e).forEach(q => (resp[q.id] = 7));
    phase('F').slice(0, f).forEach(q => (resp[q.id] = 7));
    phase('D').slice(0, d).forEach(q => (resp[q.id] = 7));
    return api.computeDiagnosis(resp);
  };
  test('tool 4: item counts match the stated scale (6 erosion, 9 conditions, 3 faith)', () => {
    assert.equal(phase('P').length, 6); assert.equal(phase('F').length, 9); assert.equal(phase('D').length, 3);
  });
  test('tool 4: classification table', () => {
    const cases = [
      [0, 0, 0, 'unclear'], [1, 1, 3, 'unclear'], [2, 0, 0, 'system_failure_early'], [0, 2, 0, 'system_failure_early'],
      [3, 0, 2, 'dark_night'], [4, 3, 3, 'dark_night'], [3, 2, 1, 'system_failure'], [3, 1, 0, 'system_failure_early'],
      [0, 4, 0, 'system_failure'], [0, 4, 1, 'system_failure'], [0, 4, 2, 'both'], [6, 9, 3, 'both'],
    ];
    cases.forEach(([e, f, d, want]) => assert.equal(answer(e, f, d).primary, want, `E${e} F${f} D${d}`));
  });
  test('tool 4: care frame triggers for deep erosion or many conditions only', () => {
    assert.equal(answer(4, 3, 3).severeDistress, false);
    assert.equal(answer(5, 0, 0).severeDistress, true);
    assert.equal(answer(0, 7, 0).severeDistress, true);
    assert.equal(answer(0, 6, 0).severeDistress, false);
  });
  test('tool 4: counts are reported exactly', () => {
    const d = answer(3, 5, 2);
    assert.equal([d.erosionScore, d.failureScore, d.faithScore, d.flaggedModes.length].join(), '3,5,2,5');
  });
}

// ---------- Tool 6: the threshold ----------
{
  const pre = 'let resp = {};\n';
  const { ctx, api } = load('tool-6-threshold.html',
    ['function v(', 'function determineThreshold(', 'function determineArchitecture(', 'function determineCost('], pre);
  const set = o => vm.runInContext('resp = ' + JSON.stringify(o), ctx);
  const base = { T1: 1, T2: 1, T3: 1, T4: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, C1: 1, C2: 1, C3: 1 };
  test('tool 6: threshold picks the strongest and flags low or broad responses', () => {
    set({ ...base, T3: 6 });
    let t = api.determineThreshold(); assert.equal(t.primary, 'T3'); assert.equal(t.allLow, false);
    set({ ...base, T1: 3, T2: 2 }); assert.equal(api.determineThreshold().allLow, true);
    set({ ...base, T1: 5, T2: 6, T4: 7 }); assert.equal(api.determineThreshold().allHigh, true);
  });
  test('tool 6: architecture', () => {
    set({ ...base, H1: 7 }); assert.equal(api.determineArchitecture(), 'not-yet');
    set({ ...base, H2: 7, H3: 7 }); assert.equal(api.determineArchitecture(), 'excavation');
    set({ ...base, H4: 7, H5: 7 }); assert.equal(api.determineArchitecture(), 'deliberate');
    set({ ...base, H1: 6, H2: 6, H3: 6 }); assert.equal(api.determineArchitecture(), 'multiple');
  });
  test('tool 6: cost', () => {
    set({ ...base, C1: 6, C2: 2 }); assert.equal(api.determineCost(), 'crossing-heavier');
    set({ ...base, C1: 2, C2: 6 }); assert.equal(api.determineCost(), 'not-crossing-heavier');
    set({ ...base, C1: 4, C2: 4 }); assert.equal(api.determineCost(), 'comparable');
    set({ ...base, C1: 7, C2: 1, C3: 5 }); assert.equal(api.determineCost(), 'comparable');
  });
}

// ---------- Cross-cutting: monotonicity, invalid input, and a golden snapshot ----------
import crypto from 'node:crypto';
{
  const t1 = load('tool-1-trigger-gradient.html', ['const QUESTIONS = [', 'const MEANING_IDS = {', 'function computeGradient(']).api;
  const t3 = load('tool-3-attachment-confirmation.html', ['const QUESTIONS = [', 'function computeScores(']).api;
  const base1 = Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 4]));
  test('tool 1: raising an item that belongs to a channel never lowers that channel (monotonic)', () => {
    for (const q of t1.QUESTIONS) {
      let prev = -1;
      for (let v = 1; v <= 7; v++) {
        const score = t1.computeGradient({ ...base1, [q.id]: q.rev ? 8 - v : v })[q.ch];
        assert.ok(score >= prev, `${q.id} (${q.ch}) dropped at ${v}`);
        prev = score;
      }
    }
  });
  test('tool 1: no single item moves a channel by more than its fair weight (weight balance)', () => {
    const per = {};
    for (const q of t1.QUESTIONS) {
      const lo = t1.computeGradient({ ...base1, [q.id]: q.rev ? 7 : 1 })[q.ch], hi = t1.computeGradient({ ...base1, [q.id]: q.rev ? 1 : 7 })[q.ch];
      (per[q.ch] ||= []).push(hi - lo);
    }
    const all = Object.values(per).flat(), mean = all.reduce((a, b) => a + b, 0) / all.length;
    all.forEach(span => assert.ok(span > 0 && span < mean * 2.5, `item span ${span} vs mean ${mean.toFixed(1)}`));
  });
  test('tool 3: raising a non-reversed item never lowers its axis (monotonic)', () => {
    const base = Object.fromEntries(t3.QUESTIONS.map(q => [q.id, 4]));
    for (const q of t3.QUESTIONS) {
      const dir = q.dim === 'B' ? (q.toward ? 1 : -1) : (q.rev ? -1 : 1);
      let prev = -1;
      for (let v = 1; v <= 7; v++) {
        const score = t3.computeScores({ ...base, [q.id]: dir > 0 ? v : 8 - v })[q.dim];
        assert.ok(score >= prev, `${q.id} (${q.dim}) dropped at ${v}`);
        prev = score;
      }
    }
  });
  test('invalid or partial input never produces NaN or out-of-range scores', () => {
    for (const bad of [{}, { nope: 3 }, Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 0])), Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 99]))]) {
      const p = t1.computeGradient(bad);
      Object.values(p).forEach(v => assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, JSON.stringify(p)));
    }
    for (const bad of [{}, { nope: 3 }, Object.fromEntries(t3.QUESTIONS.map(q => [q.id, 99]))]) {
      const p = t3.computeScores(bad);
      Object.values(p).forEach(v => assert.ok(Number.isFinite(v) && v >= 0 && v <= 100, JSON.stringify(p)));
    }
  });
  test('golden snapshot: scores for 300 fixed answer sets have not changed (UPDATE_GOLDEN=1 to accept a deliberate change)', () => {
    const r = rng(2026), out = [];
    for (let n = 0; n < 300; n++) {
      out.push(t1.computeGradient(Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 1 + Math.floor(r() * 7)]))));
      out.push(t3.computeScores(Object.fromEntries(t3.QUESTIONS.map(q => [q.id, 1 + Math.floor(r() * 7)]))));
    }
    const digest = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');
    const file = new URL('./fixtures/scoring-golden.json', import.meta.url);
    if (process.env.UPDATE_GOLDEN || !fs.existsSync(file)) { fs.writeFileSync(file, JSON.stringify({ note: 'sha256 of tool 1 and tool 3 scores for 300 seeded answer sets', digest }, null, 2) + '\n'); return; }
    assert.equal(digest, JSON.parse(fs.readFileSync(file, 'utf8')).digest, 'scoring output changed; if deliberate, run UPDATE_GOLDEN=1 node tests/scoring.test.mjs');
  });
}

// ---------- Tool 1: the optional "matters for what it means" box ----------
{
  const t1 = load('tool-1-trigger-gradient.html', ['const QUESTIONS = [', 'const MEANING_IDS = {', 'function computeGradient(']).api;
  const base = Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 4]));
  test('meaning box: only non-reversed touch, sight and connection statements offer it', () => {
    const ids = Object.keys(t1.MEANING_IDS);
    ids.forEach(id => {
      const q = t1.QUESTIONS.find(x => x.id === id);
      assert.ok(q && !q.rev && q.ch !== 'I', id + ' must be a non-reversed, non-Intellectual statement');
    });
    assert.equal(ids.length, 13);
  });
  test('meaning box: unticked scores are exactly the plain scores', () => {
    const r = rng(5);
    for (let n = 0; n < 200; n++) {
      const resp = Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 1 + Math.floor(r() * 7)]));
      assert.deepEqual(JSON.parse(JSON.stringify(t1.computeGradient(resp, {}))), JSON.parse(JSON.stringify(t1.computeGradient(resp))));
    }
  });
  test('meaning box: a ticked touch statement moves its points from Tactile to Intellectual', () => {
    const resp = { ...base, T3: 7 };
    const plain = t1.computeGradient(resp), ticked = t1.computeGradient(resp, { T3: true });
    assert.ok(ticked.I > plain.I, 'Intellectual rises');
    assert.ok(ticked.T < plain.T, 'Tactile falls');
    assert.equal(ticked.V + ticked.E + ticked.T + ticked.I, 100);
  });
  test('meaning box: ticking never lowers Intellectual, and reversed or unlisted statements ignore it', () => {
    const r = rng(9);
    for (let n = 0; n < 200; n++) {
      const resp = Object.fromEntries(t1.QUESTIONS.map(q => [q.id, 1 + Math.floor(r() * 7)]));
      const all = Object.fromEntries(Object.keys(t1.MEANING_IDS).map(id => [id, true]));
      assert.ok(t1.computeGradient(resp, all).I >= t1.computeGradient(resp).I);
    }
    const resp = { ...base, T4: 2, V5: 6, E3: 1, I1: 7, E1: 7, E5: 7 };
    assert.deepEqual(JSON.parse(JSON.stringify(t1.computeGradient(resp, { T4: true, V5: true, E3: true, I1: true, E1: true, E5: true }))), JSON.parse(JSON.stringify(t1.computeGradient(resp))));
  });
}

console.log(`\n${passed} scoring tests passed`);
