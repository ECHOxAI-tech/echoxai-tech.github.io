// One command, fully automatic: runs every suite and writes an inspectable report.
//   node tests/run-all.mjs            (or: npm test)
// Output: test-results/index.html (open in a browser), test-results/report.json, one .log per suite.
// Browser suites run against mocked workers only; nothing here can reach the live services or the real counters.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CHROME } from './lib/browser.mjs';

const root = path.resolve(decodeURIComponent(new URL('..', import.meta.url).pathname));
const out = path.join(root, 'test-results');
fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });

const SUITES = [
  { id: 'static', name: 'Static site gate', area: 'Site rules', cmd: ['python3', 'tools/check_site.py'], env: { TDH_STATIC_ONLY: '1' }, what: 'Brand and house rules, privacy wording, CSP endpoints, anonymity patterns, fonts, landmarks, contrast, link hygiene.' },
  { id: 'workers', name: 'Worker unit tests', area: 'Services', cmd: ['node', 'worker/test/workers.test.mjs'], what: 'Profile, research and e-mail workers: validation, consent, rate limits, k=30 suppression, automated-run discard, e-mail allowlist.' },
  { id: 'scoring', name: 'Scoring tests', area: 'Tools', cmd: ['node', 'tests/scoring.test.mjs'], what: 'Tool scoring and result banding.' },
  { id: 'routing', name: 'Routing tests', area: 'Tools', cmd: ['node', 'tests/routing.test.mjs'], what: 'Which requests may leave the device and where they go.' },
  { id: 'wording', name: 'Wording audit', area: 'Privacy', cmd: ['node', 'tests/wording.test.mjs'], what: 'Public documents match docs/DATA_FACTS.md: no stale "not deployed / switched off" claims, required statements present, research status matches the live configuration, headline and Scandinavia house rules.' },
  { id: 'e2e-research', name: 'Research flow (end to end)', area: 'Research', browser: true, cmd: ['node', 'tests/e2e-research.mjs'], what: 'Receipt, exactly-once per tool/device/month, 503/429/offline/blocked-storage/corrupt-profile behaviour, automated traffic excluded.' },
  { id: 'e2e-tools', name: 'All seven tools (end to end)', area: 'Tools', browser: true, cmd: ['node', 'tests/e2e-tools.mjs'], what: 'Each tool: complete, result and code, remote save, retrieval on another device, refresh, e-mail through the real server validator, 375/768/1280 widths, named controls.' },
  { id: 'e2e-email', name: 'E-mail delivery (end to end)', area: 'E-mail', browser: true, cmd: ['node', 'tests/e2e-email.mjs'], what: 'Result e-mail from tools 1, 4 and 7: valid request accepted by the real server validator; delivery error, rate limit, daily cap and offline each show a clear message and leave Send usable; invalid addresses never leave the page.' },
  { id: 'smoke', name: 'Page smoke test', area: 'Site', browser: true, cmd: ['node', 'tests/smoke.mjs'], what: 'Every page loads without script errors or CSP violations, has a main landmark, does not scroll sideways.' },
  { id: 'a11y', name: 'Accessibility (axe)', area: 'Accessibility', browser: true, cmd: ['node', 'tests/a11y.mjs'], what: 'axe-core scan of every page.' },
  { id: 'keyboard', name: 'Keyboard contract', area: 'Accessibility', browser: true, cmd: ['node', 'tests/keyboard.mjs'], what: 'Privacy dialog focus trap, Esc, focus return; lyric disclosures.' },
];

const run = s => new Promise(resolve => {
  const start = Date.now();
  if (s.browser && !CHROME) return resolve({ status: 'skipped', ms: 0, log: 'Chrome not found; browser suite skipped.' });
  const child = spawn(s.cmd[0], s.cmd.slice(1), { cwd: root, env: { ...process.env, ...(s.env || {}) } });
  let log = ''; child.stdout.on('data', d => (log += d)); child.stderr.on('data', d => (log += d));
  const timer = setTimeout(() => { log += '\n[runner] timed out after 15 minutes'; child.kill('SIGKILL'); }, 15 * 60 * 1000);
  child.on('close', code => { clearTimeout(timer); resolve({ status: code === 0 ? (/skipped/i.test(log) ? 'skipped' : 'passed') : 'failed', ms: Date.now() - start, log }); });
});

const results = [];
const started = new Date();
for (const s of SUITES) {
  process.stdout.write(`▶ ${s.name} … `);
  const r = await run(s);
  fs.writeFileSync(path.join(out, `${s.id}.log`), r.log);
  const checks = (r.log.match(/^ok\s/gm) || []).length;
  const fails = (r.log.match(/^FAIL\s/gm) || []).length;
  const summary = (r.log.trim().split('\n').filter(Boolean).pop() || '').slice(0, 200);
  results.push({ id: s.id, name: s.name, area: s.area, what: s.what, status: r.status, seconds: +(r.ms / 1000).toFixed(1), checks, fails, summary, log: r.log });
  console.log(`${r.status} (${(r.ms / 1000).toFixed(1)}s${checks ? `, ${checks} checks` : ''})`);
}

const totals = { suites: results.length, passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, skipped: results.filter(r => r.status === 'skipped').length, checks: results.reduce((a, r) => a + r.checks, 0) };
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ started: started.toISOString(), finished: new Date().toISOString(), totals, results: results.map(({ log, ...r }) => r) }, null, 2));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Echo-System test report</title>
<style>
:root{--bg:#fafaf7;--fg:#1c1b18;--mut:#6a665e;--card:#fff;--rule:#e3e0d8;--ok:#1d7a3e;--bad:#b3261e;--skip:#8a6d00}
@media (prefers-color-scheme:dark){:root{--bg:#10100d;--fg:#ece8df;--mut:#a39e93;--card:#181813;--rule:#2d2b24;--ok:#5fcf86;--bad:#ff8a80;--skip:#e6c35a}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,sans-serif}
main{max-width:60rem;margin:0 auto;padding:2rem 1rem}
h1{font-size:1.5rem;margin:0 0 .25rem}.mut{color:var(--mut)}
.sum{display:flex;gap:1rem;flex-wrap:wrap;margin:1.25rem 0}
.sum div{background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:.75rem 1rem;min-width:7rem}
.sum b{display:block;font-size:1.6rem}
details{background:var(--card);border:1px solid var(--rule);border-radius:8px;margin:.6rem 0}
summary{cursor:pointer;padding:.75rem 1rem;display:flex;gap:.75rem;align-items:baseline;flex-wrap:wrap}
.tag{font-weight:600;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em}
.passed{color:var(--ok)}.failed{color:var(--bad)}.skipped{color:var(--skip)}
.body{padding:0 1rem 1rem}pre{background:var(--bg);border:1px solid var(--rule);border-radius:6px;padding:.75rem;overflow:auto;font-size:.8rem;max-height:28rem}
</style></head><body><main>
<h1>Echo-System test report</h1>
<p class="mut">Run ${esc(started.toISOString())} · browser suites use mocked workers only; nothing contacts the live services or counters.</p>
<div class="sum"><div><b class="${totals.failed ? 'failed' : 'passed'}">${totals.failed ? 'FAILED' : 'PASSED'}</b>overall</div><div><b>${totals.passed}/${totals.suites}</b>suites passed</div><div><b>${totals.checks}</b>named checks</div><div><b>${totals.skipped}</b>skipped</div></div>
${results.map(r => `<details${r.status === 'failed' ? ' open' : ''}><summary><span class="tag ${r.status}">${r.status}</span><strong>${esc(r.name)}</strong><span class="mut">${esc(r.area)} · ${r.seconds}s${r.checks ? ` · ${r.checks} checks` : ''}</span></summary><div class="body"><p class="mut">${esc(r.what)}</p><p><strong>Result:</strong> ${esc(r.summary)}</p><pre>${esc(r.log.trim() || '(no output)')}</pre></div></details>`).join('\n')}
</main></body></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log(`\n${totals.failed ? 'FAILED' : 'PASSED'}: ${totals.passed}/${totals.suites} suites, ${totals.checks} named checks, ${totals.skipped} skipped\nReport: test-results/index.html`);
process.exit(totals.failed ? 1 : 0);
